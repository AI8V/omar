// --- START OF FILE ghost-crawler.js ---

// assets/js/ghost-crawler.js - Operation: Ghost Evolved - The Mapmaker (Genome Project v1.1 - URL Normalization Fix)

(function() {
    'use strict';

    // --- DOM Elements ---
    const startUrlInput = document.getElementById('startUrl');
    const startCrawlBtn = document.getElementById('startCrawlBtn');
    const progressSection = document.getElementById('progress-section');
    const statusBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const crawlCounter = document.getElementById('crawl-counter');
    const resultsSection = document.getElementById('results-section');
    const healthScoreEl = document.getElementById('health-score');
    const brokenLinksCountEl = document.getElementById('broken-links-count');
    const serverErrorsCountEl = document.getElementById('server-errors-count');
    const issuesTableBody = document.getElementById('issues-table-body');
    const exportVisualizerBtn = document.getElementById('exportVisualizerBtn');
    
    const errorToastEl = document.getElementById('errorToast');
    const errorToast = bootstrap.Toast.getOrCreateInstance(errorToastEl);
    const toastBodyMessage = document.getElementById('toast-body-message');

    // --- State variables ---
    let crawledUrls;
    let queue;
    let issues;
    let healthScore;
    let origin;
    let pageData;
    let crawlMap;

    // --- Helper Functions ---

    // NEW: URL Normalization function to prevent duplicate crawls
    function normalizeUrl(urlStr) {
        try {
            const urlObj = new URL(urlStr);
            urlObj.hash = ''; // Always remove fragment identifier
            // Remove trailing slash if the path is not just '/'
            if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
                urlObj.pathname = urlObj.pathname.slice(0, -1);
            }
            return urlObj.href;
        } catch (e) {
            return urlStr; // Return as-is if invalid
        }
    }

    function showToast(message) {
        if (toastBodyMessage) {
            toastBodyMessage.innerText = message;
            errorToast.show();
        } else {
            alert(message);
        }
    }

    // --- Event Listeners ---
    startCrawlBtn.addEventListener('click', startCrawl);
    if(exportVisualizerBtn) exportVisualizerBtn.addEventListener('click', exportForVisualizer);
    
    async function startCrawl() {
        const rawStartUrl = startUrlInput.value.trim();
        if (!rawStartUrl || !rawStartUrl.startsWith('https://')) {
            showToast('يرجى إدخال رابط صحيح يبدأ بـ ://https');
            return;
        }
        
        // Normalize the start URL from the beginning
        const startUrl = normalizeUrl(rawStartUrl);
        origin = new URL(startUrl).origin;

        // --- Reset state for new crawl ---
        crawledUrls = new Set();
        queue = [{ url: startUrl, depth: 0 }];
        issues = [];
        pageData = new Map();
        crawlMap = [];
        healthScore = 100;
        
        issuesTableBody.innerHTML = '';
        progressSection.classList.remove('d-none');
        resultsSection.classList.add('d-none');
        if(exportVisualizerBtn) exportVisualizerBtn.classList.add('d-none');
        startCrawlBtn.disabled = true;
        startCrawlBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> جارِ الفحص...`;

        processNextInQueue();
    }

    async function processNextInQueue() {
        if (queue.length === 0 || crawledUrls.size >= 200) {
            finishCrawl();
            return;
        }

        const { url: currentUrl, depth: currentDepth } = queue.shift();
        if (crawledUrls.has(currentUrl)) {
            processNextInQueue();
            return;
        }
        
        crawledUrls.add(currentUrl);
        updateProgress();
        statusText.innerText = `يفحص الآن: ${currentUrl}`;
            
        try {
            const startTime = performance.now();
            const proxyUrl = `https://throbbing-dew-da3c.amr-omar304.workers.dev/?url=${encodeURIComponent(currentUrl)}`;
            const response = await fetch(proxyUrl);
            const loadTime = Math.round(performance.now() - startTime);

            const newLinks = await analyzeResponse(currentUrl, response, currentDepth, loadTime);

            if (newLinks) {
                newLinks.forEach(link => {
                    try {
                        // Normalize every new link found
                        const absoluteUrl = normalizeUrl(new URL(link, origin).href);
                        
                        if (absoluteUrl.startsWith(origin) && !crawledUrls.has(absoluteUrl) && !queue.some(q => q.url === absoluteUrl)) {
                            queue.push({ url: absoluteUrl, depth: currentDepth + 1 });
                        }
                    } catch(e) {
                        console.warn(`Invalid URL found and skipped: ${link}`);
                    }
                });
            }
        } catch (error) {
            console.error(`Failed to fetch ${currentUrl}:`, error);
            addIssue('Fetch Error', `لا يمكن الوصول إلى الرابط.`, currentUrl);
            healthScore -= 5;
        }
        
        setTimeout(processNextInQueue, 50);
    }
    
    async function analyzeResponse(url, response, depth, loadTime) {
        // Expanded pageObject structure
        const pageObject = {
            url: url,
            title: '',
            description: '',
            category: 'زاحف SEO',
            tags: [],
            seo: {
                h1: '',
                lang: '',
                canonical: '',
                imageAltInfo: { total: 0, missing: 0 },
                loadTime: loadTime,
                isNoIndex: false,
                isOrphan: false,
                isDefaultDescription: false,
                internalLinkEquity: 0,
                ogTitle: '',
                ogImage: '',
                hasStructuredData: false,
                wordCount: 0,
                crawlDepth: depth,
                contentAnalysis: {
                    internalLinks: 0,
                    externalLinks: 0,
                    outgoingInternalLinks: []
                }
            },
            issues: []
        };
        pageData.set(url, pageObject);

        if (!response.ok) {
            const errorType = response.status >= 500 ? 'Server Error (5xx)' : 'Broken Link (4xx)';
            addIssue(errorType, `كود الحالة: ${response.status}`, url);
            healthScore -= (response.status >= 500 ? 10 : 5);
            return [];
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        pageObject.title = doc.querySelector('title')?.innerText.trim() || '';
        pageObject.description = doc.querySelector('meta[name="description"]')?.content.trim() || '';
        pageObject.seo.h1 = doc.querySelector('h1')?.innerText.trim() || '';
        pageObject.seo.lang = doc.documentElement.lang || 'N/A';
        pageObject.seo.canonical = doc.querySelector('link[rel="canonical"]')?.href || url;
        pageObject.seo.ogTitle = doc.querySelector('meta[property="og:title"]')?.content.trim() || pageObject.title;
        pageObject.seo.ogImage = doc.querySelector('meta[property="og:image"]')?.content.trim() || '';
        pageObject.seo.isNoIndex = doc.querySelector('meta[name="robots"][content*="noindex"]') !== null;
        pageObject.seo.hasStructuredData = doc.querySelector('script[type="application/ld+json"]') !== null;

        const bodyText = doc.body.textContent || "";
        pageObject.seo.wordCount = bodyText.trim().split(/\s+/).filter(Boolean).length;

        const images = doc.querySelectorAll('img');
        pageObject.seo.imageAltInfo.total = images.length;
        pageObject.seo.imageAltInfo.missing = Array.from(images).filter(img => !img.alt || !img.alt.trim()).length;

        if (!pageObject.title || pageObject.title.length < 10 || pageObject.title.length > 60) {
            addIssue('SEO', `العنوان غير مثالي (الطول: ${pageObject.title.length}).`, url);
            healthScore -= 2;
        }
        if (!pageObject.description || pageObject.description.length < 70 || pageObject.description.length > 160) {
            addIssue('SEO', `الوصف التعريفي غير مثالي (الطول: ${pageObject.description.length}).`, url);
            healthScore -= 2;
        }
        if (doc.querySelectorAll('h1').length !== 1) {
            addIssue('Structure', `تم العثور على ${doc.querySelectorAll('h1').length} من وسوم H1 (المطلوب 1).`, url);
            healthScore -= 5;
        }
        
        const allLinks = Array.from(doc.querySelectorAll('a[href]'));
        const outgoingInternalLinksAbs = [];
        let externalLinksCount = 0;

        allLinks.forEach(a => {
            const href = a.getAttribute('href');
            if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return;
            try {
                // Here we use the un-normalized URL to build the absolute path
                const absoluteUrl = new URL(href, origin).href;
                if (absoluteUrl.startsWith(origin)) {
                    // But we store the normalized version
                    outgoingInternalLinksAbs.push(normalizeUrl(absoluteUrl));
                } else {
                    externalLinksCount++;
                }
            } catch (e) { /* Invalid href, ignore */ }
        });

        pageObject.seo.contentAnalysis.outgoingInternalLinks = outgoingInternalLinksAbs;
        pageObject.seo.contentAnalysis.internalLinks = outgoingInternalLinksAbs.length;
        pageObject.seo.contentAnalysis.externalLinks = externalLinksCount;

        return allLinks.map(a => a.getAttribute('href')).filter(Boolean);
    }
    
    function finishCrawl() {
        statusText.innerText = 'اكتمل الفحص! جارِ حساب النتائج النهائية...';
        finalizeCrawlMap();
        displayResults();
        startCrawlBtn.disabled = false;
        startCrawlBtn.innerHTML = `<i class="bi bi-search ms-2"></i>ابدأ الفحص`;
        statusText.innerText = 'اكتمل الفحص!';
    }

    function finalizeCrawlMap() {
        const allPages = Array.from(pageData.values());

        allPages.forEach(page => {
            page.seo.contentAnalysis.outgoingInternalLinks.forEach(targetUrl => {
                if (pageData.has(targetUrl)) {
                    pageData.get(targetUrl).seo.internalLinkEquity++;
                }
            });
        });

        allPages.forEach(page => {
            if (page.seo.internalLinkEquity === 0 && page.seo.crawlDepth > 0) {
                page.seo.isOrphan = true;
                addIssue('Structure', 'صفحة يتيمة (لا توجد روابط داخلية إليها)', page.url);
            }
        });
        
        crawlMap = allPages;
    }

    function addIssue(type, description, url) {
        issues.push({ type, description, url });
        if (pageData.has(url)) {
            pageData.get(url).issues.push({ type, description });
        }
    }

    function updateProgress() {
        const queueSize = queue.length;
        const crawledSize = crawledUrls.size;
        const total = Math.min(200, queueSize + crawledSize);
        crawlCounter.innerText = `${crawledSize}/${total}`;
        const progressPercentage = total > 0 ? (crawledSize / total) * 100 : (queue.length > 0 ? 0 : 100);
        statusBar.style.width = `${progressPercentage}%`;
    }

    function displayResults() {
        resultsSection.classList.remove('d-none');
        healthScoreEl.innerText = Math.max(0, Math.round(healthScore));
        
        brokenLinksCountEl.innerText = issues.filter(i => i.type.includes('4xx') || i.type.includes('Fetch Error')).length;
        serverErrorsCountEl.innerText = issues.filter(i => i.type.includes('5xx')).length;

        if (issues.length === 0) {
            issuesTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-success fw-bold">رائع! لم يتم العثور على مشاكل حرجة.</td></tr>`;
        } else {
            issuesTableBody.innerHTML = issues.sort((a, b) => getBadgeColor(b.type).localeCompare(getBadgeColor(a.type))).map(issue => `
                <tr>
                    <td><span class="badge bg-${getBadgeColor(issue.type)}">${issue.type}</span></td>
                    <td>${issue.description}</td>
                    <td><a href="${issue.url}" target="_blank" rel="noopener noreferrer" class="text-truncate d-inline-block" style="max-width: 250px;">${issue.url}</a></td>
                </tr>
            `).join('');
        }
        
        if (exportVisualizerBtn && crawlMap.length > 0) {
            exportVisualizerBtn.classList.remove('d-none');
        }
    }

    function getBadgeColor(type) {
        if (type.includes('Error') || type.includes('4xx') || type.includes('5xx')) return 'danger';
        if (type.includes('Structure')) return 'warning';
        return 'info';
    }

    function exportForVisualizer() {
        if (!crawlMap || crawlMap.length === 0) {
            showToast('لا توجد بيانات صالحة لتصديرها.');
            return;
        }
        
        const finalExportData = crawlMap.map((page, index) => {
            const relativeUrl = page.url.replace(origin, '') || '/';
            const relativeOutgoingLinks = page.seo.contentAnalysis.outgoingInternalLinks
                .map(link => link.replace(origin, '') || '/')
                .filter(link => link !== relativeUrl);

            return {
                id: index + 1,
                title: page.title,
                description: page.description,
                url: relativeUrl,
                category: page.category,
                tags: page.tags,
                seo: {
                    ...page.seo,
                    contentAnalysis: {
                        ...page.seo.contentAnalysis,
                        outgoingInternalLinks: relativeOutgoingLinks
                    }
                }
            };
        });

        const dataStr = JSON.stringify(finalExportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'search-index.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

})();

// --- END OF FILE ghost-crawler.js ---