const exportedModules = (function () {
    'use strict';

    // ===================================================================================
    // MODULE: StateManager
    // ===================================================================================
    const StateManager = (function () {
        const DEFAULT_BASE_SCHEMA_OBJ = { "@context": "https://schema.org", "@type": ["WebSite", "Organization"], "@id": "https://example.com/#website", name: "Your Organization Name", url: "https://example.com", logo: "https://example.com/logo.png", sameAs: ["https://www.facebook.com/your-profile", "https://twitter.com/your-profile"], potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: "https://example.com/search?q={search_term_string}" }, "query-input": "required name=search_term_string" } };
        const DEFAULT_BASE_SCHEMA_STR = JSON.stringify(DEFAULT_BASE_SCHEMA_OBJ, null, 2);
        const appState = { searchIndex: [], manualPages: [], analyzedFiles: [], sitemapUrls: [], robotsUrls: [], manifestData: {}, filteredResults: [], selectedItemIds: new Set(), schemaConfig: { baseUrl: '', pageSchemaType: 'WebPage', baseSchema: DEFAULT_BASE_SCHEMA_STR }, architectRecommendations: [] };
        const CONSTANTS = { PROJECTS_MASTER_KEY: 'Ai8V_ProjectsDB', LAST_PROJECT_KEY: 'searchIndexGenerator_lastProject', VIRTUAL_SCROLL_CHUNK_SIZE: 15 };
        function resetAppState() {
            Object.assign(appState, { searchIndex: [], manualPages: [], analyzedFiles: [], sitemapUrls: [], robotsUrls: [], manifestData: {}, filteredResults: [], schemaConfig: { baseUrl: '', pageSchemaType: 'WebPage', baseSchema: DEFAULT_BASE_SCHEMA_STR }, architectRecommendations: [] });
            appState.selectedItemIds.clear();
        }
        return { appState, CONSTANTS, DEFAULT_BASE_SCHEMA_STR, resetAppState };
    })();

    // ===================================================================================
    // MODULE: DOMManager
    // ===================================================================================
    const DOMManager = (function () {
        const dom = {};
        const domIds = ['darkModeToggle', 'liveCounter', 'counterValue', 'logDataInput', 'logDataLabel', 'seoCrawlerUrl', 'seoCrawlerDepth', 'seoCrawlerConcurrency', 'seoCrawlerDelay', 'seoCrawlerNoSaveHtml', 'proxySelector', 'customProxyUrl', 'urlInput', 'manualInput', 'manualInputSection', 'projectSelector', 'projectNameInput', 'showAnalyticsBtn', 'analyticsModal', 'sourceDistributionChart', 'topKeywordsChart', 'averageSeoScoreChart', 'seoScoreText', 'orphanPagesCard', 'orphanPagesCount', 'viewOrphanPagesBtn', 'filterSection', 'categoryFilter', 'keywordFilter', 'orphanFilter', 'selectionControls', 'selectionCounter', 'results', 'resultsAccordion', 'resultsPlaceholder', 'exportButtons', 'downloadJsonBtn', 'downloadCsvBtn', 'downloadZipBtn', 'toggleCopyBtn', 'exportReportBtn', 'zipProgress', 'zipProgressBar', 'copyOptions', 'schemaGeneratorSection', 'schemaBaseUrl', 'schemaPageType', 'schemaBaseEditor', 'crawlerStatus', 'crawlerCurrentUrl', 'crawlerProgressBar', 'crawlerProgressText', 'crawlerQueueCount', 'urlsFileInput', 'resultItemTemplate', 'robotsDropZone', 'robotsFileInput', 'manifestDropZone', 'manifestFileInput', 'sitemapDropZone', 'sitemapFileInput', 'fileDropZone', 'htmlFileInput', 'reportModal', 'reportModalBody', 'printReportBtn', 'startCrawlerBtn', 'importUrlsFileBtn', 'addManualPageBtn', 'generateIndexBtn', 'saveProjectBtn', 'deleteProjectBtn', 'clearFormBtn', 'selectAllBtn', 'deselectAllBtn', 'hideCrawlerStatusBtn', 'generateSchemaBtn', 'advisor-list', 'advisorPlaceholder', 'advisor-count', 'architect-list', 'architectPlaceholder', 'architect-count', 'architect-tab-btn', 'visualizerModal', 'site-graph-container', 'visualizerPlaceholder', 'comparisonModal', 'projectASelector', 'projectBSelector', 'runComparisonBtn', 'comparison-results-container', 'comparisonPlaceholder', 'showVisualizerBtn', 'showComparisonBtn'];
        const getEl = (id) => document.getElementById(id);
        function init() { domIds.forEach(id => { const el = getEl(id); if (el) { dom[id] = el; } }); }
        return { init, dom, getEl };
    })();

    // ===================================================================================
    // MODULE: Utils
    // ===================================================================================
    const Utils = (function (DOM) {
        function showNotification(message, type = 'info', duration = 5000) {
            const container = document.querySelector('.toast-container');
            if (!container) return;
            const colors = { info: 'bg-info text-white', success: 'bg-success text-white', warning: 'bg-warning text-dark', danger: 'bg-danger text-white' };
            const toast = Object.assign(document.createElement('div'), { id: 'toast-' + Date.now(), className: `toast align-items-center ${colors[type]} border-0`, role: 'alert', 'aria-live': 'assertive', 'aria-atomic': 'true' });
            toast.innerHTML = `<div class="d-flex align-items-center"><div class="toast-body flex-grow-1">${message}</div><button type="button" class="btn-close ${type === 'warning' ? 'btn-close-dark' : 'btn-close-white'} ms-2" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
            container.appendChild(toast);
            const bsToast = new bootstrap.Toast(toast, { delay: duration }); bsToast.show();
            toast.addEventListener('hidden.bs.toast', () => toast.remove());
        }
        function getProxyUrl(targetUrl) {
            const proxyTemplate = DOM.dom.proxySelector.value;
            if (proxyTemplate === 'custom') {
                const customProxy = DOM.dom.customProxyUrl.value.trim();
                return customProxy ? customProxy.replace('{url}', encodeURIComponent(targetUrl)) : targetUrl;
            }
            return proxyTemplate.replace('{url}', encodeURIComponent(targetUrl));
        }
        const downloadFile = (blob, filename) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); };
        const readFileContent = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = e => resolve(e.target.result); reader.onerror = reject; reader.readAsText(file); });
        return { showNotification, getProxyUrl, downloadFile, readFileContent };
    })(DOMManager);

    // ===================================================================================
    // MODULE: Analyzer
    // ===================================================================================
    const Analyzer = (function () {
        function analyzeHtmlContent(content, urlOrFilename, options = {}) {
            const doc = new DOMParser().parseFromString(content, 'text/html');
            const isUrl = urlOrFilename.startsWith('http');
            const url = isUrl ? new URL(urlOrFilename) : null;
            const filename = isUrl ? (url.pathname.split('/').pop() || 'index.html') : urlOrFilename;
            const pageHostname = url?.hostname || window.location.hostname;
            const outgoingInternalLinks = new Set();
            let internalLinks = 0, externalLinks = 0;
            doc.querySelectorAll('a[href]').forEach(a => {
                const href = a.getAttribute('href');
                if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
                try {
                    const linkUrl = new URL(href, urlOrFilename);
                    if (linkUrl.hostname === pageHostname) {
                        internalLinks++;
                        outgoingInternalLinks.add(linkUrl.pathname);
                    } else if (linkUrl.protocol.startsWith('http')) {
                        externalLinks++;
                    }
                } catch {
                    if (!/^(https?:)?\/\//.test(href)) {
                        internalLinks++;
                        outgoingInternalLinks.add(href.split('#')[0].split('?')[0]);
                    }
                }
            });
            let pageTypeHint = 'generic';
            const lowerUrl = urlOrFilename.toLowerCase();
            if (lowerUrl.includes('/blog/') || lowerUrl.includes('/article/')) pageTypeHint = 'article';
            else if (lowerUrl.includes('/product')) pageTypeHint = 'product';
            else if (lowerUrl.includes('/contact')) pageTypeHint = 'contact';
            else if (lowerUrl.includes('/about')) pageTypeHint = 'about';
            else if (filename === 'index.html' || url?.pathname === '/') pageTypeHint = 'homepage';
            
            const title = doc.querySelector('title')?.textContent.trim() || filename.replace(/\.(html?|htm)$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const descContent = doc.querySelector('meta[name="description"]')?.getAttribute('content') || doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
            const description = descContent || `صفحة ${title}`;
            
            let entities = { people: [], places: [], organizations: [], topics: [] };
            if (window.compromise) {
                const tempDiv = document.createElement('div');
                if (doc.body) {
                    tempDiv.innerHTML = doc.body.innerHTML;
                }
                const bodyText = tempDiv.textContent || "";
                
                if (bodyText) {
                    const nlpDoc = window.compromise(bodyText);
                    entities.people = nlpDoc.people().out('array');
                    entities.places = nlpDoc.places().out('array');
                    entities.organizations = nlpDoc.organizations().out('array');
                    const existingEntityText = [...entities.people, ...entities.places, ...entities.organizations].join(' ').toLowerCase();
                    entities.topics = nlpDoc.nouns().out('frequency')
                                         .filter(entry => entry.count > 1 && !existingEntityText.includes(entry.normal))
                                         .slice(0, 5).map(entry => entry.normal);
                }
            }

            const seoData = {
                h1: doc.querySelector('h1')?.textContent.trim() || null,
                lang: doc.documentElement.getAttribute('lang') || null,
                canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
                imageAltInfo: { total: doc.images.length, missing: [...doc.images].filter(img => !img.alt?.trim()).length },
                brokenLinksOnPage: [],
                loadTime: options.loadTime || null,
                isNoIndex: /noindex/i.test(doc.querySelector('meta[name="robots"]')?.content),
                isOrphan: false,
                isDefaultDescription: !descContent,
                internalLinkEquity: 0,
                ogTitle: doc.querySelector('meta[property="og:title"]')?.content || null,
                ogImage: doc.querySelector('meta[property="og:image"]')?.content || null,
                hasStructuredData: !!doc.querySelector('script[type="application/ld+json"]'),
                wordCount: (doc.body?.textContent.trim() || '').split(/\s+/).filter(Boolean).length,
                pageTypeHint,
                contentAnalysis: { internalLinks, externalLinks, outgoingInternalLinks: Array.from(outgoingInternalLinks) },
                entities: entities
            };
            const result = { filename, title, description, keywords: doc.querySelector('meta[name="keywords"]')?.content?.split(',').map(k => k.trim()).filter(Boolean) || [], url: isUrl ? url.pathname : '/' + filename, source: isUrl ? 'seo_crawler' : 'html_analysis', seo: seoData };
            if (options.saveHtmlContent) { result.content = content; }
            return result;
        }
        function calculateSeoScore(seo) {
            if (!seo) return { score: 0, maxScore: 9, color: '#6c757d', level: 'غير متوفر' };
            let score = 0; const maxScore = 9;
            if (seo.h1) score++;
            if (seo.canonical) score++;
            if (seo.imageAltInfo?.total > 0 && seo.imageAltInfo.missing === 0) score++;
            if (seo.brokenLinksOnPage?.length === 0) score++;
            if (!seo.isNoIndex) score++;
            if (seo.lang) score++;
            if (seo.ogTitle && seo.ogImage) score++;
            if (seo.hasStructuredData) score++;
            const thresholds = { article: 500, product: 250, homepage: 250, about: 50, contact: 50, generic: 300 };
            if (seo.wordCount >= (thresholds[seo.pageTypeHint] || thresholds.generic)) score++;
            const percentage = (score / maxScore) * 100;
            if (percentage >= 80) return { score, maxScore, color: '#198754', level: 'ممتاز' };
            if (percentage >= 50) return { score, maxScore, color: '#ffc107', level: 'جيد' };
            return { score, maxScore, color: '#dc3545', level: 'يحتاج لمراجعة' };
        }
        function extractTagsFromUrl(url) {
            if (!url) return [];
            if (url === '/') return ['الرئيسية'];
            try {
                const path = new URL(url, url.startsWith('http') ? undefined : 'http://dummy.com').pathname;
                const parts = path.split('/').filter(Boolean);
                const tags = parts.flatMap(p => p.replace(/\.[^/.]+$/, '').split(/[-_\s]+/)).filter(p => p.length > 2);
                const translations = { 'index': 'الرئيسية', 'home': 'الرئيسية', 'about': 'من نحن', 'contact': 'اتصل بنا', 'services': 'خدمات', 'products': 'منتجات', 'blog': 'مدونة', 'news': 'أخبار', 'portfolio': 'أعمال', 'team': 'فريق', 'pricing': 'أسعار', 'faq': 'أسئلة شائعة' };
                tags.forEach(tag => { if (translations[tag.toLowerCase()]) tags.push(translations[tag.toLowerCase()]); });
                return [...new Set(tags.map(t => t.toLowerCase()))];
            } catch (e) { return []; }
        }
        return { analyzeHtmlContent, calculateSeoScore, extractTagsFromUrl };
    })();

    // ===================================================================================
// MODULE: UIManager
// ===================================================================================
const UIManager = (function (State, DOM, Analyzer, Utils) {
    let sourceChartInstance, keywordsChartInstance, seoScoreChartInstance, scrollObserver;

    // --- Getters for DOM values ---
    const getProjectName = () => DOM.dom.projectNameInput.value.trim();
    const getSelectedProjectName = () => DOM.dom.projectSelector.value;
    const getSeoCrawlerConfig = () => ({ baseUrl: DOM.dom.seoCrawlerUrl.value.trim(), maxDepth: parseInt(DOM.dom.seoCrawlerDepth.value, 10) || 0, concurrency: parseInt(DOM.dom.seoCrawlerConcurrency.value, 10) || 3, crawlDelay: parseInt(DOM.dom.seoCrawlerDelay.value, 10) || 100, saveHtmlContent: !DOM.dom.seoCrawlerNoSaveHtml.checked });
    const getUrlInput = () => DOM.dom.urlInput.value.trim();
    const getCustomProxyUrl = () => DOM.dom.customProxyUrl.value.trim();
    const getManualPageData = () => ({ title: DOM.getEl('pageTitle').value.trim(), url: DOM.getEl('pageUrl').value.trim(), description: DOM.getEl('pageDescription').value.trim(), category: DOM.getEl('pageCategory').value.trim(), tags: DOM.getEl('pageTags').value.split(',').map(t => t.trim()).filter(Boolean) });
    const getFilterState = () => ({ category: DOM.dom.categoryFilter.value, keyword: DOM.dom.keywordFilter.value.toLowerCase(), isOrphan: DOM.dom.orphanFilter.checked });
    const getSchemaConfigFromDOM = () => ({ baseUrl: DOM.dom.schemaBaseUrl.value.trim(), pageSchemaType: DOM.dom.schemaPageType.value, baseSchema: DOM.dom.schemaBaseEditor.value });
    const isManualInputChecked = () => DOM.dom.manualInput.checked;

    // --- Form State Management ---
    const setFormValues = (projectData) => {
        DOM.dom.urlInput.value = projectData.urlInput || '';
        DOM.dom.customProxyUrl.value = projectData.customProxyUrl || '';
        DOM.dom.projectNameInput.value = projectData.name || '';
        DOM.dom.orphanFilter.checked = false;
        const schemaConfig = projectData.schemaConfig || {};
        DOM.dom.schemaBaseUrl.value = schemaConfig.baseUrl || '';
        DOM.dom.schemaPageType.value = schemaConfig.pageSchemaType || 'WebPage';
        DOM.dom.schemaBaseEditor.value = schemaConfig.baseSchema || State.DEFAULT_BASE_SCHEMA_STR;
    };
    const clearManualPageForm = () => ['pageTitle', 'pageUrl', 'pageDescription', 'pageCategory', 'pageTags'].forEach(id => DOM.getEl(id).value = '');
    const clearFilterInputs = () => { DOM.dom.keywordFilter.value = ''; DOM.dom.categoryFilter.value = ''; DOM.dom.orphanFilter.checked = false; };

    // --- Dark Mode ---
    const setDarkMode = (isDark) => { document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light'); updateDarkModeButton(); };
    const updateDarkModeButton = () => {
        if (!DOM.dom.darkModeToggle) return;
        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        DOM.dom.darkModeToggle.innerHTML = isDark ? `<i class="bi bi-sun-fill"></i> <span class="d-none d-sm-inline">الوضع النهاري</span>` : `<i class="bi bi-moon-stars-fill"></i> <span class="d-none d-sm-inline">الوضع الليلي</span>`;
    };
    const toggleDarkMode = () => {
        const newIsDarkMode = document.documentElement.getAttribute('data-bs-theme') !== 'dark';
        localStorage.setItem('darkMode', String(newIsDarkMode));
        setDarkMode(newIsDarkMode);
        Utils.showNotification(`<i class="bi ${newIsDarkMode ? 'bi-moon-stars-fill' : 'bi-sun-fill'} ms-2"></i> تم تفعيل الوضع ${newIsDarkMode ? 'الليلي' : 'النهاري'}`, 'info');
    };

    // --- Core Rendering Logic (with Virtual Scrolling) ---

    function renderSeoSummary(seo, itemId) {
        if (!seo) return '';
        const createBadge = (text, type, title = '') => `<span class="badge bg-${type}" title="${title}">${text}</span>`;
        const pageTypeLabels = { 'generic': 'عامة', 'article': 'مقالة', 'product': 'منتج', 'contact': 'اتصال', 'about': 'من نحن', 'homepage': 'رئيسية' };
        
        let logHitsBadge = '';
        if (typeof seo.logHits === 'number') {
            const badgeType = seo.logHits > 0 ? 'info' : 'secondary';
            const title = seo.logHits > 0 ? `زار Googlebot هذه الصفحة ${seo.logHits} مرة` : 'لم يزر Googlebot هذه الصفحة';
            logHitsBadge = `<div class="seo-summary-item"><strong>زيارات Googlebot:</strong> ${createBadge(seo.logHits, badgeType, title)}</div>`;
        }

        let equityBadge = '';
        if (typeof seo.internalLinkEquity === 'number') {
            let badgeType = 'secondary';
            if (seo.internalLinkEquity > 10) badgeType = 'warning text-dark';
            else if (seo.internalLinkEquity > 3) badgeType = 'info';
            equityBadge = `<div class="seo-summary-item"><strong>قوة الصفحة:</strong> ${createBadge(seo.internalLinkEquity, badgeType, 'قوة الربط الداخلي: عدد الروابط الداخلية التي تشير لهذه الصفحة.')}</div>`;
        }

        return `<div class="mt-2 pt-2 border-top border-opacity-10">
                    <strong class="small text-body-secondary d-block mb-1">SEO أساسي:</strong>
                    ${logHitsBadge}
                    <div class="seo-summary-item"><strong>نوع الصفحة:</strong> ${createBadge(pageTypeLabels[seo.pageTypeHint] || 'غير محدد', 'primary')}</div>
                    ${equityBadge}
                    <div class="seo-summary-item"><strong>H1:</strong> ${createBadge(seo.h1 ? 'موجود' : 'مفقود', seo.h1 ? 'success' : 'danger')}</div>
                    <div class="seo-summary-item"><strong>Lang:</strong> ${createBadge(seo.lang || 'مفقود', seo.lang ? 'success' : 'danger')}</div>
                    <div class="seo-summary-item"><strong>Canonical:</strong> ${createBadge(seo.canonical ? 'موجود' : 'مفقود', seo.canonical ? 'success' : 'danger')}</div>
                    <div class="seo-summary-item"><strong>Img Alt:</strong> ${(seo.imageAltInfo?.total || 0) === 0 ? createBadge('لا يوجد', 'secondary') : createBadge(`${seo.imageAltInfo.total - seo.imageAltInfo.missing}/${seo.imageAltInfo.total}`, seo.imageAltInfo.missing === 0 ? 'success' : 'warning')}</div>
                    <div class="seo-summary-item"><strong>روابط مكسورة:</strong> ${seo.brokenLinksOnPage?.length > 0 ? `<span class="badge bg-danger cursor-pointer" data-bs-toggle="collapse" href="#brokenLinks-${itemId}">${seo.brokenLinksOnPage.length}</span><div class="collapse mt-2" id="brokenLinks-${itemId}"><ul class="list-group list-group-flush small">${seo.brokenLinksOnPage.map(l => `<li class="list-group-item list-group-item-danger py-1 px-2 text-break">${l}</li>`).join('')}</ul></div>` : createBadge('0', 'success')}</div>
                    <div class="seo-summary-item"><strong>OG Tags:</strong> ${createBadge(seo.ogTitle && seo.ogImage ? 'موجود' : 'ناقص', seo.ogTitle && seo.ogImage ? 'success' : 'warning', 'OG:Title/Image')}</div>
                    <div class="seo-summary-item"><strong>بيانات منظمة:</strong> ${createBadge(seo.hasStructuredData ? 'موجود' : 'مفقود', seo.hasStructuredData ? 'success' : 'secondary')}</div>
                    <div class="seo-summary-item"><strong>عدد الكلمات:</strong> ${createBadge(seo.wordCount || 0, (seo.wordCount || 0) > 300 ? 'success' : 'warning')}</div>
                </div>`;
    }

    const handleIntersection = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sentinel = entry.target;
                scrollObserver.unobserve(sentinel);
                handleLoadMore(sentinel);
            }
        });
    };

    const handleLoadMore = (sentinel) => {
        const accordionBody = sentinel.closest('.accordion-body');
        if (!accordionBody) return;
        const source = accordionBody.dataset.source;
        const offset = parseInt(accordionBody.dataset.renderedCount, 10);
        
        // **THE FIX** Get the correct list of items (filtered or full)
        const baseList = getCurrentActiveItemsList();
        const itemsForThisSource = baseList.filter(item => (item.source || 'unknown') === source);
        
        sentinel.remove();
        renderItemChunk(accordionBody, itemsForThisSource, offset);
    };

    function renderItemChunk(container, items, offset) {
        const fragment = document.createDocumentFragment();
        const itemsToRender = items.slice(offset, offset + State.CONSTANTS.VIRTUAL_SCROLL_CHUNK_SIZE);

        itemsToRender.forEach(item => {
            const { id, title, url, description, category, tags, seo } = item;
            const itemClone = DOM.dom.resultItemTemplate.content.cloneNode(true);
            const seoScore = Analyzer.calculateSeoScore(seo);
            const resultItemEl = itemClone.querySelector('.result-item');
            resultItemEl.dataset.id = id;
            resultItemEl.classList.toggle('selected', State.appState.selectedItemIds.has(id));
            const seoDot = itemClone.querySelector('.seo-score-dot');
            seoDot.style.backgroundColor = seoScore.color;
            seoDot.title = `تقييم SEO: ${seoScore.level} (${seoScore.score}/${seoScore.maxScore})`;
            itemClone.querySelector('.item-select-checkbox').checked = State.appState.selectedItemIds.has(id);
            itemClone.querySelector('.page-title').textContent = title;
            itemClone.querySelector('.no-index-badge').classList.toggle('d-none', !seo?.isNoIndex);
            itemClone.querySelector('.orphan-page-badge').classList.toggle('d-none', !seo?.isOrphan);
            itemClone.querySelector('.orphan-page-prompt').classList.toggle('d-none', !seo?.isOrphan);
            ['preview', 'edit', 'delete'].forEach(action => { const btn = itemClone.querySelector(`.btn-${action}`); if (btn) btn.setAttribute('aria-label', `${action}: ${title}`); });
            itemClone.querySelector('[data-populate="url"]').textContent = url;
            itemClone.querySelector('[data-populate="loadTime"]').textContent = seo?.loadTime ? `${seo.loadTime}ms` : '';
            itemClone.querySelector('[data-field="description"]').textContent = description;
            itemClone.querySelector('[data-field="category"]').textContent = category || '';
            itemClone.querySelector('[data-field="tags"]').textContent = (tags || []).join(', ');
            itemClone.querySelector('.seo-summary-container').innerHTML = renderSeoSummary(seo, id);

            const entitiesContainer = itemClone.querySelector('.entities-container');
            if (entitiesContainer && seo?.entities) {
                const { people, organizations, places, topics } = seo.entities;
                const entityHtml = [
                    ...(people || []).map(e => `<span class="badge bg-primary-subtle text-primary-emphasis me-1" title="شخص"><i class="bi bi-person-fill me-1"></i>${e}</span>`),
                    ...(organizations || []).map(e => `<span class="badge bg-info-subtle text-info-emphasis me-1" title="منظمة"><i class="bi bi-building-fill me-1"></i>${e}</span>`),
                    ...(places || []).map(e => `<span class="badge bg-warning-subtle text-warning-emphasis me-1" title="مكان"><i class="bi bi-geo-alt-fill me-1"></i>${e}</span>`),
                    ...(topics || []).map(e => `<span class="badge bg-secondary-subtle text-secondary-emphasis me-1" title="موضوع">${e}</span>`)
                ].join('');
                if (entityHtml.trim() !== '') {
                    entitiesContainer.innerHTML = `<strong class="text-muted d-inline-block mb-1">الكيانات المكتشفة:</strong><br>${entityHtml}`;
                } else {
                    entitiesContainer.innerHTML = '';
                }
            }
            
            fragment.appendChild(itemClone);
        });
        
        container.appendChild(fragment);
        const newRenderedCount = offset + itemsToRender.length;
        container.dataset.renderedCount = newRenderedCount;

        if (newRenderedCount < items.length) {
            const sentinel = Object.assign(document.createElement('div'), { className: 'scroll-sentinel' });
            container.appendChild(sentinel);
            scrollObserver.observe(sentinel);
        }
    }

    function renderAccordionGroup(source, items, index, shouldBeOpen) {
        const sourceLabels = { 'seo_crawler': `<i class="bi bi-robot ms-2"></i>زاحف SEO`, 'html_analysis': `<i class="bi bi-file-earmark-code-fill ms-2"></i>تحليل HTML`, 'manual': `<i class="bi bi-pencil-fill ms-2"></i>إدخال يدوي`, 'url_generation': `<i class="bi bi-link-45deg ms-2"></i>من الروابط`, 'sitemap': `<i class="bi bi-map-fill ms-2"></i>من Sitemap`, 'robots': `<i class="bi bi-robot ms-2"></i>من robots.txt`, 'unknown': 'غير معروف' };
        const collapseId = `collapse-source-${source.replace(/[^a-zA-Z0-9]/g, '-')}-${index}`;
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item bg-transparent';
        accordionItem.innerHTML = `<h2 class="accordion-header" id="heading-${collapseId}"><button class="accordion-button ${shouldBeOpen ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">${sourceLabels[source] || source} (${items.length})</button></h2><div id="${collapseId}" class="accordion-collapse collapse ${shouldBeOpen ? 'show' : ''}" data-bs-parent="#resultsAccordion"><div class="accordion-body" data-source="${source}" data-rendered-count="0"></div></div>`;
        DOM.dom.resultsAccordion.appendChild(accordionItem);
    }

    function displayResults(resultsToShow, openAccordionId) {
        const results = resultsToShow || getCurrentActiveItemsList();
        const hasResults = results.length > 0;
        const anyResultsAtAll = State.appState.searchIndex.length > 0;

        // Toggle UI elements based on whether there are any results at all
        DOM.dom.selectionControls.classList.toggle('d-none', !anyResultsAtAll);
        DOM.dom.exportButtons.classList.toggle('d-none', !anyResultsAtAll);
        DOM.dom.schemaGeneratorSection.classList.toggle('d-none', !anyResultsAtAll);
        DOM.dom.filterSection.classList.toggle('d-none', !anyResultsAtAll);
        DOM.dom.logDataLabel.classList.toggle('disabled', !anyResultsAtAll);
        DOM.dom.logDataInput.disabled = !anyResultsAtAll;
        DOM.dom.logDataLabel.title = anyResultsAtAll ? "استورد ملف JSON الذي تم تصديره من 'محلل السجلات'." : "يجب توليد قائمة صفحات أولاً.";
        
        // Handle placeholder visibility
        DOM.dom.resultsPlaceholder.classList.toggle('d-none', hasResults);

        // Clean up previous observers and content
        if (scrollObserver) { DOM.dom.resultsAccordion.querySelectorAll('.scroll-sentinel').forEach(el => scrollObserver.unobserve(el)); }
        DOM.dom.resultsAccordion.innerHTML = '';
        if (!hasResults) { updateSelectionUI(); return; }

        const grouped = results.reduce((acc, item) => { (acc[item.source || 'unknown'] = acc[item.source || 'unknown'] || []).push(item); return acc; }, {});
        
        // Render accordion groups
        Object.entries(grouped).forEach(([source, items], index) => {
            const collapseId = `collapse-source-${source.replace(/[^a-zA-Z0-9]/g, '-')}-${index}`;
            // **THE FIX** Determine if the accordion should be open smartly
            const shouldBeOpen = openAccordionId ? (collapseId === openAccordionId) : index === 0;
            renderAccordionGroup(source, items, index, shouldBeOpen);
            if (shouldBeOpen) {
                const accordionBody = DOM.dom.resultsAccordion.querySelector(`#${collapseId} .accordion-body`);
                if (accordionBody) { renderItemChunk(accordionBody, items, 0); }
            }
        });
        updateSelectionUI();
    }

    const handleAccordionShow = (event) => {
        const accordionBody = event.target.querySelector('.accordion-body');
        if (!accordionBody) return;
        const hasBeenRendered = parseInt(accordionBody.dataset.renderedCount, 10) > 0;
        if (!hasBeenRendered) {
            const source = accordionBody.dataset.source;
            const baseList = getCurrentActiveItemsList();
            const itemsForThisSource = baseList.filter(item => (item.source || 'unknown') === source);
            if(itemsForThisSource.length > 0) {
                renderItemChunk(accordionBody, itemsForThisSource, 0);
            }
        }
    };

    function getCurrentActiveItemsList() {
        const filters = getFilterState();
        return (filters.keyword || filters.category || filters.isOrphan) ? State.appState.filteredResults : State.appState.searchIndex;
    }
    
    // --- Selection UI ---
    function updateSelectionUI() {
        DOM.dom.selectionCounter.textContent = State.appState.selectedItemIds.size;
        DOM.dom.resultsAccordion.querySelectorAll('.result-item').forEach(itemDiv => {
            const itemId = parseInt(itemDiv.dataset.id, 10);
            if (isNaN(itemId)) return;
            const isSelected = State.appState.selectedItemIds.has(itemId);
            const checkbox = itemDiv.querySelector('.item-select-checkbox');
            if (checkbox) checkbox.checked = isSelected;
            itemDiv.classList.toggle('selected', isSelected);
        });
        updateSelectAllDeselectAllButtonsState();
    }
    
    function updateSelectAllDeselectAllButtonsState() {
        const activeItems = getCurrentActiveItemsList();
        const allCurrentlyVisibleOrFilteredAreSelected = activeItems.length > 0 && activeItems.every(item => State.appState.selectedItemIds.has(item.id));
        DOM.dom.selectAllBtn.disabled = activeItems.length === 0 || allCurrentlyVisibleOrFilteredAreSelected;
        const anyActiveItemSelected = activeItems.some(item => State.appState.selectedItemIds.has(item.id));
        DOM.dom.deselectAllBtn.disabled = activeItems.length === 0 || !anyActiveItemSelected;
    }
    
    // --- Analytics Dashboard ---
    const updateLiveCounter = () => {
        const count = State.appState.searchIndex.length;
        DOM.dom.liveCounter.classList.toggle('d-none', count === 0);
        if (count > 0) DOM.dom.counterValue.textContent = count;
    };
    
    const renderChart = (chartInstance, context, config) => {
        if (!config || !config.data) { if (chartInstance) { try { chartInstance.destroy(); } catch (e) {} } return null; }
        if (chartInstance) { chartInstance.data = config.data; try { chartInstance.update(); } catch (e) {} return chartInstance; }
        try { if (!context) return null; return new Chart(context, config); } catch (e) { return null; }
    };
    
    function updateAnalyticsDashboard() {
        const hasData = State.appState.searchIndex.length > 0;
        DOM.dom.showAnalyticsBtn.classList.toggle('d-none', !hasData);
        if (!hasData) {
            if (sourceChartInstance) { try { sourceChartInstance.destroy(); } catch(e){} sourceChartInstance = null; }
            if (keywordsChartInstance) { try { keywordsChartInstance.destroy(); } catch(e){} keywordsChartInstance = null; }
            if (seoScoreChartInstance) { try { seoScoreChartInstance.destroy(); } catch(e){} seoScoreChartInstance = null; }
            DOM.dom.orphanPagesCard.classList.add('d-none');
            return;
        }
        const themeColor = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'rgba(255, 255, 255, 0.85)' : '#495057';
        const sourceCounts = State.appState.searchIndex.reduce((acc, item) => { acc[item.source || 'unknown'] = (acc[item.source || 'unknown'] || 0) + 1; return acc; }, {});
        const sourceLabelsMap = { 'seo_crawler': `زاحف SEO`, 'html_analysis': `تحليل HTML`, 'manual': `إدخال يدوي`, 'url_generation': `من الروابط`, 'sitemap': `من Sitemap`, 'robots': `من robots.txt`, 'unknown': 'غير معروف' };
        sourceChartInstance = renderChart(sourceChartInstance, DOM.dom.sourceDistributionChart.getContext('2d'), { type: 'pie', data: { labels: Object.keys(sourceCounts).map(l => sourceLabelsMap[l] || l), datasets: [{ label: 'عدد الصفحات', data: Object.values(sourceCounts), backgroundColor: ['#4bc0c0', '#ff6384', '#ffcd56', '#36a2eb', '#9966ff', '#c9cbcf', '#ff9f40'] }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: themeColor, boxWidth: 12, padding: 15 } } } } });
        const keywordCount = State.appState.searchIndex.flatMap(item => item.tags || []).reduce((acc, keyword) => { if (keyword) acc[keyword] = (acc[keyword] || 0) + 1; return acc; }, {});
        const sortedKeywords = Object.entries(keywordCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
        keywordsChartInstance = renderChart(keywordsChartInstance, DOM.dom.topKeywordsChart.getContext('2d'), { type: 'bar', data: { labels: sortedKeywords.map(e => e[0]), datasets: [{ label: 'عدد التكرارات', data: sortedKeywords.map(e => e[1]), backgroundColor: 'rgba(75, 192, 192, 0.6)' }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: themeColor } }, y: { ticks: { color: themeColor } } } } });
        let totalScore = 0, maxPossibleScore = 0;
        State.appState.searchIndex.forEach(item => { const { score, maxScore } = Analyzer.calculateSeoScore(item.seo); totalScore += score; maxPossibleScore += maxScore; });
        const avgPercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
        DOM.dom.seoScoreText.textContent = `${Math.round(avgPercentage)}%`;
        const scoreColor = avgPercentage >= 80 ? '#4bc0c0' : avgPercentage >= 50 ? '#ffcd56' : '#ff6384';
        seoScoreChartInstance = renderChart(seoScoreChartInstance, DOM.dom.averageSeoScoreChart.getContext('2d'), { type: 'doughnut', data: { datasets: [{ data: [avgPercentage, 100 - avgPercentage], backgroundColor: [scoreColor, 'rgba(128, 128, 128, 0.2)'], circumference: 180, rotation: 270, cutout: '75%' }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { tooltip: { enabled: false } } } });
        const orphanCount = State.appState.searchIndex.filter(item => item.seo?.isOrphan).length;
        DOM.dom.orphanPagesCard.classList.toggle('d-none', orphanCount === 0);
        DOM.dom.orphanPagesCount.textContent = orphanCount;
    }

    // --- High-level UI Orchestration ---
    const updateFilterOptions = () => {
        const currentCategory = DOM.dom.categoryFilter.value;
        const categories = [...new Set(State.appState.searchIndex.map(item => item.category).filter(Boolean))].sort();
        DOM.dom.categoryFilter.innerHTML = '<option value="">جميع الفئات</option>';
        categories.forEach(cat => DOM.dom.categoryFilter.add(new Option(cat, cat, false, cat === currentCategory)));
    };

    function updateAllUI(openAccordionId = null) {
        const filters = getFilterState();
        const results = (filters.keyword || filters.category || filters.isOrphan) ? State.appState.filteredResults : null;
        displayResults(results, openAccordionId);
        updateAnalyticsDashboard();
        updateLiveCounter();
        updateFilterOptions();
    }
    
    // --- Edit Mode and Modals ---
    const showSerpPreview = (itemId) => {
        const item = State.appState.searchIndex.find(i => i.id === itemId);
        if (!item) return;
        DOM.getEl('previewUrl').textContent = item.url; DOM.getEl('previewTitle').textContent = item.title;
        DOM.getEl('previewDescription').textContent = item.description; DOM.getEl('titleCharCount').textContent = item.title.length;
        DOM.getEl('descCharCount').textContent = item.description.length;
    };
    
    const validateSchemaEditor = () => {
        const editor = DOM.dom.schemaBaseEditor;
        try { JSON.parse(editor.value); editor.classList.remove('is-invalid'); editor.classList.add('is-valid'); return true; } 
        catch { editor.classList.remove('is-valid'); editor.classList.add('is-invalid'); return false; }
    };
    
    const enterEditMode = (item, pageItem, editBtn) => {
        pageItem.classList.add('is-editing');
        pageItem.querySelectorAll('.editable-content').forEach((el, index) => {
            const field = el.dataset.field;
            const input = field === 'description' ? document.createElement('textarea') : document.createElement('input');
            if(field === 'description') input.rows = 3; else input.type = 'text';
            Object.assign(input, { className: 'form-control form-control-sm edit-input', value: Array.isArray(item[field]) ? item[field].join(', ') : item[field] });
            Object.assign(input.dataset, { editField: field, originalTag: el.tagName.toLowerCase(), originalClasses: el.className });
            el.replaceWith(input);
            if (index === 0) input.focus();
        });
        editBtn.innerHTML = 'حفظ';
        editBtn.classList.replace('btn-outline-secondary', 'btn-success');
    };
    
    const saveEditMode = (item, pageItem, editBtn, onSave) => {
        const titleInput = pageItem.querySelector('[data-edit-field="title"]');
        if (!titleInput.value.trim()) return Utils.showNotification('حقل العنوان لا يمكن أن يكون فارغاً!', 'danger');
        pageItem.querySelectorAll('[data-edit-field]').forEach(input => {
            const field = input.dataset.editField; const value = input.value.trim();
            item[field] = field === 'tags' ? value.split(',').map(t => t.trim()).filter(Boolean) : value;
            const staticEl = document.createElement(input.dataset.originalTag);
            Object.assign(staticEl, { className: input.dataset.originalClasses, textContent: value });
            staticEl.dataset.field = field; input.replaceWith(staticEl);
        });
        pageItem.classList.remove('is-editing');
        editBtn.innerHTML = 'تحرير';
        editBtn.classList.replace('btn-success', 'btn-outline-secondary');
        Utils.showNotification('تم حفظ التعديلات!', 'success');
        updateAnalyticsDashboard();
        if(onSave) onSave();
    };
    
    const updateProjectListDropdown = (currentProjectName) => {
        window.StorageManager.getProjectList().then(projects => {
            DOM.dom.projectSelector.innerHTML = '<option value="">-- اختر مشروعًا --</option>';
            projects.sort().forEach(p => DOM.dom.projectSelector.add(new Option(p, p, false, p === currentProjectName)));
        });
    };
    
    // --- Initialization ---
    const initObserver = () => {
        if (scrollObserver) scrollObserver.disconnect();
        scrollObserver = new IntersectionObserver(handleIntersection, { root: DOM.dom.results, rootMargin: '0px 0px 200px 0px' });
    };

    return { 
        getProjectName, getSelectedProjectName, getSeoCrawlerConfig, getUrlInput, getCustomProxyUrl, getManualPageData, 
        getFilterState, getSchemaConfigFromDOM, isManualInputChecked, setFormValues, clearManualPageForm, clearFilterInputs, 
        setDarkMode, toggleDarkMode, updateAllUI, handleAccordionShow, showSerpPreview, validateSchemaEditor, enterEditMode, 
        saveEditMode, updateProjectListDropdown, initObserver, updateAnalyticsDashboard, updateSelectionUI 
    };
})(StateManager, DOMManager, Analyzer, Utils);

    // ===================================================================================
    // MODULE: DataHandler
    // ===================================================================================
    const DataHandler = (function (State, Analyzer, UI) {
        function addItemsToIndex(itemsToAdd) {
            const existingUrls = new Set(State.appState.searchIndex.map(item => (item.url.endsWith('/') && item.url.length > 1 ? item.url.slice(0, -1) : item.url)));
            let idCounter = State.appState.searchIndex.length > 0 ? Math.max(0, ...State.appState.searchIndex.map(item => item.id)) + 1 : 1;
            let addedCount = 0;
            itemsToAdd.forEach(item => {
                const urlKey = item.url.endsWith('/') && item.url.length > 1 ? item.url.slice(0, -1) : item.url;
                if (!existingUrls.has(urlKey)) { item.id = idCounter++; State.appState.searchIndex.push(item); existingUrls.add(urlKey); addedCount++; }
            });
            return addedCount;
        }
        
        // ✅ THE FIX (PART 1): This function now robustly gathers data from ALL sources.
        function generateSearchIndexFromInputs(urlInputValue, isManualChecked) {
            const newItems = [];
            const existingUrlsInIndex = new Set(State.appState.searchIndex.map(item => (item.url.endsWith('/') && item.url.length > 1 ? item.url.slice(0, -1) : item.url)));
            const processedUrlsThisRun = new Set();
        
            const addItem = (item) => {
                if (!item || !item.url) return;
                const urlKey = item.url.endsWith('/') && item.url.length > 1 ? item.url.slice(0, -1) : item.url;
                if (!urlKey || existingUrlsInIndex.has(urlKey) || processedUrlsThisRun.has(urlKey)) return;
                newItems.push(item);
                processedUrlsThisRun.add(urlKey);
            };
        
            State.appState.analyzedFiles.forEach(file => addItem({ ...file, category: file.category || (file.source === 'seo_crawler' ? 'زاحف SEO' : 'تحليل تلقائي'), tags: file.keywords?.length > 0 ? file.keywords : Analyzer.extractTagsFromUrl(file.url), source: file.source || 'html_analysis' }));
            
            if (isManualChecked) {
                State.appState.manualPages.forEach(page => addItem({ ...page, source: 'manual' }));
            }
        
            const allUrlStrings = [
                ...urlInputValue.split('\n'),
                ...State.appState.sitemapUrls,
                ...State.appState.robotsUrls,
                ...(Array.isArray(State.appState.manifestData) ? State.appState.manifestData : [])
            ];
            const uniqueUrlStrings = [...new Set(allUrlStrings.map(url => url.trim()).filter(Boolean))];
        
            uniqueUrlStrings.forEach(urlStr => {
                const originalUrl = urlStr;
                let path;
                try {
                    path = new URL(originalUrl).pathname;
                } catch (e) {
                    path = originalUrl.startsWith('/') ? originalUrl : '/' + originalUrl;
                }
        
                const urlKey = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
                if (existingUrlsInIndex.has(urlKey) || processedUrlsThisRun.has(urlKey)) return;
        
                const fileName = path.split('/').pop().replace(/\.(html?|htm)$/, '');
                const category = path.split('/').filter(Boolean)[0] || 'عام';
                const titleMap = { 'index': 'الصفحة الرئيسية', 'about': 'من نحن', 'contact': 'اتصل بنا', 'services': 'خدماتنا', 'blog': 'المدونة' };
                const title = titleMap[fileName.toLowerCase()] || fileName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
                const source = State.appState.sitemapUrls.includes(originalUrl) ? 'sitemap' :
                               State.appState.robotsUrls.includes(originalUrl) ? 'robots' : 'url_generation';
                
                addItem({ title, description: `صفحة ${title}`, url: path, category: category.charAt(0).toUpperCase() + category.slice(1), tags: Analyzer.extractTagsFromUrl(path), source, seo: {} });
            });
        
            return newItems;
        }

        function addManualPage(pageData) {
            State.appState.manualPages.push({ ...pageData, url: pageData.url.startsWith('/') ? pageData.url : '/' + pageData.url, category: pageData.category || 'عام', seo: {} });
        }
        function deleteItem(itemId, onComplete) {
            const item = State.appState.searchIndex.find(i => i.id === itemId);
            if (!item) return;
            if (confirm(`هل أنت متأكد من حذف العنصر:\n"${item.title}"`)) {
                State.appState.searchIndex = State.appState.searchIndex.filter(i => i.id !== itemId);
                State.appState.filteredResults = State.appState.filteredResults.filter(i => i.id !== itemId);
                State.appState.selectedItemIds.delete(itemId);
                if (onComplete) onComplete();
            }
        }
        function getSelectedItems() {
            const filters = UI.getFilterState();
            const baseList = (filters.keyword || filters.category || filters.isOrphan) ? State.appState.filteredResults : State.appState.searchIndex;
            return State.appState.selectedItemIds.size === 0 ? baseList : State.appState.searchIndex.filter(item => State.appState.selectedItemIds.has(item.id));
        }
        return { addItemsToIndex, generateSearchIndexFromInputs, addManualPage, deleteItem, getSelectedItems };
    })(StateManager, Analyzer, UIManager);

 // ===================================================================================
// MODULE: ProjectManager
// ===================================================================================
const ProjectManager = (function (State, UI, Utils) {
    let saveTimeout;
    function getProjectDataForSave(projectName) {
        const projectData = JSON.parse(JSON.stringify(State.appState));
        projectData.name = projectName;
        projectData.urlInput = UI.getUrlInput();
        projectData.customProxyUrl = UI.getCustomProxyUrl();
        projectData.timestamp = new Date().toISOString();
        return projectData;
    }
    const debouncedSaveProject = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const projectName = UI.getProjectName();
            if (!projectName) return;
            try {
                const dataToSave = getProjectDataForSave(projectName);
                await window.StorageManager.saveProjectData(dataToSave);
            } catch (e) {
                Utils.showNotification('فشل الحفظ التلقائي: ' + e.message, 'danger');
            }
        }, 1500);
    };
    const clearCurrentState = () => {
        State.resetAppState();
        UI.setFormValues({ name: '', schemaConfig: { baseSchema: State.DEFAULT_BASE_SCHEMA_STR } });
        UI.clearFilterInputs();
        UI.validateSchemaEditor();
        UI.updateAllUI();
    };
    async function loadProject(projectName) {
        if (!projectName) { clearCurrentState(); return; }
        try {
            const data = await window.StorageManager.loadProjectData(projectName);
            if (data) {
                State.resetAppState();
                Object.assign(State.appState, data);
                State.appState.selectedItemIds = new Set(Array.from(data.selectedItemIds || []));
                UI.setFormValues(data);
                UI.validateSchemaEditor();
                localStorage.setItem(State.CONSTANTS.LAST_PROJECT_KEY, projectName);
                UI.updateAllUI();
                await UI.updateProjectListDropdown(projectName);
                Utils.showNotification(`تم تحميل مشروع "${projectName}"! <i class="bi bi-folder2-open ms-2"></i>`, 'info');
            } else {
                Utils.showNotification(`لم يتم العثور على مشروع باسم "${projectName}"`, 'warning');
            }
        } catch (e) {
            console.error("Failed to load project:", e);
            Utils.showNotification('خطأ في تحميل المشروع: ' + e.message, 'warning');
        }
    }
    async function deleteProject(projectName) {
        try {
            await window.StorageManager.deleteProjectData(projectName);
            await UI.updateProjectListDropdown();
            Utils.showNotification(`تم حذف المشروع "${projectName}"!`, 'success');
        } catch(e) {
            Utils.showNotification(`فشل حذف المشروع: ${e.message}`, 'danger');
        }
    }
    return { debouncedSaveProject, clearCurrentState, loadProject, deleteProject, getProjectDataForSave };
})(StateManager, UIManager, Utils);


    // ===================================================================================
    // MODULE: CoreFeatures
    // ===================================================================================
    const CoreFeatures = (function (State, DOM, Analyzer, DataHandler, UI, Utils, ProjectManager) {
        
        async function startSeoCrawler(config) {            
            let { baseUrl, maxDepth, crawlDelay, saveHtmlContent, concurrency } = config;
            try {
                if (!/^https?:\/\//i.test(baseUrl)) { baseUrl = 'https://' + baseUrl; }
                new URL(baseUrl);
            } catch (e) {
                Utils.showNotification('رابط الموقع غير صالح', 'danger');
                return;
            }
        
            const origin = new URL(baseUrl).origin;
            Utils.showNotification(`<i class="bi bi-rocket-takeoff-fill ms-2"></i> بدء زحف SEO لـ ${origin}...`, 'info');
            DOM.dom.crawlerStatus.classList.remove('d-none');
        
            const queue = [{ url: baseUrl, depth: 0 }];
            const visited = new Set([baseUrl]);
            const crawledData = new Map();
            let totalToProcess = 1;
            let processedCount = 0;
        
            const updateCrawlerUI = () => {
                const percentage = totalToProcess > 0 ? (processedCount / totalToProcess) * 100 : 0;
                DOM.dom.crawlerProgressBar.style.width = `${percentage}%`;
                DOM.dom.crawlerProgressBar.parentElement.setAttribute('aria-valuenow', percentage);
                DOM.dom.crawlerProgressText.textContent = `${processedCount}/${totalToProcess}`;
                DOM.dom.crawlerQueueCount.textContent = `في الانتظار: ${queue.length}`;
            };
            
            const processQueue = async () => {
                while (queue.length > 0) {
                    const batch = queue.splice(0, concurrency);
                    await Promise.all(batch.map(async (task) => {
                        try {
                            DOM.dom.crawlerCurrentUrl.textContent = `فحص: ${new URL(task.url).pathname}...`;
                            const startTime = performance.now();
                            
                            const response = await fetch(Utils.getProxyUrl(task.url));
                            if (!response.ok) throw new Error(`Status ${response.status}`);
                            const html = await response.text();
                            const analysis = Analyzer.analyzeHtmlContent(html, task.url, { loadTime: Math.round(performance.now() - startTime), saveHtmlContent });
        
                            const linksOnPage = new Set();
                            if (task.depth < maxDepth) {
                                new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a[href]').forEach(link => {
                                    try {
                                        const href = link.getAttribute('href');
                                        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
                                        const absoluteUrl = new URL(href, task.url).href.split('#')[0];
                                        linksOnPage.add(absoluteUrl);
                                        if (absoluteUrl.startsWith(origin) && !visited.has(absoluteUrl) && !/\.(jpg|jpeg|png|gif|svg|css|js|pdf|zip|webp|avif)$/i.test(absoluteUrl)) {
                                            visited.add(absoluteUrl);
                                            queue.push({ url: absoluteUrl, depth: task.depth + 1 });
                                            totalToProcess++;
                                        }
                                    } catch (e) {}
                                });
                            }
                            crawledData.set(task.url, { analysis, outgoingLinks: [...linksOnPage] });
                        } catch (error) {
                            console.error(`فشل في جلب ${task.url}:`, error);
                        } finally {
                            processedCount++;
                            updateCrawlerUI();
                            if (crawlDelay > 0) await new Promise(r => setTimeout(r, crawlDelay));
                        }
                    }));
                }
            };
            
            updateCrawlerUI();
            await processQueue();
            
            DOM.dom.crawlerCurrentUrl.innerHTML = '<p class="text-center text-success fw-bold">اكتمل الزحف!</p>';
            
            const allFoundUrls = new Set(crawledData.keys()), allLinkedToUrls = new Set(), linkEquityMap = new Map();
            crawledData.forEach(data => { data.outgoingLinks.forEach(link => { const cleanLink = link.split('#')[0].split('?')[0]; if (allFoundUrls.has(cleanLink)) { allLinkedToUrls.add(cleanLink); linkEquityMap.set(cleanLink, (linkEquityMap.get(cleanLink) || 0) + 1); } }); });
            crawledData.forEach((data, url) => {
                const cleanUrl = url.split('#')[0].split('?')[0];
                data.analysis.seo.isOrphan = !allLinkedToUrls.has(cleanUrl) && url !== baseUrl;
                data.analysis.seo.internalLinkEquity = linkEquityMap.get(cleanUrl) || 0;
            });

            const newItems = Array.from(crawledData.values()).map(({ analysis }) => ({ 
                ...analysis,
                category: 'زاحف SEO', 
                tags: (analysis.keywords || []).length > 0 ? analysis.keywords : Analyzer.extractTagsFromUrl(analysis.url), 
                source: 'seo_crawler' 
            }));
            const addedCount = DataHandler.addItemsToIndex(newItems);
            Utils.showNotification(addedCount > 0 ? `<i class="bi bi-check-circle-fill ms-2"></i> اكتمل الزحف! تمت إضافة ${addedCount} صفحة جديدة.` : 'لم يتم العثور على صفحات جديدة.', 'success');
            
            setTimeout(() => DOM.dom.crawlerStatus.classList.add('d-none'), 3000);
        }

        async function processTextualFile(file, urlExtractor, successMsg, noDataMsg, errorMsg) {
             try {
                const content = await Utils.readFileContent(file);
                const urls = urlExtractor(content);
                if (urls.length > 0) {
                    State.appState[successMsg.arrayName] = urls; // Store in the correct state array
                    Utils.showNotification(successMsg.message(urls.length), 'success');
                    ProjectManager.debouncedSaveProject();
                } else Utils.showNotification(noDataMsg, 'warning');
            } catch (e) { Utils.showNotification(errorMsg(e.message), 'danger'); }
        }
        async function processHtmlFiles(files) {
            let newFilesAnalyzed = 0;
            const shouldSaveContent = !DOM.dom.seoCrawlerNoSaveHtml.checked;
            for (const file of files) {
                if (!State.appState.analyzedFiles.some(f => f.filename === file.name)) {
                    try {
                        const analysis = Analyzer.analyzeHtmlContent(await Utils.readFileContent(file), file.name, { saveHtmlContent: shouldSaveContent });
                        State.appState.analyzedFiles.push(analysis); newFilesAnalyzed++;
                    } catch (e) { console.error('Error processing file:', file.name, e); Utils.showNotification(`خطأ في معالجة ${file.name}`, 'danger'); }
                }
            }
            if (newFilesAnalyzed > 0) { Utils.showNotification(`تم تحليل ${newFilesAnalyzed} ملف HTML جديد!`, 'success'); ProjectManager.debouncedSaveProject(); }
            else Utils.showNotification('جميع الملفات تم تحليلها مسبقاً', 'info');
        }
        const getStrippedIndex = (items) => items.map(({ id, title, description, url, category, tags, seo }) => ({ id, title, description, url, category, tags, seo }));
        const downloadJson = () => { const items = DataHandler.getSelectedItems(); if (items.length === 0) return Utils.showNotification('لا توجد عناصر للتصدير', 'warning'); Utils.downloadFile(new Blob([JSON.stringify(getStrippedIndex(items), null, 2)], { type: 'application/json' }), 'search-index.json'); Utils.showNotification(`تم تحميل ${items.length} عنصر كـ JSON <i class="bi bi-filetype-json ms-2"></i>`, 'success'); };
        const downloadCSV = () => { const items = DataHandler.getSelectedItems(); if (items.length === 0) return Utils.showNotification('لا توجد عناصر للتصدير', 'warning'); const csv = ['ID,العنوان,الرابط,الوصف,الفئة,الكلمات المفتاحية', ...items.map(i => [`"${i.id}"`, `"${i.title.replace(/"/g, '""')}"`, `"${i.url}"`, `"${i.description.replace(/"/g, '""')}"`, `"${i.category || ''}"`, `"${(i.tags || []).join(', ')}"`].join(','))].join('\n'); Utils.downloadFile(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }), 'search-index.csv'); Utils.showNotification(`تم تحميل ${items.length} عنصر كـ CSV <i class="bi bi-filetype-csv ms-2"></i>`, 'success'); };
        async function downloadZip() {
            const items = DataHandler.getSelectedItems();
            if (items.length === 0) return Utils.showNotification('لا توجد عناصر للتصدير', 'warning');
            DOM.dom.zipProgress.classList.remove('d-none');
            try {
                const zip = new JSZip();
                zip.file('search-index.json', JSON.stringify(getStrippedIndex(items), null, 2));
                const itemsWithContent = items.filter(item => item.content);
                if (itemsWithContent.length > 0) { const htmlFolder = zip.folder('html-files'); itemsWithContent.forEach(f => htmlFolder.file(f.filename, f.content)); }
                const content = await zip.generateAsync({ type: 'blob' }, (metadata) => { DOM.dom.zipProgressBar.style.width = `${metadata.percent.toFixed(2)}%`; });
                Utils.downloadFile(content, 'search-index-package.zip');
                Utils.showNotification(`تم تحميل ${items.length} عنصر في حزمة ZIP <i class="bi bi-file-zip-fill ms-2"></i>`, 'success');
            } catch (error) { Utils.showNotification('خطأ في إنشاء ZIP: ' + error.message, 'danger'); } finally { setTimeout(() => DOM.dom.zipProgress.classList.add('d-none'), 2000); }
        }
        const copyToClipboard = (type) => {
            const items = DataHandler.getSelectedItems();
            if (items.length === 0) return Utils.showNotification('لا توجد عناصر للنسخ', 'warning');
            const dataMap = { all: () => JSON.stringify(getStrippedIndex(items), null, 2), titles: () => items.map(i => i.title).join('\n'), urls: () => items.map(i => i.url).join('\n'), descriptions: () => items.map(i => i.description).join('\n') };
            navigator.clipboard.writeText(dataMap[type]()).then(() => { Utils.showNotification(`تم نسخ بيانات ${items.length} عنصر إلى الحافظة! <i class="bi bi-clipboard-check-fill ms-2"></i>`, 'success'); DOM.dom.copyOptions.classList.add('d-none'); }).catch(err => Utils.showNotification('فشل النسخ!', 'danger'));
        };
        const sanitizeForFilename = (url) => (url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '_').replace(/[?&#=:%]/g, '-').replace(/\.html?$/, '') || 'index');
        async function generateAndDownloadSchema(schemaConfig) {
            const { baseUrl, pageSchemaType, baseSchema } = schemaConfig;
            const items = DataHandler.getSelectedItems();
            if (items.length === 0) {
                Utils.showNotification('<strong>خطوة ناقصة:</strong> يجب أولاً توليد قائمة بالصفحات.', 'warning', 7000);
                DOM.dom.results.classList.add('border', 'border-warning', 'border-3', 'shadow');
                setTimeout(() => DOM.dom.results.classList.remove('border', 'border-warning', 'border-3', 'shadow'), 2500); return;
            }
            const zip = new JSZip();
            try {
                const baseSchemaObject = JSON.parse(baseSchema);
                baseSchemaObject.url = baseUrl; baseSchemaObject['@id'] = new URL('#website', baseUrl).href;
                zip.file('_schema_base.jsonld', JSON.stringify(baseSchemaObject, null, 2));
                const publisherName = baseSchemaObject.name || "Your Organization Name";
                const publisherLogoUrl = baseSchemaObject.logo || new URL("/logo.png", baseUrl).href;
                for (const item of items) {
                    const pageUrl = new URL(item.url, baseUrl).href;
                    const pageSchema = { "@context": "https://schema.org", "@type": pageSchemaType, "@id": pageUrl, name: item.title, headline: item.title, description: item.description, url: pageUrl, isPartOf: { "@id": baseSchemaObject['@id'] }, primaryImageOfPage: { "@type": "ImageObject", url: (item.seo?.ogImage) ? new URL(item.seo.ogImage, baseUrl).href : new URL('/og-image.png', baseUrl).href }, datePublished: new Date().toISOString().split('T')[0], dateModified: new Date().toISOString().split('T')[0] };
                    if (['Article', 'Product', 'Service'].includes(pageSchemaType)) { pageSchema.author = { "@type": "Organization", name: publisherName }; pageSchema.publisher = { "@type": "Organization", name: publisherName, logo: { "@type": "ImageObject", url: publisherLogoUrl } }; }
                    zip.file(`${sanitizeForFilename(item.url)}.jsonld`, JSON.stringify(pageSchema, null, 2));
                }
                const content = await zip.generateAsync({ type: 'blob' });
                Utils.downloadFile(content, 'schema_package.zip');
                Utils.showNotification(`تم توليد حزمة سكيما لـ ${items.length} صفحة!`, 'success');
            } catch (e) { Utils.showNotification(`فشل في إنشاء حزمة السكيما: ${e.message}`, 'danger'); }
        }

        return { startSeoCrawler, processTextualFile, processHtmlFiles, downloadJson, downloadCSV, downloadZip, copyToClipboard, generateAndDownloadSchema };
    })(StateManager, DOMManager, Analyzer, DataHandler, UIManager, Utils, ProjectManager);    


    // ===================================================================================
    // MODULE: Main Application Logic
    // ===================================================================================
    (function (State, DOM, UI, Data, Core, PM, Utils, Ai8vPlus) {

        function getCurrentlyDisplayedOrFilteredItems() {
            const filters = UI.getFilterState();
            return (filters.keyword || filters.category || filters.isOrphan) ? State.appState.filteredResults : State.appState.searchIndex;
        }
        function selectAllItems() {
            const itemsToSelect = getCurrentlyDisplayedOrFilteredItems();
            itemsToSelect.forEach(item => State.appState.selectedItemIds.add(item.id));
            UI.updateSelectionUI();
        }
        function deselectAllItems() {
            const itemsToDeselect = getCurrentlyDisplayedOrFilteredItems();
            itemsToDeselect.forEach(item => State.appState.selectedItemIds.delete(item.id));
            UI.updateSelectionUI();
        }
        function toggleItemSelection(checkboxElement, itemId) {
            if (checkboxElement.checked) State.appState.selectedItemIds.add(itemId);
            else State.appState.selectedItemIds.delete(itemId);
            UI.updateSelectionUI();
        }
        function applyFilters() {
            const openAccordionId = DOM.dom.resultsAccordion?.querySelector('.accordion-collapse.show')?.id;
            const filters = UI.getFilterState();
            State.appState.filteredResults = State.appState.searchIndex.filter(item =>
                (!filters.category || item.category === filters.category) &&
                (!filters.keyword || (item.title + item.description + (item.tags || []).join(' ')).toLowerCase().includes(filters.keyword)) &&
                (!filters.isOrphan || item.seo?.isOrphan)
            );
            UI.updateAllUI(openAccordionId);
        }
        function updateAdvisorTasks() {
            if (!window.Ai8vPlus?.analyzeAndPrioritize) return;
            const tasks = Ai8vPlus.analyzeAndPrioritize(State.appState.searchIndex);
            const advisorList = DOM.dom['advisor-list'];
            const advisorPlaceholder = DOM.dom.advisorPlaceholder;
            const advisorCountBadge = DOM.dom['advisor-count'];
            
            advisorList.innerHTML = '';
            if (tasks.length === 0) {
                advisorPlaceholder.classList.remove('d-none');
                advisorCountBadge.classList.add('d-none');
                return;
            }

            advisorPlaceholder.classList.add('d-none');
            advisorCountBadge.textContent = tasks.length;
            advisorCountBadge.classList.remove('d-none');
            
            const fragment = document.createDocumentFragment();
            tasks.forEach(task => {
                const collapseId = `task-details-${task.id}`;
                const taskElement = document.createElement('div');
                taskElement.className = 'list-group-item';
                taskElement.innerHTML = `
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <h3 class="mb-1 h6"><i class="bi ${task.priority.icon} ms-2 text-${task.priority.color}"></i> ${task.description}</h3>
                        <small><span class="badge bg-${task.priority.color}">${task.priority.label}</span></small>
                    </div>
                    <p class="mb-1 small">
                        <a class="fw-bold text-decoration-none" data-bs-toggle="collapse" href="#${collapseId}" role="button" aria-expanded="false" aria-controls="${collapseId}">
                            عرض الصفحات المتأثرة (${task.details.length})
                        </a>
                    </p>
                    <div class="collapse" id="${collapseId}">
                        <ul class="list-unstyled mt-2 small ps-4">
                            ${task.details.map(d => `<li class="d-flex justify-content-between align-items-center gap-3"><span class="flex-grow-1 text-truncate">${d.title}</span><span class="text-muted text-nowrap" dir="ltr">${d.url}</span></li>`).join('')}
                        </ul>
                    </div>`;
                fragment.appendChild(taskElement);
            });
            advisorList.appendChild(fragment);
        }
        // في ملف assets/js/js/script.js

        function renderArchitectRecommendations(recommendations) {
            const architectList = DOM.dom['architect-list'];
            const architectPlaceholder = DOM.dom.architectPlaceholder;
            const architectCountBadge = DOM.dom['architect-count'];
            
            architectList.innerHTML = '';
            if (!recommendations || recommendations.length === 0) {
                architectPlaceholder.classList.remove('d-none');
                architectCountBadge.classList.add('d-none');
                architectPlaceholder.textContent = 'لا توجد توصيات للربط الداخلي. تأكد من الزحف للموقع مع خيار "حفظ المحتوى الكامل" (إلغاء تحديد المربع).';
                return;
            }
            
            architectPlaceholder.classList.add('d-none');
            const totalOpportunities = recommendations.reduce((acc, rec) => acc + rec.opportunities.length, 0);
            architectCountBadge.textContent = totalOpportunities;
            architectCountBadge.classList.remove('d-none');
            
            const fragment = document.createDocumentFragment();
            recommendations.forEach((rec, index) => {
                const collapseId = `architect-rec-${index}`;
                const recElement = document.createElement('div');
                recElement.className = 'accordion-item';

                // -- ✅ التعديل الحاسم هنا: تغيير بنية زر الأكورديون --
                recElement.innerHTML = `
                    <h2 class="accordion-header" id="heading-${collapseId}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                            <div class="d-flex align-items-center w-100 overflow-hidden">
                                <span class="fw-bold flex-shrink-0">من صفحة:</span>
                                <span class="text-primary text-truncate mx-2" dir="ltr">${rec.sourcePageTitle}</span>
                            </div>
                        </button>
                    </h2>
                    <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#architect-list">
                        <div class="accordion-body">
                            <p class="small text-muted">اقتراحات لروابط داخلية من هذه الصفحة:</p>
                            <ul class="list-group">
                                ${rec.opportunities.map(op => `
                                    <li class="list-group-item">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <strong class="flex-shrink-0 me-3"><i class="bi bi-box-arrow-up-right ms-2"></i>اربط إلى:</strong>
                                            <span class="flex-grow-1 text-truncate text-start" dir="ltr">
                                                <a href="${op.targetPageUrl}" target="_blank" title="${op.targetPageUrl}">${op.targetPageTitle}</a>
                                            </span>
                                        </div>
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <strong class="flex-shrink-0 me-3"><i class="bi bi-link-45deg ms-2"></i>باستخدام نص الرابط:</strong>
                                            <span class="flex-grow-1 text-start">
                                                <span class="badge bg-primary fs-6">${op.anchorText}</span>
                                            </span>
                                        </div>
                                        <blockquote class="mb-0 small text-body-secondary fst-italic bg-body-tertiary p-2 rounded mt-2">
                                            <strong><i class="bi bi-quote ms-2"></i>السياق المقترح:</strong> ${op.context.replace(new RegExp(`\\b(${op.anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi'), '<mark>$1</mark>')}
                                        </blockquote>
                                        <div class="text-end small mt-1 text-info-emphasis">الأولوية: ${op.priority}</div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>`;
                fragment.appendChild(recElement);
            });
            architectList.appendChild(fragment);
        }

        async function handleLogDataImport(file) {
            if (!file) return;
            if (State.appState.searchIndex.length === 0) {
                Utils.showNotification('يرجى أولاً توليد أو زحف قائمة الصفحات قبل استيراد بيانات السجلات.', 'warning');
                return;
            }
            try {
                const content = await Utils.readFileContent(file);
                const logData = JSON.parse(content);

                if (!logData.hits || !Array.isArray(logData.hits)) {
                    throw new Error("ملف JSON غير صالح أو لا يحتوي على مفتاح 'hits'.");
                }
                
                const logHitsMap = new Map(logData.hits.map(item => [item.url, item.count]));
                let pagesUpdated = 0;

                State.appState.searchIndex.forEach(page => {
                    if (page.seo) { // Ensure seo object exists
                        if (logHitsMap.has(page.url)) {
                            page.seo.logHits = logHitsMap.get(page.url);
                            pagesUpdated++;
                        } else {
                            page.seo.logHits = 0;
                        }
                    }
                });
                
                if (pagesUpdated > 0) {
                    Utils.showNotification(`تم دمج بيانات السجلات! تم تحديث ${pagesUpdated} صفحة.`, 'success');
                } else {
                    Utils.showNotification("⚠️ **تحذير التوافق:** تم الدمج، لكن لم يتم العثور على أي صفحات مشتركة. هل أنت متأكد من أن ملف السجلات هذا يخص نفس المشروع؟", 'warning', 8000);
                }
                
                UI.updateAllUI();
                PM.debouncedSaveProject();

            } catch (error) {
                console.error("Error importing log data:", error);
                Utils.showNotification(`خطأ في استيراد الملف: ${error.message}`, 'danger');
            }
        }

        async function runLinkArchitect() {
            if (!window.LinkArchitect) return;
            const architectPlaceholder = DOM.dom.architectPlaceholder;
            const architectList = DOM.dom['architect-list'];
            const architectCountBadge = DOM.dom['architect-count'];
            
            architectList.innerHTML = '';
            architectCountBadge.classList.add('d-none');
            architectPlaceholder.textContent = 'جاري تحليل فرص الربط الداخلي... قد تستغرق هذه العملية بعض الوقت.';
            architectPlaceholder.classList.remove('d-none');
            
            try {
                const recommendations = await window.LinkArchitect.generateRecommendations(State.appState.searchIndex);
                State.appState.architectRecommendations = recommendations;
                renderArchitectRecommendations(recommendations);
            } catch (error) {
                console.error("Link Architect failed to run:", error);
                // -- ✅ تعديل حاسم هنا --
                if (error.name === 'NoContentError') {
                    // إذا كان الخطأ هو عدم وجود محتوى، نعرض رسالة مخصصة
                    architectPlaceholder.textContent = 'لتفعيل "مهندس الروابط"، يرجى إعادة زحف الموقع مع التأكد من **إلغاء تحديد** مربع "عدم حفظ المحتوى الكامل".';
                } else {
                    // لأي أخطاء أخرى، نعرض الرسالة العامة
                    architectPlaceholder.textContent = 'حدث خطأ أثناء تشغيل مهندس الروابط. تحقق من الكونسول لمزيد من التفاصيل.';
                }
            }
        }
        
        // ✅ THE FIX (PART 2): The main event handler with the correct workflow.
        function handleGenerateClick() {
            const urlInput = UI.getUrlInput();
            const isManualChecked = UI.isManualInputChecked();

            // 1. Generate new items from ALL current input sources.
            const newItems = Data.generateSearchIndexFromInputs(urlInput, isManualChecked);

            if (newItems.length === 0 && State.appState.searchIndex.length === 0) {
                return Utils.showNotification('يرجى إدخال بيانات أولاً', 'warning');
            }

            // 2. Add the unique new items to the main state.
            const addedCount = Data.addItemsToIndex(newItems);
            Utils.showNotification(
                addedCount > 0 
                    ? `تم إضافة ${addedCount} عنصر جديد! الإجمالي: ${State.appState.searchIndex.length}` 
                    : 'لا توجد عناصر جديدة للإضافة. النتائج محدّثة.', 
                addedCount > 0 ? 'success' : 'info'
            );
            
            // 3. Clear the transient input sources to prevent reprocessing on the next click.
            DOM.dom.urlInput.value = ''; 
            State.appState.sitemapUrls = [];
            State.appState.robotsUrls = [];
            State.appState.manifestData = {};
            State.appState.analyzedFiles = [];
            State.appState.manualPages = [];

            // 4. Update all UI elements and run secondary analyses.
            UI.updateAllUI();
            updateAdvisorTasks();
            if (State.appState.searchIndex.some(p => p.content)) {
                runLinkArchitect();
            }
            
            // 5. Save the new state.
            PM.debouncedSaveProject();
        }
        
        function handleAddManualPage() {
            const pageData = UI.getManualPageData();
            if (!pageData.title || !pageData.url) return Utils.showNotification('يرجى إدخال العنوان والرابط على الأقل', 'warning');
            Data.addManualPage(pageData);
            UI.clearManualPageForm();
            Utils.showNotification(`تم إضافة: ${pageData.title} يدويًا. اضغط "توليد" لإظهارها.`, 'success');
            PM.debouncedSaveProject();
        }
        async function handleManualSave() {
            const projectName = UI.getProjectName();
            if (!projectName) return Utils.showNotification('يرجى إدخال اسم للمشروع.', 'warning');
            
            if (!UI.validateSchemaEditor()) {
                Utils.showNotification('تم حفظ المشروع، لكن "السكيما الأساسية" تحتوي على أخطاء.', 'warning', 6000);
            }
            State.appState.schemaConfig = UI.getSchemaConfigFromDOM();
            
            try {
                const dataToSave = PM.getProjectDataForSave(projectName);
                await window.StorageManager.saveProjectData(dataToSave);
                Utils.showNotification(`تم حفظ المشروع "${projectName}"! <i class="bi bi-save-fill ms-2"></i>`, 'success');
                await UI.updateProjectListDropdown(projectName);
            } catch (e) {
                Utils.showNotification(`فشل حفظ المشروع: ${e.message}`, 'danger');
            }
        }
        async function handleDeleteProject() {
            const projectName = UI.getSelectedProjectName();
            if (!projectName) return Utils.showNotification('يرجى اختيار مشروع لحذفه.', 'warning');
            if (confirm(`هل أنت متأكد من حذف المشروع "${projectName}"؟`)) {
                await PM.deleteProject(projectName);
                if (UI.getProjectName() === projectName) PM.clearCurrentState();
            }
        }
        async function handleStartCrawler() {
            const config = UI.getSeoCrawlerConfig();
            if (!config.baseUrl) return;

            StateManager.resetAppState();
            UI.updateAllUI();

            await Core.startSeoCrawler(config);

            UI.updateAllUI();
            updateAdvisorTasks();
            await runLinkArchitect();
            PM.debouncedSaveProject();
        }
        async function handleGenerateSchema() {
            if (!UI.validateSchemaEditor()) {
                Utils.showNotification('يرجى تصحيح الأخطاء في "السكيما الأساسية" قبل المتابعة.', 'danger');
                DOM.dom.schemaBaseEditor.focus();
                return;
            }
            const schemaConfig = UI.getSchemaConfigFromDOM();
            if (!schemaConfig.baseUrl) return Utils.showNotification('يرجى إدخال رابط الموقع الأساسي.', 'warning');
            State.appState.schemaConfig = schemaConfig;
            await Core.generateAndDownloadSchema(schemaConfig);
        }
        function handlePrintReport() {
            const reportContent = DOM.dom.reportModalBody.innerHTML;
            const projectName = UI.getProjectName() || "تحليل موقع";
            const reportDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

            const printWindow = window.open('', '_blank');
            
            printWindow.document.write('<!DOCTYPE html><html dir="rtl"><head>');
            printWindow.document.write(`<title>تقرير ${projectName} - ${reportDate}</title>`);
            
            const bootstrapLink = printWindow.document.createElement('link');
            bootstrapLink.rel = 'stylesheet';
            bootstrapLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css';
            printWindow.document.head.appendChild(bootstrapLink);

            const style = printWindow.document.createElement('style');
            style.innerHTML = `
                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .card { border: 1px solid #dee2e6 !important; box-shadow: none !important; break-inside: avoid; }
                .badge { border: 1px solid #6c757d !important; background-color: #f8f9fa !important; color: #212529 !important; }
                .bg-danger-subtle { background-color: #f8d7da !important; }
                .bg-success-subtle { background-color: #d1e7dd !important; }
                .bg-info-subtle { background-color: #cff4fc !important; }
                .text-warning { color: #ffc107 !important; }
                .text-danger { color: #dc3545 !important; }
                a { text-decoration: none; color: inherit; }
            `;
            printWindow.document.head.appendChild(style);
            
            printWindow.document.write('</head><body>');
            printWindow.document.write(reportContent);
            printWindow.document.write('</body></html>');
            
            printWindow.document.close();
            
            bootstrapLink.onload = function() {
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            };

            setTimeout(() => {
                if (!printWindow.closed) {
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                }
            }, 1000);
        }
        function handleExportReport() {
    const items = State.appState.searchIndex;
    if (items.length === 0) {
        return Utils.showNotification('لا توجد بيانات لإنشاء تقرير. يرجى تحليل بعض الصفحات أولاً.', 'warning');
    }

    const projectName = UI.getProjectName() || "تحليل موقع";
    const reportDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    // --- 1. جمع البيانات (لا تغيير هنا) ---
    const totalPages = items.length;
    const orphanPages = items.filter(i => i.seo?.isOrphan);
    const noIndexPages = items.filter(i => i.seo?.isNoIndex);
    const missingH1 = items.filter(i => i.seo && !i.seo.h1);
    const missingDesc = items.filter(i => i.seo?.isDefaultDescription);
    const pagesWithBrokenLinks = items.filter(i => i.seo?.brokenLinksOnPage?.length > 0);
    
    let totalScore = 0, maxPossibleScore = 0;
    items.forEach(item => {
        const { score, maxScore } = Analyzer.calculateSeoScore(item.seo);
        totalScore += score;
        maxPossibleScore += maxScore;
    });
    const avgSeoScore = maxPossibleScore > 0 ? ((totalScore / maxPossibleScore) * 100).toFixed(0) : 0;
    
    const topAdvisorTasks = (window.Ai8vPlus?.analyzeAndPrioritize(items) || []).slice(0, 5);
    
    // --- 2. بناء هيكل التقرير (HTML) مع العناوين الصحيحة ---
    const renderList = (title, pages, badgeClass = 'danger') => {
        if (pages.length === 0) return '';
        // **FIX:** Changed from h4 to h3
        return `
            <div class="mb-4">
                <h3 class="h6">${title} <span class="badge bg-${badgeClass} ms-2">${pages.length}</span></h3>
                <ul class="list-group list-group-flush">
                    ${pages.slice(0, 10).map(p => `<li class="list-group-item small d-flex justify-content-between"><span>${p.title}</span><span class="text-muted" dir="ltr">${p.url}</span></li>`).join('')}
                    ${pages.length > 10 ? `<li class="list-group-item small text-center text-muted">... و ${pages.length - 10} صفحة أخرى</li>` : ''}
                </ul>
            </div>`;
    };

    const reportHtml = `
        <div class="container-fluid p-4">
            <!-- Report Header -->
            <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
                <div>
                    <h1 class="h2 mb-0">${projectName}</h1>
                    <p class="text-muted mb-0">تقرير الصحة التقنية للموقع</p>
                </div>
                <div class="text-end">
                     <img src="assets/img/logo.png" alt="Logo" width="200" height="50" style="max-height: 50px; width: auto;"/>
                    <p class="text-muted small mt-1 mb-0">تاريخ التقرير: ${reportDate}</p>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="row g-3 mb-4">
                <div class="col-3"><div class="card text-center h-100"><div class="card-body"><h2 class="h6 card-subtitle text-muted">إجمالي الصفحات</h2><p class="fs-2 fw-bold mb-0">${totalPages}</p></div></div></div>
                <div class="col-3"><div class="card text-center h-100"><div class="card-body"><h2 class="h6 card-subtitle text-muted">متوسط تقييم SEO</h2><p class="fs-2 fw-bold mb-0">${avgSeoScore}%</p></div></div></div>
                <div class="col-3"><div class="card text-center h-100"><div class="card-body"><h2 class="h6 card-subtitle text-muted">صفحات معزولة</h2><p class="fs-2 fw-bold mb-0 text-warning">${orphanPages.length}</p></div></div></div>
                <div class="col-3"><div class="card text-center h-100"><div class="card-body"><h2 class="h6 card-subtitle text-muted">صفحات NoIndex</h2><p class="fs-2 fw-bold mb-0 text-danger">${noIndexPages.length}</p></div></div></div>
            </div>

            <!-- Main Content -->
            <div class="row g-4">
                <div class="col-md-7">
                    <h2 class="h5 mb-3 border-bottom pb-2">ملخص المشاكل الحرجة</h2>
                    ${renderList('صفحات معزولة (Orphan Pages)', orphanPages, 'warning')}
                    ${renderList('صفحات مستبعدة من الفهرسة (NoIndex)', noIndexPages, 'danger')}
                    ${renderList('صفحات بدون عنوان H1', missingH1, 'info')}
                    ${renderList('صفحات بدون وصف Meta', missingDesc, 'info')}
                    ${renderList('صفحات بها روابط داخلية مكسورة', pagesWithBrokenLinks, 'danger')}
                </div>
                <div class="col-md-5">
                    <h2 class="h5 mb-3 border-bottom pb-2">أهم التوصيات</h2>
                    ${topAdvisorTasks.length > 0 ? `
                        <ul class="list-group list-group-flush">
                            ${topAdvisorTasks.map(task => `
                                <li class="list-group-item">
                                    <div class="d-flex w-100 justify-content-between align-items-center">
                                        <p class="mb-0 small"><i class="bi ${task.priority.icon} ms-2 text-${task.priority.color}"></i> ${task.description}</p>
                                        <small><span class="badge bg-${task.priority.color}">${task.priority.label}</span></small>
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p class="text-muted text-center mt-4">✓ رائع! لم يتم العثور على مشاكل حرجة.</p>'}
                </div>
            </div>
        </div>
    `;
    
    DOM.dom.reportModalBody.innerHTML = reportHtml;
    new bootstrap.Modal(DOM.dom.reportModal).show();
}
        function toggleEdit(itemId) {
            const pageItem = document.querySelector(`.result-item[data-id="${itemId}"]`);
            if (!pageItem) return;
            const editBtn = pageItem.querySelector('.btn-edit');
            const item = State.appState.searchIndex.find(i => i.id === itemId);
            if (!item || !editBtn) return;
            if (pageItem.classList.contains('is-editing')) {
                UI.saveEditMode(item, pageItem, editBtn, () => {
                    PM.debouncedSaveProject();
                    updateAdvisorTasks();
                    runLinkArchitect();
                });
            } else {
                UI.enterEditMode(item, pageItem, editBtn);
            }
        }

        function showSiteVisualizer() {
            if (!State.appState.searchIndex || State.appState.searchIndex.length === 0) {
                return Utils.showNotification('لا توجد بيانات لعرض المخطط. يرجى زحف الموقع أولاً.', 'warning');
            }
            if (typeof vis === 'undefined') {
                return Utils.showNotification('مكتبة الرسوم البيانية (vis.js) لم يتم تحميلها بعد.', 'danger');
            }
            
            const modalEl = DOM.getEl('visualizerModal');
            const container = DOM.getEl('site-graph-container');
            const placeholder = DOM.getEl('visualizerPlaceholder');
            
            placeholder.classList.add('d-none');
            
            window.SiteVisualizer.render(container, State.appState.searchIndex);

            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }

        async function showComparisonModal() {
            const projectList = await window.StorageManager.getProjectList();
            if (projectList.length < 2) {
                return Utils.showNotification('تحتاج إلى مشروعين محفوظين على الأقل لإجراء مقارنة.', 'warning');
            }
            const selectorA = DOM.getEl('projectASelector');
            const selectorB = DOM.getEl('projectBSelector');
            selectorA.innerHTML = '<option value="">اختر المشروع الأقدم...</option>';
            selectorB.innerHTML = '<option value="">اختر المشروع الأحدث...</option>';
            projectList.sort().forEach(p => {
                selectorA.add(new Option(p, p));
                selectorB.add(new Option(p, p));
            });
            const modal = new bootstrap.Modal(DOM.getEl('comparisonModal'));
            modal.show();
        }

        async function runComparison() {
            const projectAName = DOM.getEl('projectASelector').value;
            const projectBName = DOM.getEl('projectBSelector').value;
            if (!projectAName || !projectBName) return Utils.showNotification('يرجى اختيار كلا المشروعين.', 'warning');
            if (projectAName === projectBName) return Utils.showNotification('يرجى اختيار مشروعين مختلفين.', 'warning');
            try {
                const projectAData = await window.StorageManager.loadProjectData(projectAName);
                const projectBData = await window.StorageManager.loadProjectData(projectBName);
                if (!projectAData || !projectBData) return Utils.showNotification('فشل تحميل بيانات أحد المشاريع.', 'danger');
                const report = window.ComparisonEngine.compare(projectAData.searchIndex, projectBData.searchIndex);
                renderComparisonReport(report, projectAName, projectBName);
            } catch (error) {
                Utils.showNotification('حدث خطأ أثناء المقارنة.', 'danger');
                console.error('Comparison failed:', error);
            }
        }

        function renderComparisonReport(report, nameA, nameB) {
            const container = DOM.getEl('comparison-results-container');
            if (!report) { container.innerHTML = `<p class="text-center p-5 text-danger">فشلت عملية المقارنة.</p>`; return; }
            const renderList = (title, pages, itemClass) => {
                if (pages.length === 0) return '';
                return `<h4 class="h5 mt-4">${title} <span class="badge rounded-pill ${itemClass === 'list-group-item-success' ? 'bg-success' : 'bg-danger'}">${pages.length}</span></h4><ul class="list-group list-group-flush">${pages.map(p => `<li class="list-group-item ${itemClass} small">${p.title} <span class="d-block text-muted" dir="ltr">${p.url}</span></li>`).join('')}</ul>`;
            };
            const renderScoreChanges = (title, pages, itemClass) => {
                 if (pages.length === 0) return '';
                 return `<h4 class="h5 mt-4">${title} <span class="badge rounded-pill ${itemClass === 'list-group-item-success' ? 'bg-success' : 'bg-danger'}">${pages.length}</span></h4><ul class="list-group list-group-flush">${pages.map(p => `<li class="list-group-item ${itemClass} small d-flex justify-content-between"><span>${p.title}</span> <span class="badge bg-secondary">${p.scoreBefore} → ${p.scoreAfter}</span></li>`).join('')}</ul>`;
            }
            container.innerHTML = `
                <div class="row g-3"><div class="col-md-6"><div class="card comparison-card h-100"><div class="card-body">
                    <h3 class="card-title h6">ملخص التغييرات</h3><p class="card-text small text-muted">مقارنة بين <strong>${nameA}</strong> و <strong>${nameB}</strong></p>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item d-flex justify-content-between align-items-center">الصفحات قبل: <span class="badge bg-secondary">${report.summary.pagesBefore}</span></li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">الصفحات بعد: <span class="badge bg-primary">${report.summary.pagesAfter}</span></li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">صفحات جديدة: <span class="badge bg-success">${report.summary.pagesAdded}</span></li>
                        <li class="list-group-item d-flex justify-content-between align-items-center">صفحات محذوفة: <span class="badge bg-danger">${report.summary.pagesRemoved}</span></li>
                    </ul></div></div></div>
                    <div class="col-md-6"><div class="card comparison-card h-100"><div class="card-body">
                        ${renderList('صفحات تمت إضافتها', report.addedPages, 'list-group-item-success')}
                        ${renderList('صفحات تمت إزالتها', report.removedPages, 'list-group-item-danger')}
                    </div></div></div>
                    <div class="col-12"><div class="card comparison-card"><div class="card-body">
                        <div class="row">
                            <div class="col-md-6">${renderScoreChanges('صفحات تحسن تقييمها', report.improvedPages, 'list-group-item-success')}</div>
                            <div class="col-md-6">${renderScoreChanges('صفحات تراجع تقييمها', report.declinedPages, 'list-group-item-danger')}</div>
                        </div></div></div></div>
                </div>`;
        }

        function setupEventListeners() {
            const singleEventHandlers = {
                'darkModeToggle': { click: UI.toggleDarkMode }, 'startCrawlerBtn': { click: handleStartCrawler },
                'addManualPageBtn': { click: handleAddManualPage }, 'generateIndexBtn': { click: handleGenerateClick },
                'downloadJsonBtn': { click: Core.downloadJson }, 'downloadCsvBtn': { click: Core.downloadCSV },
                'downloadZipBtn': { click: Core.downloadZip }, 'toggleCopyBtn': { click: () => DOM.dom.copyOptions.classList.toggle('d-none') },
                'saveProjectBtn': { click: handleManualSave }, 'deleteProjectBtn': { click: handleDeleteProject },
                'hideCrawlerStatusBtn': { click: () => DOM.dom.crawlerStatus.classList.add('d-none') }, 'generateSchemaBtn': { click: handleGenerateSchema },
                'exportReportBtn': { click: handleExportReport }, 'printReportBtn': { click: handlePrintReport },
                'selectAllBtn': { click: selectAllItems }, 'deselectAllBtn': { click: deselectAllItems },
                'importUrlsFileBtn': { click: () => { const file = DOM.dom.urlsFileInput.files[0]; if (file) Core.processTextualFile(file, c => c.split('\n').filter(Boolean), {arrayName: 'sitemapUrls', message: len => `تم استخراج ${len} رابط من الملف!`}, 'لم يتم العثور على روابط.', e => `خطأ: ${e}`); else Utils.showNotification('يرجى اختيار ملف أولاً', 'warning'); } },
                'projectSelector': { change: async (e) => { await PM.loadProject(e.target.value); updateAdvisorTasks(); await runLinkArchitect(); } },
                'clearFormBtn': { click: () => { if (confirm('هل أنت متأكد من مسح جميع البيانات الحالية؟')) { PM.clearCurrentState(); updateAdvisorTasks(); renderArchitectRecommendations([]); Utils.showNotification('تم مسح كل شيء.', 'info'); } } },
                'manualInput': { change: (e) => DOM.dom.manualInputSection.classList.toggle('d-none', !e.target.checked) },
                'viewOrphanPagesBtn': { click: () => { bootstrap.Modal.getInstance(DOM.dom.analyticsModal).hide(); DOM.dom.orphanFilter.checked = true; applyFilters(); DOM.dom.results.scrollIntoView({ behavior: 'smooth' }); } },
                'analyticsModal': { 'show.bs.modal': UI.updateAnalyticsDashboard },
                'architectTabBtn': { 'show.bs.tab': runLinkArchitect },
                'showVisualizerBtn': { click: showSiteVisualizer },
                'showComparisonBtn': { click: showComparisonModal },
                'runComparisonBtn': { click: runComparison }
            };
            for (const id in singleEventHandlers) {
                const el = DOM.getEl(id);
                if (el) { for (const event in singleEventHandlers[id]) { el.addEventListener(event, singleEventHandlers[id][event]); } }
            }
            ['urlInput', 'projectNameInput', 'schemaBaseUrl', 'schemaPageType'].forEach(id => {
                DOM.getEl(id).addEventListener('input', PM.debouncedSaveProject);
            });
            DOM.dom.schemaBaseEditor.addEventListener('input', () => { UI.validateSchemaEditor(); PM.debouncedSaveProject(); });
            [DOM.dom.categoryFilter, DOM.dom.keywordFilter, DOM.dom.orphanFilter].forEach(el => {
                el.addEventListener('input', applyFilters);
            });

            DOM.getEl('logDataInput')?.addEventListener('change', (e) => {
                if(e.target.files && e.target.files.length > 0) {
                    handleLogDataImport(e.target.files[0]);
                    e.target.value = '';
                }
            });

            DOM.dom.results.addEventListener('click', (e) => {
                const target = e.target;
                const resultItem = target.closest('.result-item');
                if (!resultItem) return;
                const itemId = parseInt(resultItem.dataset.id, 10);
                if (isNaN(itemId)) return;
                if (target.matches('.item-select-checkbox')) { toggleItemSelection(target, itemId); return; }
                const buttonTarget = target.closest('button');
                if (!buttonTarget) return;
                if (buttonTarget.matches('.btn-edit')) toggleEdit(itemId);
                else if (buttonTarget.matches('.btn-preview')) UI.showSerpPreview(itemId);
                else if (buttonTarget.matches('.btn-delete')) {
                    Data.deleteItem(itemId, () => { UI.updateAllUI(); updateAdvisorTasks(); runLinkArchitect(); PM.debouncedSaveProject(); });
                }
            });
            DOM.dom.resultsAccordion.addEventListener('show.bs.collapse', UI.handleAccordionShow);
            DOM.dom.copyOptions.addEventListener('click', e => { const btn = e.target.closest('button[data-copy-type]'); if (btn) Core.copyToClipboard(btn.dataset.copyType); });
            const setupDragDrop = (dropZoneId, fileInputId, fileTypeRegex, processFunction) => {
                const dropZone = DOM.getEl(dropZoneId), fileInput = DOM.getEl(fileInputId); if (!dropZone || !fileInput) return;
                dropZone.addEventListener('click', () => fileInput.click());
                ['dragover', 'dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, e => { 
                    e.preventDefault(); e.stopPropagation(); 
                    dropZone.classList.toggle('dragover', eventName === 'dragover' || eventName === 'drop'); 
                    if (eventName === 'drop') { const files = [...e.dataTransfer.files].filter(f => fileTypeRegex.test(f.name)); if (files.length > 0) processFunction(fileInput.multiple ? files : files[0]); } 
                }));
                fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) processFunction(fileInput.multiple ? [...e.target.files] : e.target.files[0]); });
            };
            const textualFileHandler = (extractor, success, noData, error) => file => Core.processTextualFile(file, extractor, success, noData, error);
            setupDragDrop('robotsDropZone', 'robotsFileInput', /\.txt$/, textualFileHandler(c => c.split('\n').filter(l => /^(dis)?allow:/i.test(l.trim())).map(l => l.split(':')[1]?.trim()).filter(Boolean), {arrayName: 'robotsUrls', message: len => `تم استخراج ${len} مسار من robots.txt!`}, 'لم يتم العثور على مسارات.', e => `خطأ: ${e}`));
            setupDragDrop('manifestDropZone', 'manifestFileInput', /\.json$/, textualFileHandler(c => { try { const d = JSON.parse(c); return [...(d.icons?.map(i => i.src) || []), ...(d.screenshots?.map(s => s.src) || []), d.start_url, ...(d.shortcuts?.map(s => s.url) || [])].filter(Boolean); } catch(err) { throw new Error('JSON غير صالح'); } }, {arrayName: 'manifestData', message: len => `تم استخراج ${len} مسار من manifest.json!`}, 'لم يتم العثور على مسارات.', e => `خطأ: ${e.message}`));
            setupDragDrop('sitemapDropZone', 'sitemapFileInput', /\.xml$/, textualFileHandler(c => { 
            const d = new DOMParser().parseFromString(c, 'text/xml'); 
            if (d.querySelector('parsererror')) throw new Error('XML غير صالح'); 
            return [...d.querySelectorAll('url > loc, sitemap > loc')].map(el => el.textContent.trim()).filter(Boolean); 
            }, {arrayName: 'sitemapUrls', message: len => `تم استخراج ${len} رابط من Sitemap!`}, 'لم يتم العثور على روابط.', e => `خطأ: ${e.message}`));
            setupDragDrop('fileDropZone', 'htmlFileInput', /\.html?$/, Core.processHtmlFiles);

            DOM.dom.proxySelector.addEventListener('change', () => {
                const isCustom = DOM.dom.proxySelector.value === 'custom';
                DOM.dom.customProxyUrl.classList.toggle('d-none', !isCustom);
                if (isCustom) DOM.dom.customProxyUrl.focus();
            });
        }
        
        async function init() {
            DOM.init();
            UI.initObserver();
            const initialDarkMode = localStorage.getItem('darkMode') === 'true' || (localStorage.getItem('darkMode') === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
            UI.setDarkMode(initialDarkMode);
            setupEventListeners();
            const lastProject = localStorage.getItem(State.CONSTANTS.LAST_PROJECT_KEY);
            if (lastProject) {
                await PM.loadProject(lastProject);
            } else {
                await UI.updateProjectListDropdown();
                UI.validateSchemaEditor();
            }
            updateAdvisorTasks();
            await runLinkArchitect();
            UI.updateAllUI();
        }
        window.addEventListener('DOMContentLoaded', init);

    })(StateManager, DOMManager, UIManager, DataHandler, CoreFeatures, ProjectManager, Utils, window.Ai8vPlus);

    return {
        StateManager, Analyzer, DataHandler, UIManager, DOMManager, Utils,
        CoreFeatures, ProjectManager   
    };    
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportedModules;
}
