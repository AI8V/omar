// assets/js/LogFileAnalyzer/ghost-crawler.js
// Ai8V - Ghost Crawler v2.1 (The Hybrid & Stabilized Edition)

(function() {
    'use strict';

    // --- Constants ---
    const LOW_WORD_COUNT_THRESHOLD = 250;
    const SEVERITY = {
        CRITICAL: { level: 0, text: 'حرجة', class: 'bg-danger' },
        HIGH: { level: 1, text: 'عالية', class: 'bg-warning text-dark' },
        MEDIUM: { level: 2, text: 'متوسطة', class: 'bg-info text-dark' },
        LOW: { level: 3, text: 'منخفضة', class: 'bg-secondary' },
        INFO: { level: 4, text: 'للعلم', class: 'bg-light text-dark border' }
    };

    // --- DOM Elements ---
    const startUrlInput = document.getElementById('startUrl');
    const startCrawlBtn = document.getElementById('startCrawlBtn');
    const crawlDelayInput = document.getElementById('crawlDelay');
    const maxDepthInput = document.getElementById('maxDepth');
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

    // --- [مدمج من النسخة الحديثة] Elements for Site Visualizer ---
    const visualizerActionsContainer = document.getElementById('visualizerActionsContainer');
    const copyVisualizerDataBtn = document.getElementById('copyVisualizerDataBtn');
    const appToastEl = document.getElementById('appToast');
    const appToast = appToastEl ? bootstrap.Toast.getOrCreateInstance(appToastEl) : null;
    const appToastIcon = document.getElementById('toast-icon');
    const appToastTitle = document.getElementById('toast-title');
    const appToastBody = document.getElementById('toast-body-content');


    // --- State Variables ---
    let origin;
    let crawledUrls;
    let queue;
    let pageData;
    let allFoundLinks;
    let linkStatusCache;
    let finalReport;
    let robotsRules = null;
    let crawlDelayValue;
    let maxDepthValue;
    
    // --- [مدمج من النسخة الحديثة] Helper Functions for Linking ---
    /**
     * Shows a general purpose application toast notification.
     */
    function showAppToast(message, type = 'info', title = 'تنبيه') {
        if (!appToast || !appToastBody || !appToastTitle || !appToastIcon) return;
        appToastBody.textContent = message;
        appToastTitle.textContent = title;
        if (type === 'error') {
            appToastIcon.className = 'bi bi-exclamation-triangle-fill text-danger me-2';
        } else if (type === 'success') {
            appToastIcon.className = 'bi bi-check-circle-fill text-success me-2';
        } else {
            appToastIcon.className = 'bi bi-info-circle-fill text-info me-2';
        }
        appToast.show();
    }
    
    /**
     * Copies text to the clipboard and shows a confirmation toast.
     */
    function copyToClipboard(text) {
        if (!navigator.clipboard) {
            showAppToast('متصفحك لا يدعم النسخ إلى الحافظة.', 'error');
            return;
        }
        navigator.clipboard.writeText(text).then(() => {
            if (copyVisualizerDataBtn) {
                copyVisualizerDataBtn.classList.remove('btn-secondary');
                copyVisualizerDataBtn.classList.add('btn-success');
                copyVisualizerDataBtn.innerHTML = `<i class="bi bi-check-circle-fill ms-2"></i> تم النسخ بنجاح!`;
                copyVisualizerDataBtn.disabled = true;
            }
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showAppToast('فشل النسخ إلى الحافظة.', 'error');
        });
    }

    /**
     * Generates a unified data object compatible with the Site Visualizer Lab.
     * @returns {string|null} A JSON string of the site footprint, or null if no data.
     */
    function generateVisualizerData() {
        if (!pageData || pageData.size === 0) return null;

        const fullSearchIndex = [];
        for (const page of pageData.values()) {
            fullSearchIndex.push({
                url: page.canonical,
                title: page.title,
                seo: {
                    internalLinkEquity: page.incomingLinkCount,
                    crawlDepth: page.depth,
                    isNoIndex: page.isNoIndex,
                    isOrphan: page.depth > 0 && page.incomingLinkCount === 0,
                    contentAnalysis: {
                        outgoingInternalLinks: [...new Set(
                            page.outgoingLinks
                            .filter(link => link.type === 'لينك داخلى' && link.url.startsWith(origin))
                            .map(link => link.url)
                        )]
                    }
                }
            });
        }
        return JSON.stringify(fullSearchIndex, null, 2);
    }

    /**
     * Normalizes a URL by removing the hash and trailing slash.
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
            return urlStr;
        }
    }

    /**
     * Displays a toast notification with an error message.
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
        
        crawlDelayValue = parseInt(crawlDelayInput.value, 10);
        if (isNaN(crawlDelayValue) || crawlDelayValue < 0) {
            crawlDelayValue = 100; // Fallback
        }
        maxDepthValue = parseInt(maxDepthInput.value, 10);
        if (isNaN(maxDepthValue) || maxDepthValue < 0) {
            maxDepthValue = 10; // Fallback
        }

        crawledUrls = new Set();
        queue = [{ url: startUrl, depth: 0 }];
        pageData = new Map();
        allFoundLinks = new Set();
        linkStatusCache = new Map();
        finalReport = [];
        robotsRules = null;

        resultsTableBody.innerHTML = '';
        progressSection.classList.remove('d-none');
        resultsSection.classList.add('d-none');
        exportCsvBtn.classList.add('d-none');
        // --- [مدمج من النسخة الحديثة] ---
        if (visualizerActionsContainer) { 
            visualizerActionsContainer.classList.add('d-none');
        }
        startCrawlBtn.disabled = true;
            startCrawlBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> جارِ الفحص...`;
            
            // [إضافة جديدة] إعادة تعيين زر النسخ إلى حالته الأصلية
            if (copyVisualizerDataBtn) {
                copyVisualizerDataBtn.disabled = false;
                copyVisualizerDataBtn.classList.remove('btn-success');
                copyVisualizerDataBtn.classList.add('btn-secondary');
                copyVisualizerDataBtn.innerHTML = `<i class="bi bi-clipboard-data-fill ms-2"></i>نسخ بيانات الخريطة`;
            }
            
            return true;
            }

    /**
     * Parses the content of a robots.txt file.
     */
    function parseRobotsTxt(content) {
        const rules = { allow: [], disallow: [] };
        let agentBlock = false;

        content.split('\n').forEach(line => {
            line = line.split('#')[0].trim();
            if (!line) return;

            const [directive, value] = line.split(':').map(s => s.trim());

            if (directive.toLowerCase() === 'user-agent') {
                agentBlock = (value === '*');
            } else if (agentBlock && value) {
                if (directive.toLowerCase() === 'disallow') {
                    rules.disallow.push(value);
                } else if (directive.toLowerCase() === 'allow') {
                    rules.allow.push(value);
                }
            }
        });
        return rules;
    }

    /**
     * Checks if a URL is allowed to be crawled based on the parsed robots.txt rules.
     */
    function isAllowedByRobots(url) {
        if (!robotsRules) return true;

        const path = new URL(url).pathname;

        const isDisallowed = robotsRules.disallow.some(rule => rule && path.startsWith(rule));
        if (!isDisallowed) {
            return true;
        }

        const isAllowed = robotsRules.allow.some(rule => rule && path.startsWith(rule));
        return isAllowed;
    }

    /**
     * Main crawl loop (Phase 1: Crawl & Collect).
     */
    async function processQueue() {
        if (queue.length === 0) {
            await finishCrawl();
            return;
        }

        const { url: currentUrl, depth } = queue.shift();
        
        if (depth > maxDepthValue) {
            processQueue(); 
            return;
        }
        
        if (crawledUrls.has(currentUrl)) {
            processQueue();
            return;
        }

        if (!isAllowedByRobots(currentUrl)) {
            console.log(`Skipped by robots.txt: ${currentUrl}`);
            const mockPageInfo = {
                title: '[محظور بـ robots.txt]',
                status: 'Skipped',
                wordCount: 0,
                outgoingLinks: [],
                incomingLinkCount: 0,
                depth: depth
            };
            addIssue(currentUrl,
                mockPageInfo,
                'محظور بـ robots.txt',
                SEVERITY.INFO, { text: 'تم تخطي الزحف لهذه الصفحة احترامًا لقواعد robots.txt.' }
            );
            setTimeout(processQueue, 1);
            return;
        }

        crawledUrls.add(currentUrl);
        updateProgress(crawledUrls.size, crawledUrls.size + queue.length, `المرحلة الأولى: يتم الآن فحص ${currentUrl}`);

        try {
            const proxyUrl = `https://throbbing-dew-da3c.amr-omar304.workers.dev/?url=${encodeURIComponent(currentUrl)}`;
            const response = await fetch(proxyUrl);
            await analyzeResponse(response, currentUrl, depth);
        } catch (error) {
            console.error(`فشل جلب ${currentUrl}:`, error);
            const errorInfo = { status: 'Error: Fetch Failed', depth: depth, title: '[فشل جلب الصفحة]', outgoingLinks: [], incomingLinkCount: 0, wordCount: 0 };
            addIssue(currentUrl, errorInfo, 'خطأ فادح في الجلب', SEVERITY.CRITICAL, { text: `فشل الاتصال بالرابط ${currentUrl}. قد يكون الخادم معطلاً.` });

        }

        setTimeout(processQueue, crawlDelayValue);
    }

    /**
     * Analyzes the fetched response and consolidates data based on the canonical URL.
     */
    async function analyzeResponse(response, currentUrl, depth) {
        const pageInfo = {
            status: response.status,
            depth: depth,
            title: '[لا يوجد عنوان]',
            description: '',
            h1s: [],
            canonical: normalizeUrl(currentUrl),
            isNoIndex: false,
            isNoFollow: false,
            wordCount: 0,
            outgoingLinks: [],
            incomingLinkCount: 0,
        };

        if (response.ok && (response.headers.get('Content-Type') || '').includes('text/html')) {
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            pageInfo.title = doc.querySelector('title')?.innerText.trim() || '[لا يوجد عنوان]';
            pageInfo.description = doc.querySelector('meta[name="description"]')?.content.trim() || '';
            pageInfo.h1s = Array.from(doc.querySelectorAll('h1')).map(h => h.innerText.trim()).filter(Boolean);

            const canonicalLink = doc.querySelector('link[rel="canonical"]');
            if (canonicalLink && canonicalLink.href) {
                try {
                    pageInfo.canonical = normalizeUrl(new URL(canonicalLink.href, currentUrl).href);
                } catch (e) { /* Keep default */ }
            }

            const robotsMeta = doc.querySelector('meta[name="robots"]');
            const robotsContent = robotsMeta ? robotsMeta.content.toLowerCase() : '';
            pageInfo.isNoIndex = robotsContent.includes('noindex');
            pageInfo.isNoFollow = robotsContent.includes('nofollow');
            pageInfo.wordCount = (doc.body?.textContent || "").trim().split(/\s+/).filter(Boolean).length;

            collectLinks(doc, currentUrl, pageInfo, depth);
        } else if (!response.ok) {
            pageInfo.title = '[فشل الزحف]';
        }
        
        const canonicalUrl = pageInfo.canonical;

        if (!pageData.has(canonicalUrl)) {
            pageInfo.nonCanonicalSources = new Map();
            pageData.set(canonicalUrl, pageInfo);
        } else {
            const masterData = pageData.get(canonicalUrl);
            masterData.outgoingLinks.push(...pageInfo.outgoingLinks);
            masterData.nonCanonicalSources.set(currentUrl, {
                status: pageInfo.status,
                isNoIndex: pageInfo.isNoIndex
            });
        }
    }


    /**
     * Extracts all links from a document.
     */
    function collectLinks(doc, sourceUrl, pageInfo, depth) {
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
                
                if (absoluteUrl.startsWith(origin) && !crawledUrls.has(absoluteUrl) && !queue.some(q => q.url === absoluteUrl)) {
                    if ((depth + 1) <= maxDepthValue) {
                        queue.push({ url: absoluteUrl, depth: depth + 1 });
                    }
                }
            } catch (e) { console.warn(`رابط غير صالح في الصفحة ${sourceUrl}: ${href}`); }
        });

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
     * Phase 2: Analyze & Report.
     */
    async function finishCrawl() {
        const linksArray = Array.from(allFoundLinks);
        for (let i = 0; i < linksArray.length; i++) {
            updateProgress(i + 1, linksArray.length, `المرحلة الثانية: فحص حالة الروابط (${i + 1}/${linksArray.length})`);
            await checkLinkStatus(linksArray[i]);
        }

        updateProgress(0, 1, 'المرحلة الثالثة: جاري تجميع التقرير النهائي...');
        buildFinalReport();
        displayResults();

        // --- [مدمج من النسخة الحديثة] Logic for Site Visualizer ---
        const visualizerData = generateVisualizerData();
        if (visualizerData) {
            if (visualizerActionsContainer) visualizerActionsContainer.classList.remove('d-none');
            if (copyVisualizerDataBtn) {
                copyVisualizerDataBtn.onclick = () => {
                    copyToClipboard(visualizerData);
                    try {
                        sessionStorage.setItem('ai8v_crawl_data', visualizerData);
                    } catch (e) {
                         console.error("Could not write to sessionStorage:", e);
                         showAppToast('فشل حفظ البيانات للجلسة الحالية، قد يكون حجمها كبيرًا.', 'error');
                    }
                };
            }
            try {
                sessionStorage.setItem('ai8v_crawl_data', visualizerData);
            } catch (e) {
                console.error("Could not write to sessionStorage:", e);
                showAppToast('فشل حفظ البيانات للجلسة الحالية، قد يكون حجمها كبيرًا.', 'error');
            }
        }
        // --- نهاية الجزء المدمج ---

        startCrawlBtn.disabled = false;
        startCrawlBtn.innerHTML = `<i class="bi bi-search ms-2"></i>ابدأ الفحص`;
        statusBar.style.width = '100%';
        statusText.innerText = `اكتمل الفحص! تم العثور على ${finalReport.length} مشكلة.`;
    }

    /**
     * [تم التعديل] Checks the HTTP status of a single URL with a timeout.
     */
    async function checkLinkStatus(url) {
        if (linkStatusCache.has(url)) return;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 ثواني مهلة

        try {
            const proxyUrl = `https://throbbing-dew-da3c.amr-omar304.workers.dev/?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl, {
                method: 'HEAD',
                mode: 'cors',
                signal: controller.signal
            });
            linkStatusCache.set(url, { error: !response.ok, status: response.status });
        } catch (e) {
            if (e.name === 'AbortError') {
                // حدث هذا بسبب انتهاء المهلة الزمنية
                linkStatusCache.set(url, { error: true, status: 'Error: Timeout' });
            } else {
                // خطأ آخر في الشبكة أو الاتصال
                linkStatusCache.set(url, { error: true, status: 'Error: Host' });
            }
        } finally {
            // قم بإلغاء المهلة الزمنية في كل الأحوال لتجنب تسريب الموارد
            clearTimeout(timeoutId);
        }
    }

    /**
     * Helper to add a new issue to the final report.
     */
    function addIssue(sourceUrl, pageInfo, issueType, issueSeverity, issueDetails) {
        finalReport.push({
            sourcePage: sourceUrl,
            pageTitle: pageInfo.title,
            pageStatus: pageInfo.status,
            wordCount: pageInfo.wordCount,
            outgoingLinkCount: pageInfo.outgoingLinks.length,
            incomingLinkCount: pageInfo.incomingLinkCount,
            depth: pageInfo.depth,
            issueType: issueType,
            issueSeverity: issueSeverity,
            issueDetails: issueDetails,
        });
    }

    /**
     * [تمت الترقية من النسخة الحديثة] Builds the final report by checking every page for all types of issues.
     */
    function buildFinalReport() {
        const incomingLinksMap = new Map();
        for (const data of pageData.values()) {
            data.outgoingLinks.forEach(link => {
                if (link.url.startsWith(origin)) {
                    incomingLinksMap.set(link.url, (incomingLinksMap.get(link.url) || 0) + 1);
                }
            });
        }
        for (const data of pageData.values()) {
            data.incomingLinkCount = incomingLinksMap.get(data.canonical) || 0;
        }

        const titleMap = new Map();
        const descriptionMap = new Map();

        for (const [canonicalUrl, data] of pageData.entries()) {
            if (data.status >= 400) addIssue(canonicalUrl, data, 'خطأ زحف', SEVERITY.CRITICAL, { text: `الصفحة الأساسية أعادت رمز الحالة ${data.status}` });
            data.outgoingLinks.forEach(link => {
                const statusInfo = linkStatusCache.get(link.url);
                if (statusInfo && statusInfo.error) addIssue(canonicalUrl, data, 'رابط تالف', SEVERITY.CRITICAL, { errorLink: link.url, errorType: statusInfo.status, anchorText: link.anchor, linkType: link.type });
            });
            if (data.isNoIndex) addIssue(canonicalUrl, data, 'ممنوعة من الفهرسة (Noindex)', SEVERITY.HIGH, { text: 'تحتوي على وسم "noindex".' });
            if (data.isNoFollow) addIssue(canonicalUrl, data, 'الروابط لا تتبع (Nofollow)', SEVERITY.INFO, { text: 'تحتوي على وسم "nofollow".' });
            if (!data.title || data.title === '[لا يوجد عنوان]') addIssue(canonicalUrl, data, 'عنوان مفقود', SEVERITY.HIGH, { text: 'وسم <title> فارغ أو مفقود.' });
            else {
                const titleKey = data.title.toLowerCase().trim();
                if (!titleMap.has(titleKey)) titleMap.set(titleKey, []);
                titleMap.get(titleKey).push(canonicalUrl);
            }
            if (!data.description) addIssue(canonicalUrl, data, 'وصف ميتا مفقود', SEVERITY.MEDIUM, { text: 'وسم <meta name="description"> فارغ أو مفقود.' });
            else {
                const descKey = data.description.toLowerCase().trim();
                if (!descriptionMap.has(descKey)) descriptionMap.set(descKey, []);
                descriptionMap.get(descKey).push(canonicalUrl);
            }
            if (data.h1s.length === 0) addIssue(canonicalUrl, data, 'H1 مفقود', SEVERITY.HIGH, { text: 'الصفحة لا تحتوي على وسم <h1>.' });
            else if (data.h1s.length > 1) addIssue(canonicalUrl, data, 'H1 متعدد', SEVERITY.LOW, { text: `تم العثور على ${data.h1s.length} وسوم H1.`, h1s: data.h1s });
            if (data.wordCount < LOW_WORD_COUNT_THRESHOLD && data.status < 400) addIssue(canonicalUrl, data, 'محتوى ضعيف', SEVERITY.MEDIUM, { text: `عدد الكلمات (${data.wordCount}) أقل من (${LOW_WORD_COUNT_THRESHOLD}).` });
            if (normalizeUrl(canonicalUrl) !== data.canonical) addIssue(canonicalUrl, data, 'Canonical خاطئ', SEVERITY.HIGH, { text: `الرابط الأساسي المحدد لا يطابق رابط الصفحة.`, canonical: data.canonical });
            if (data.incomingLinkCount === 0 && data.depth > 0) addIssue(canonicalUrl, data, 'صفحة يتيمة', SEVERITY.HIGH, { text: 'لم يتم العثور على روابط داخلية لهذه الصفحة.' });
            if (data.nonCanonicalSources) {
                for (const [sourceUrl, sourceInfo] of data.nonCanonicalSources.entries()) {
                    if (sourceInfo.status >= 400) addIssue(canonicalUrl, data, 'نسخة بديلة بها خطأ', SEVERITY.HIGH, { text: `الرابط ${sourceUrl} (الذي يشير إلى هذا الكانونيكال) أعاد الحالة ${sourceInfo.status}.` });
                    if (sourceInfo.isNoIndex) addIssue(canonicalUrl, data, 'نسخة بديلة ممنوعة من الفهرسة', SEVERITY.MEDIUM, { text: `الرابط ${sourceUrl} يحتوي على وسم noindex ولكنه يشير إلى هذه الصفحة.` });
                }
            }
        }
        for (const [title, urls] of titleMap.entries()) { if (urls.length > 1) { urls.forEach(url => addIssue(url, pageData.get(url), 'عنوان مكرر', SEVERITY.HIGH, { text: `مكرر في ${urls.length} صفحات.`, duplicates: urls })); } }
        for (const [desc, urls] of descriptionMap.entries()) { if (urls.length > 1) { urls.forEach(url => addIssue(url, pageData.get(url), 'وصف ميتا مكرر', SEVERITY.MEDIUM, { text: `مكرر في ${urls.length} صفحات.`, duplicates: urls })); } }
        finalReport.sort((a, b) => a.issueSeverity.level - b.issueSeverity.level);
    }


    /**
     * [تمت الترقية من النسخة الحديثة] Renders the final report into the HTML table.
     */
    function displayResults() {
        resultsSection.classList.remove('d-none');
        if (finalReport.length === 0) {
            resultsTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-success fw-bold p-4">رائع! لم يتم العثور على أي مشاكل تقنية.</td></tr>`;
            exportCsvBtn.classList.add('d-none');
            return;
        }
        const formatDetails = (issue) => {
            switch (issue.issueType) {
                case 'رابط تالف': return `<div class="d-flex flex-column"><span class="text-danger fw-bold">الخطأ: ${issue.issueDetails.errorType}</span><a href="${issue.issueDetails.errorLink}" target="_blank" class="text-truncate" style="max-width: 250px;" title="${issue.issueDetails.errorLink}">${issue.issueDetails.errorLink}</a><small class="text-muted">نص الرابط: <em>${issue.issueDetails.anchorText}</em></small></div>`;
                case 'عنوان مكرر': case 'وصف ميتا مكرر': const otherPages = issue.issueDetails.duplicates.filter(d => d !== issue.sourcePage); return `${issue.issueDetails.text} <a tabindex="0" class="badge bg-primary-subtle text-primary-emphasis rounded-pill" role="button" data-bs-toggle="popover" data-bs-trigger="focus" title="الصفحات المكررة" data-bs-content="${otherPages.join('<br>')}">${otherPages.length > 0 ? otherPages.length : ''}</a>`;
                case 'H1 متعدد': return `${issue.issueDetails.text}<br><small class="text-muted" dir="ltr">${issue.issueDetails.h1s.join(' | ')}</small>`;
                case 'Canonical خاطئ': return `<div class="d-flex flex-column"><span>الرابط المحدد:</span><small class="text-muted text-truncate" style="max-width: 250px;" title="${issue.issueDetails.canonical}">${issue.issueDetails.canonical}</small></div>`;
                case 'نسخة بديلة بها خطأ': case 'نسخة بديلة ممنوعة من الفهرسة': return `<div class="d-flex flex-column"><span class="fw-bold">${issue.issueDetails.text}</span></div>`;
                default: return issue.issueDetails.text || 'N/A';
            }
        };
        resultsTableBody.innerHTML = finalReport.map(res => `<tr><td><span class="badge ${res.issueSeverity.class}">${res.issueSeverity.text}</span></td><td class="fw-bold">${res.issueType}</td><td class="text-truncate" style="max-width: 150px;"><a href="${res.sourcePage}" target="_blank" title="${res.sourcePage}">${res.sourcePage}</a></td><td>${formatDetails(res)}</td><td class="text-truncate" style="max-width: 150px;" title="${res.pageTitle}">${res.pageTitle}</td><td><span class="badge bg-${String(res.pageStatus).startsWith('2') ? 'success' : String(res.pageStatus).startsWith('S') ? 'info' : 'warning'}">${res.pageStatus}</span></td><td>${res.wordCount}</td><td>${res.outgoingLinkCount}</td><td>${res.incomingLinkCount}</td><td>${res.depth}</td></tr>`).join('');
        [...document.querySelectorAll('[data-bs-toggle="popover"]')].map(el => new bootstrap.Popover(el, { html: true }));
        exportCsvBtn.classList.remove('d-none');
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
            showAppToast('لا توجد بيانات لتصديرها.', 'error'); // [مدمج] استخدام التنبيه المحسن
            return;
        }

        const headers = ["الأهمية", "نوع المشكلة", "الصفحة المصدر (الأساسية)", "التفاصيل", "عنوان الصفحة", "حالة الصفحة", "عدد الكلمات", "الروابط الصادرة", "الروابط الواردة", "عمق الصفحة"];
        const escapeCsvField = (field) => {
            const str = String(field ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        const formatDetailsForCsv = (issue) => {
            switch (issue.issueType) {
                case 'رابط تالف':
                    return `الرابط: ${issue.issueDetails.errorLink}, الحالة: ${issue.issueDetails.errorType}, نص الرابط: ${issue.issueDetails.anchorText}`;
                case 'عنوان مكرر':
                case 'وصف ميتا مكرر':
                    return `${issue.issueDetails.text} الصفحات الأخرى: ${issue.issueDetails.duplicates.slice(1).join('; ')}`;
                case 'H1 متعدد':
                    return `الوسوم: ${issue.issueDetails.h1s.join(' | ')}`;
                case 'Canonical خاطئ':
                    return `الرابط المحدد: ${issue.issueDetails.canonical}`;
                default:
                    return issue.issueDetails.text || '';
            }
        };

        const csvRows = [headers.join(',')];
        for (const row of finalReport) {
            const values = [
                row.issueSeverity.text, row.issueType, row.sourcePage, formatDetailsForCsv(row),
                row.pageTitle, row.pageStatus, row.wordCount, row.outgoingLinkCount,
                row.incomingLinkCount, row.depth
            ].map(escapeCsvField);
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ai8V_Tech_Audit_Report_${origin.replace(/https?:\/\//, '')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Event Listeners ---
    startCrawlBtn.addEventListener('click', async () => {
        if (!initializeCrawl()) {
            return;
        }

        updateProgress(0, 1, 'المرحلة 0: جارِ جلب وفهم ملف robots.txt...');
        try {
            const robotsUrl = `${origin}/robots.txt`;
            const proxyUrl = `https://throbbing-dew-da3c.amr-omar304.workers.dev/?url=${encodeURIComponent(robotsUrl)}`;
            const response = await fetch(proxyUrl);
            if (response.ok) {
                const text = await response.text();
                robotsRules = parseRobotsTxt(text);
                console.log("Parsed robots.txt rules:", robotsRules);
            } else {
                console.warn(`Could not fetch robots.txt (status: ${response.status}), assuming all is allowed.`);
                robotsRules = { allow: [], disallow: [] }; 
            }
        } catch (e) {
            console.warn("Could not fetch robots.txt, assuming all is allowed.", e);
            robotsRules = { allow: [], disallow: [] };
        }

        processQueue();
    });
    exportCsvBtn.addEventListener('click', exportToCsv);

})();
