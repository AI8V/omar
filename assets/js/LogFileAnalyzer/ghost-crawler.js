// assets/js/LogFileAnalyzer/ghost-crawler.js

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
    const resultsTableBody = document.getElementById('results-table-body');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const errorToastEl = document.getElementById('errorToast');
    const errorToast = bootstrap.Toast.getOrCreateInstance(errorToastEl);
    const toastBodyMessage = document.getElementById('toast-body-message');

    // --- State Variables ---
    let origin;
    let crawledUrls; // Set of URLs that have been processed from the queue
    let queue; // Array of {url, depth} to be crawled
    let pageData; // Map<url, {status, title, wordCount, depth, outgoingLinks: [{url, type, anchor}]}>
    let allFoundLinks; // Set of all unique link URLs found on the site
    let linkStatusCache; // Map<url, {error, status}> to store check results
    let finalReport; // Array of objects representing each row in the final CSV

    /**
     * Normalizes a URL by removing the hash and trailing slash.
     * @param {string} urlStr The URL to normalize.
     * @returns {string} The normalized URL.
     */
    function normalizeUrl(urlStr) {
        try {
            const urlObj = new URL(urlStr);
            urlObj.hash = '';
            if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
                urlObj.pathname = urlObj.pathname.slice(0, -1);
            }
            return urlObj.href;
        } catch (e) {
            return urlStr; // Return original if invalid
        }
    }

    /**
     * Displays a toast notification with an error message.
     * @param {string} message The message to display.
     */
    function showToast(message) {
        toastBodyMessage.innerText = message;
        errorToast.show();
    }

    /**
     * Resets all state variables and UI elements to start a new crawl.
     */
    function initializeCrawl() {
        const rawStartUrl = startUrlInput.value.trim();
        if (!rawStartUrl || !rawStartUrl.startsWith('https://')) {
            showToast('يرجى إدخال رابط صحيح يبدأ بـ https://');
            return false;
        }
        
        const startUrl = normalizeUrl(rawStartUrl);
        origin = new URL(startUrl).origin;

        // Reset state
        crawledUrls = new Set();
        queue = [{ url: startUrl, depth: 0 }];
        pageData = new Map();
        allFoundLinks = new Set();
        linkStatusCache = new Map();
        finalReport = [];

        // Reset UI
        resultsTableBody.innerHTML = '';
        progressSection.classList.remove('d-none');
        resultsSection.classList.add('d-none');
        exportCsvBtn.classList.add('d-none');
        startCrawlBtn.disabled = true;
        startCrawlBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> جارِ الفحص...`;
        
        return true;
    }

    /**
     * Main crawl loop (Phase 1: Crawl & Collect).
     * Processes one URL from the queue at a time.
     */
    async function processQueue() {
        if (queue.length === 0) {
            await finishCrawl(); // Move to Phase 2
            return;
        }

        const { url: currentUrl, depth } = queue.shift();
        if (crawledUrls.has(currentUrl)) {
            processQueue(); // Skip if already processed
            return;
        }

        crawledUrls.add(currentUrl);
        updateProgress(crawledUrls.size, crawledUrls.size + queue.length, `المرحلة الأولى: يتم الآن فحص ${currentUrl}`);

        try {
            const proxyUrl = `https://throbbing-dew-da3c.amr-omar304.workers.dev/?url=${encodeURIComponent(currentUrl)}`;
            const response = await fetch(proxyUrl);
            
            const pageInfo = {
                status: response.status,
                title: 'N/A',
                wordCount: 0,
                depth: depth,
                outgoingLinks: []
            };
            pageData.set(currentUrl, pageInfo);

            if (response.ok && (response.headers.get('Content-Type') || '').includes('text/html')) {
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                pageInfo.title = doc.querySelector('title')?.innerText.trim() || '[لا يوجد عنوان]';
                pageInfo.wordCount = (doc.body?.textContent || "").trim().split(/\s+/).filter(Boolean).length;

                // Collect all links (anchors and images)
                collectLinks(doc, currentUrl, pageInfo, depth);
            }
        } catch (error) {
            console.error(`فشل جلب ${currentUrl}:`, error);
            if (pageData.has(currentUrl)) {
                pageData.get(currentUrl).status = 'Error: Fetch Failed';
            }
        }

        setTimeout(processQueue, 50); // Small delay between requests
    }

    /**
     * Extracts all links from a document and adds them to the crawl queue or data stores.
     * @param {Document} doc The parsed HTML document.
     * @param {string} sourceUrl The URL of the page being analyzed.
     * @param {object} pageInfo The data object for the source page.
     * @param {number} depth The crawl depth of the source page.
     */
    function collectLinks(doc, sourceUrl, pageInfo, depth) {
        // Collect anchor links
        doc.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

            try {
                const absoluteUrl = normalizeUrl(new URL(href, sourceUrl).href);
                allFoundLinks.add(absoluteUrl);
                pageInfo.outgoingLinks.push({
                    url: absoluteUrl,
                    type: absoluteUrl.startsWith(origin) ? 'لينك داخلى' : 'لينك خارجى',
                    anchor: a.innerText.trim() || '[نص فارغ]'
                });

                // Add internal, non-crawled URLs to the queue
                if (absoluteUrl.startsWith(origin) && !crawledUrls.has(absoluteUrl) && !queue.some(q => q.url === absoluteUrl)) {
                    queue.push({ url: absoluteUrl, depth: depth + 1 });
                }
            } catch (e) { console.warn(`رابط غير صالح في الصفحة ${sourceUrl}: ${href}`); }
        });

        // Collect image links
        doc.querySelectorAll('img[src]').forEach(img => {
            const src = img.getAttribute('src');
            if (!src) return;
            try {
                const absoluteUrl = normalizeUrl(new URL(src, sourceUrl).href);
                allFoundLinks.add(absoluteUrl);
                pageInfo.outgoingLinks.push({
                    url: absoluteUrl,
                    type: 'صورة',
                    anchor: img.alt.trim() || '[alt فارغ]'
                });
            } catch (e) { console.warn(`رابط صورة غير صالح في الصفحة ${sourceUrl}: ${src}`); }
        });
    }

    /**
     * Phase 2: Analyze & Report. Triggered after the crawl is complete.
     */
    async function finishCrawl() {
        // 1. Check status of all unique links found
        const linksArray = Array.from(allFoundLinks);
        for (let i = 0; i < linksArray.length; i++) {
            const link = linksArray[i];
            updateProgress(i + 1, linksArray.length, `المرحلة الثانية: فحص حالة الروابط (${i + 1}/${linksArray.length})`);
            await checkLinkStatus(link);
        }

        // 2. Build the final report by cross-referencing page data with link statuses
        updateProgress(0, 1, 'المرحلة الثالثة: جاري تجميع التقرير النهائي...');
        buildFinalReport();

        // 3. Display results
        displayResults();
        
        // 4. Reset UI
        startCrawlBtn.disabled = false;
        startCrawlBtn.innerHTML = `<i class="bi bi-search ms-2"></i>ابدأ الفحص`;
        statusBar.style.width = '100%';
        statusText.innerText = `اكتمل الفحص! تم العثور على ${finalReport.length} مشكلة.`;
    }
    
    /**
     * Checks the HTTP status of a single URL and caches the result.
     * @param {string} url The URL to check.
     */
    async function checkLinkStatus(url) {
        if (linkStatusCache.has(url)) return;

        try {
            const proxyUrl = `https://throbbing-dew-da3c.amr-omar304.workers.dev/?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl, { method: 'HEAD', mode: 'cors' });
            if (!response.ok) {
                linkStatusCache.set(url, { error: true, status: response.status >= 500 ? '5xx' : `4xx (${response.status})` });
            } else {
                linkStatusCache.set(url, { error: false, status: response.status });
            }
        } catch (e) {
            linkStatusCache.set(url, { error: true, status: 'Error: Unknown Host' });
        }
    }
    
    /**
     * Iterates through all crawled pages and their links to build the final report of issues.
     */
    function buildFinalReport() {
        const incomingLinksMap = new Map();
        // Calculate incoming links for each page
        for (const [sourceUrl, data] of pageData.entries()) {
            data.outgoingLinks.forEach(link => {
                if (link.url.startsWith(origin)) {
                    if (!incomingLinksMap.has(link.url)) incomingLinksMap.set(link.url, 0);
                    incomingLinksMap.set(link.url, incomingLinksMap.get(link.url) + 1);
                }
            });
        }
        
        // Create the report rows
        for (const [sourceUrl, data] of pageData.entries()) {
            const outgoingErrors = new Map();

            data.outgoingLinks.forEach(link => {
                const statusInfo = linkStatusCache.get(link.url);
                if (statusInfo && statusInfo.error) {
                    const errorKey = `${link.url}|${link.anchor}`; // Group by URL and anchor text
                    if (!outgoingErrors.has(errorKey)) {
                        outgoingErrors.set(errorKey, { ...link, errorType: statusInfo.status, frequency: 0 });
                    }
                    outgoingErrors.get(errorKey).frequency++;
                }
            });

            if (outgoingErrors.size > 0) {
                outgoingErrors.forEach(error => {
                    finalReport.push({
                        sourcePage: sourceUrl,
                        pageTitle: data.title,
                        pageStatus: data.status,
                        errorLink: error.url,
                        errorType: error.errorType,
                        errorFrequency: error.frequency,
                        linkType: error.type,
                        anchorText: error.anchor,
                        wordCount: data.wordCount,
                        outgoingLinkCount: data.outgoingLinks.length,
                        incomingLinkCount: incomingLinksMap.get(sourceUrl) || 0,
                        depth: data.depth
                    });
                });
            }
        }
    }

    /**
     * Renders the final report into the HTML table.
     */
    function displayResults() {
        resultsSection.classList.remove('d-none');
        if (finalReport.length === 0) {
            resultsTableBody.innerHTML = `<tr><td colspan="12" class="text-center text-success fw-bold p-4">رائع! لم يتم العثور على أي روابط معطلة.</td></tr>`;
        } else {
            resultsTableBody.innerHTML = finalReport.map(res => `
                <tr>
                    <td class="text-truncate" style="max-width: 150px;"><a href="${res.sourcePage}" target="_blank" title="${res.sourcePage}">${res.sourcePage}</a></td>
                    <td class="text-truncate" style="max-width: 200px;" title="${res.pageTitle}">${res.pageTitle}</td>
                    <td><span class="badge bg-${String(res.pageStatus).startsWith('2') ? 'success' : 'warning'}">${res.pageStatus}</span></td>
                    <td class="text-truncate" style="max-width: 150px;"><a href="${res.errorLink}" target="_blank" title="${res.errorLink}">${res.errorLink}</a></td>
                    <td><span class="badge bg-danger">${res.errorType}</span></td>
                    <td>${res.errorFrequency}</td>
                    <td>${res.linkType}</td>
                    <td class="text-truncate" style="max-width: 150px;" title="${res.anchorText}">${res.anchorText}</td>
                    <td>${res.wordCount}</td>
                    <td>${res.outgoingLinkCount}</td>
                    <td>${res.incomingLinkCount}</td>
                    <td>${res.depth}</td>
                </tr>
            `).join('');
        }
        if (finalReport.length > 0) {
            exportCsvBtn.classList.remove('d-none');
        }
    }

    /**
     * Updates the progress bar and status text.
     */
    function updateProgress(current, total, text) {
        statusText.innerText = text;
        crawlCounter.innerText = `${current}/${total}`;
        const percentage = total > 0 ? (current / total) * 100 : 0;
        statusBar.style.width = `${percentage}%`;
    }

    /**
     * Exports the final report to a CSV file.
     */
    function exportToCsv() {
        if (!finalReport || finalReport.length === 0) {
            showToast('لا توجد بيانات لتصديرها.');
            return;
        }

        const headers = [
            "الصفحة", "العنوان", "حالة الصفحة", "رابط الخطأ", "نوع الخطأ",
            "تكرار الخطأ", "نوع الرابط", "نص الرابط", "عدد كلمات الصفحة",
            "عدد الروابط الصادرة", "عدد الروابط الواردة", "عمق الصفحة"
        ];

        const escapeCsvField = (field) => {
            const str = String(field ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const csvRows = [headers.join(',')];
        for (const row of finalReport) {
            const values = [
                row.sourcePage, row.pageTitle, row.pageStatus, row.errorLink,
                row.errorType, row.errorFrequency, row.linkType, row.anchorText,
                row.wordCount, row.outgoingLinkCount, row.incomingLinkCount, row.depth
            ].map(escapeCsvField);
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ai8V_Crawl_Report_${origin.replace(/https?:\/\//, '')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // --- Event Listeners ---
    startCrawlBtn.addEventListener('click', () => {
        if (initializeCrawl()) {
            processQueue();
        }
    });
    exportCsvBtn.addEventListener('click', exportToCsv);

})();