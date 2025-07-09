// assets/js/skynet-features.js - "Operation: Skynet" - UPGRADED INTELLIGENCE (CORRECTED PATH)

(function() {
    'use strict';

    // --- Skynet State ---
    let analysisA = null; // Represents the main analysis from log-analyzer.js
    let analysisB = null; // Represents the comparison file analysis
    let comparisonWorker;

    // --- DOM Elements ---
    const comparisonDropZoneContainer = document.getElementById('comparison-drop-zone-container');
    const comparisonDropZone = document.getElementById('comparisonDropZone');
    const comparisonFileInput = document.getElementById('comparisonFileInput');
    const comparisonContainer = document.getElementById('comparison-container');
    const insightsContainer = document.getElementById('insights-container');
    const insightsList = document.getElementById('insights-list');

    const delta404El = document.getElementById('delta-404');
    const deltaBotsEl = document.getElementById('delta-bots');
    const deltaNewPagesEl = document.getElementById('delta-new-pages');

    function initializeComparisonWorker() {
        if (!window.Worker) return;
        // ✅ CORRECTED PATH: Relative to the HTML file (root)
        comparisonWorker = new Worker('../assets/js/LogFileAnalyzer/log-worker.js');

        comparisonWorker.onmessage = function(event) {
            const {
                type,
                result,
                error
            } = event.data;
            if (type === 'complete') {
                analysisB = result;
                runComparisonAnalysis(); // This function now only handles comparison
            } else if (error) {
                alert(`خطأ في تحليل ملف المقارنة: ${error}`);
            }
        };
    }

    async function handleComparisonFileSelect(event) {
        const file = event.target.files[0];
        if (!file || !comparisonWorker) return;

        try {
            // Provide feedback to the user
            comparisonDropZone.querySelector('p').textContent = `جاري تحليل: ${file.name}...`;
            const fileContent = file.name.endsWith('.zip') ? await readZipFile(file) : await readFileContent(file);
            comparisonWorker.postMessage(fileContent);
        } catch (error) {
            alert(`خطأ في قراءة ملف المقارنة: ${error.message}`);
            comparisonDropZone.querySelector('p').textContent = `اسحب ملف السجل **الثاني** هنا`;
        }
    }

    // This function now runs after the primary analysis is complete
    function runPrimaryIntelligenceAnalysis() {
        if (!analysisA || !analysisA.filteredData) return;

        const insights = generateInsights(analysisA.filteredData);
        displayInsights(insights);
    }
    
    // This function now only runs after the secondary (comparison) file is processed
    function runComparisonAnalysis() {
        if (!analysisA || !analysisB) return;
        const {
            delta404,
            deltaBots,
            newPagesCount
        } = compareAnalyses(analysisA, analysisB);
        displayComparisonResults(delta404, deltaBots, newPagesCount);
    }

    function compareAnalyses(dataA, dataB) {
        const getMetrics = (data) => {
            const metrics = {
                notFoundCount: 0,
                botCount: 0,
                urls: new Set()
            };
            data.allParsedLines.forEach(line => {
                if (line.statusCode === 404) metrics.notFoundCount++;
                if (line.botType !== 'Other' && line.isVerified) metrics.botCount++;
                metrics.urls.add(line.request.split('?')[0]);
            });
            return metrics;
        };
        const metricsA = getMetrics(dataA);
        const metricsB = getMetrics(dataB);

        const delta404 = metricsB.notFoundCount - metricsA.notFoundCount;
        const deltaBots = metricsB.botCount - metricsA.botCount;

        let newPagesCount = 0;
        metricsB.urls.forEach(url => {
            if (!metricsA.urls.has(url)) newPagesCount++;
        });

        return {
            delta404,
            deltaBots,
            newPagesCount
        };
    }

    /**
     * Generates actionable insights based on a single, filtered analysis.
     * @param {object} filteredData - The filtered data object from log-analyzer.js.
     * @returns {Array<object>} An array of insight objects {type: 'warning'|'danger'|'info', message: '...'}
     */
    function generateInsights(filteredData) {
        const insights = [];
        const { pageCounts, contentTypeCounts, filteredHits, notFoundCounts } = filteredData;

        if (filteredHits === 0) return []; // No hits, no insights.

        // 1. 404 Error Insight
        const total404s = Object.values(notFoundCounts).reduce((sum, page) => sum + page.count, 0);
        if ((total404s / filteredHits) > 0.10) { // If more than 10% of hits are 404s
            insights.push({ type: 'danger', message: `تم اكتشاف <strong>${total404s.toLocaleString()}</strong> خطأ 404، وهو ما يمثل أكثر من <strong>10%</strong> من إجمالي الزحف. هذا يهدر ميزانية الزحف بشكل كبير. قم بإصلاحها فورًا.` });
        } else if (total404s > 50) {
            insights.push({ type: 'warning', message: `يوجد <strong>${total404s.toLocaleString()}</strong> طلب 404. افتح تقرير 404 وقم بإعداد عمليات إعادة توجيه 301 للروابط المهمة.` });
        }

        // 2. Over-crawling Insight
        const sortedPages = Object.entries(pageCounts).sort(([, a], [, b]) => b.count - a.count);
        if (sortedPages.length > 0) {
            const topPage = sortedPages[0];
            const [topUrl, topData] = topPage;
            if ((topData.count / filteredHits) > 0.20) { // If one page takes > 20% of crawl budget
                insights.push({ type: 'warning', message: `<strong>زحف مفرط:</strong> الصفحة <code>${topUrl}</code> تستهلك وحدها أكثر من <strong>20%</strong> من ميزانية الزحف. إذا كانت هذه الصفحة غير مهمة أو لا تتغير، فكر في تقليل معدل زحفها.` });
            }
        }

        // 3. Crawl Budget Distribution by Content Type Insight
        if(contentTypeCounts) {
            const imageHits = (contentTypeCounts['jpg'] || 0) + (contentTypeCounts['png'] || 0) + (contentTypeCounts['gif'] || 0) + (contentTypeCounts['webp'] || 0);
            const imagePercentage = (imageHits / filteredHits) * 100;
            if(imagePercentage > 30) {
                insights.push({ type: 'info', message: `يتم إنفاق حوالي <strong>${Math.round(imagePercentage)}%</strong> من ميزانية الزحف على زحف الصور. تأكد من أن صورك محسّنة بشكل جيد وتستخدم التحميل الكسول (lazy loading).` });
            }
             const cssJsHits = (contentTypeCounts['css'] || 0) + (contentTypeCounts['js'] || 0);
             const cssJsPercentage = (cssJsHits / filteredHits) * 100;
             if(cssJsPercentage > 25) {
                insights.push({ type: 'info', message: `يتم إنفاق حوالي <strong>${Math.round(cssJsPercentage)}%</strong> من ميزانية الزحف على ملفات CSS/JS. تأكد من أن هذه الملفات مُصغرة ومضغوطة ولا يتم الزحف إليها إذا لم تكن ضرورية.` });
             }
        }
        
        return insights;
    }

    function displayComparisonResults(delta404, deltaBots, newPagesCount) {
        const formatDelta = (delta) => {
            if (delta > 0) return `<span class="text-danger"><i class="bi bi-arrow-up"></i> ${delta.toLocaleString()}</span>`;
            if (delta < 0) return `<span class="text-success"><i class="bi bi-arrow-down"></i> ${Math.abs(delta).toLocaleString()}</span>`;
            return `<span>${delta}</span>`;
        };
        delta404El.innerHTML = formatDelta(delta404);
        deltaBotsEl.innerHTML = formatDelta(deltaBots);
        deltaNewPagesEl.textContent = newPagesCount.toLocaleString();
        comparisonContainer.classList.remove('d-none');
    }

    function displayInsights(insights) {
        if (insights.length === 0) {
            insightsContainer.classList.add('d-none');
            return;
        }
        const typeToClass = {
            'danger': 'list-group-item-danger',
            'warning': 'list-group-item-warning',
            'info': 'list-group-item-info'
        };
        const html = insights.map(insight => `<li class="list-group-item ${typeToClass[insight.type]}">${insight.message}</li>`).join('');
        insightsList.innerHTML = html;
        insightsContainer.classList.remove('d-none');
    }

    // --- EVENT LISTENERS ---
    document.addEventListener('analysisComplete', (event) => {
        analysisA = event.detail;
        if (comparisonDropZoneContainer) comparisonDropZoneContainer.classList.remove('d-none');
        // Run primary intelligence on the main file's results
        runPrimaryIntelligenceAnalysis();
    });

    if (comparisonDropZone) {
        comparisonDropZone.addEventListener('click', () => comparisonFileInput.click());
        comparisonFileInput.addEventListener('change', handleComparisonFileSelect);

        comparisonDropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            comparisonDropZone.classList.add("dragover");
        });
        comparisonDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            comparisonDropZone.classList.add("dragover");
        });
        comparisonDropZone.addEventListener('dragleave', () => comparisonDropZone.classList.remove("dragover"));
        comparisonDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            comparisonDropZone.classList.remove("dragover");
            handleComparisonFileSelect({
                target: {
                    files: e.dataTransfer.files
                }
            });
        });
    }

    // --- INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', () => {
        initializeComparisonWorker();
    });

    // --- Helper functions for reading files (needed for this script) ---
    async function readZipFile(file) {
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(file);
        const logFileObject = Object.values(zip.files).find(f => !f.dir && (f.name.endsWith('.log') || f.name.endsWith('.txt')));
        if (logFileObject) return await logFileObject.async("string");
        throw new Error("لم يتم العثور على ملف .log أو .txt داخل الملف المضغوط.");
    }

    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

})();
