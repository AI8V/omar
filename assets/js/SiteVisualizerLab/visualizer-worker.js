// assets/js/visualizer-worker.js
// Mind & Machine - Site Visualizer Lab Worker v1.0
'use strict';

console.log("✅ Visualizer Worker v1.0 is ready.");

// --- Helper Functions (self-contained, no DOM access) ---
function sanitizeHTML(str) {
    if (typeof str !== 'string' || !str) return '';
    // Basic sanitization for worker context. A more robust library could be used if needed.
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncateLabel(str, maxLength = 25) {
    if (!str || typeof str !== 'string') return '';
    return str.length > maxLength ? str.substring(0, maxLength) + '…' : str;
}

// --- CSV to Ai8V Conversion Logic ---
function findColumnIndex(header, keys) {
    for (const key of keys) {
        const index = header.findIndex(h => h.toLowerCase() === key.toLowerCase());
        if (index !== -1) return index;
    }
    return -1;
}

function convertCsvToAi8V(csvText) {
    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.substring(1); // Handle BOM
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) throw new Error("ملف CSV فارغ أو غير صالح.");

    const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    const colMap = {
        url: findColumnIndex(header, ['URL', 'Address', 'العنوان']),
        title: findColumnIndex(header, ['Title 1', 'Title', 'العنوان ١', 'العنوان']),
        contentType: findColumnIndex(header, ['Content Type', 'Content', 'نوع المحتوى']),
        inlinks: findColumnIndex(header, ['Inlinks', 'No. of Inlinks', 'الروابط الداخلية الواردة']),
        crawlDepth: findColumnIndex(header, ['Crawl Depth', 'Crawl depth', 'عمق الزحف']),
        indexability: findColumnIndex(header, ['Indexability', 'Indexability Status', 'Indexable', 'القابلية للفهرسة']),
    };

    if (colMap.url === -1) throw new Error(`العمود الأساسي للرابط (URL/Address) غير موجود في ملف CSV.`);
    
    const pages = lines.slice(1).map(line => {
        const data = line.split(',').map(d => d.replace(/"/g, ''));
        const contentType = colMap.contentType !== -1 ? data[colMap.contentType] : 'text/html';
        if (!contentType || !contentType.includes('text/html')) return null;

        const url = data[colMap.url];
        if (!url) return null;

        const inlinks = colMap.inlinks !== -1 ? (parseInt(data[colMap.inlinks], 10) || 0) : 0;
        const crawlDepth = colMap.crawlDepth !== -1 ? (parseInt(data[colMap.crawlDepth], 10) || 0) : 0;
        const title = colMap.title !== -1 ? (data[colMap.title] || url) : url;
        const indexability = colMap.indexability !== -1 ? data[colMap.indexability] : 'Indexable';
        const isNoIndex = !['indexable', 'قابل للفهرسة'].includes(indexability.toLowerCase());
        
        const parentLinks = [];
        try {
            const urlObject = new URL(url);
            const pathSegments = urlObject.pathname.split('/').filter(Boolean);
            if (pathSegments.length > 0) {
                const parentPath = `/${pathSegments.slice(0, -1).join('/')}${pathSegments.length > 1 ? '/' : ''}`;
                const parentUrl = new URL(parentPath, url).href;
                if (parentUrl !== url) {
                   parentLinks.push(parentUrl);
                }
            }
        } catch (e) { /* Ignore invalid URLs for parent link generation */ }
        
        return {
            url, title,
            seo: {
                crawlDepth, isNoIndex,
                isOrphan: crawlDepth > 0 && inlinks === 0,
                internalLinkEquity: inlinks,
                contentAnalysis: { outgoingInternalLinks: parentLinks }
            }
        };
    }).filter(Boolean);

    if (pages.length === 0) throw new Error("لم يتم العثور على صفحات HTML صالحة في ملف CSV.");
    
    const urls = new Set(pages.map(p => p.url));
    if (pages.length > 0) {
        const rootUrl = new URL(pages[0].url).origin + '/';
        if (!urls.has(rootUrl)) {
             pages.push({
                 url: rootUrl,
                 title: new URL(rootUrl).hostname,
                 seo: { crawlDepth: 0, isNoIndex: false, isOrphan: false, internalLinkEquity: 0, contentAnalysis: { outgoingInternalLinks: [] } }
             });
        }
    }

    return JSON.stringify(pages, null, 2);
}


// --- Main Data Processing Logic ---
function processData(jsonDataString) {
    const data = JSON.parse(jsonDataString);
    if (!Array.isArray(data) || data.length === 0) throw new Error("بيانات JSON غير صالحة أو فارغة.");

    const fullSearchIndex = data.filter(item => item && item.url);
    if (fullSearchIndex.length === 0) throw new Error("لم يتم العثور على صفحات صالحة (تحتوي على url) في البيانات.");

    // Edge creation logic
    const pageUrls = new Set(fullSearchIndex.map(p => p.url));
    const edgeAggregator = {};
    fullSearchIndex.forEach(sourcePage => {
        (sourcePage.seo?.contentAnalysis?.outgoingInternalLinks || []).forEach(targetUrl => {
            if (pageUrls.has(targetUrl) && sourcePage.url !== targetUrl) {
                const key = [sourcePage.url, targetUrl].sort().join('|');
                if (!edgeAggregator[key]) edgeAggregator[key] = { from: sourcePage.url, to: targetUrl, count: 0 };
                edgeAggregator[key].count++;
            }
        });
    });
    
    const edges = Object.values(edgeAggregator).map(edgeInfo => ({
        from: edgeInfo.from, to: edgeInfo.to, value: edgeInfo.count,
        length: 350 / edgeInfo.count,
        title: edgeInfo.count > 1 ? `رابط متبادل (x${edgeInfo.count})` : 'رابط أحادي',
        arrows: { to: { enabled: true, scaleFactor: 0.5 }, from: { enabled: edgeInfo.count > 1, scaleFactor: 0.5 } }
    }));
    
    return { fullSearchIndex, edges };
}


// --- Worker Event Listener ---
self.onmessage = function(e) {
    const { fileContent, fileType } = e.data;

    try {
        let jsonDataString = fileContent;
        if (fileType === 'csv') {
            jsonDataString = convertCsvToAi8V(fileContent);
        }
        
        const processedData = processData(jsonDataString);
        
        self.postMessage({
            status: 'success',
            data: processedData
        });

    } catch (err) {
        self.postMessage({
            status: 'error',
            message: err.message
        });
    }
};