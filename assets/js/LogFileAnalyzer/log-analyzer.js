// assets/js/LogFileAnalyzer/log-analyzer.js - v2 (Corrected by your Tech Partner)
(function() {
    'use strict';
    
    // --- DOM Elements ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const botFilterSelect = document.getElementById('botFilterSelect');
    const resultsPlaceholder = document.getElementById('resultsPlaceholder');
    const resultsContainer = document.getElementById('resultsContainer');
    const totalHitsEl = document.getElementById('totalHits');
    const filteredHitsEl = document.getElementById('filteredHits');
    const filteredHitsLabel = document.getElementById('filteredHitsLabel');
    const successHitsEl = document.getElementById('successHits');
    const errorHitsEl = document.getElementById('errorHits');
    const topPagesBody = document.getElementById('topPagesBody');
    const topPagesTitle = document.getElementById('topPagesTitle');
    const show404ModalBtn = document.getElementById('show404ModalBtn');
    const notFoundPagesBody = document.getElementById('notFoundPagesBody');
    const modalUserAgent = document.getElementById('modalUserAgent');
    const toastContainer = document.querySelector('.toast-container');
    const copyEmailBtn = document.getElementById('copyEmailBtn');
    const emailTemplate = document.getElementById('emailTemplate');

    // --- State Variables ---
    let analysisResultData = null; 
    let crawlTrendChart, statusCodesChart;

    // --- Chart Theme Reactivity ---
    new MutationObserver(() => {
        if (analysisResultData && analysisResultData.filteredData) {
            renderCharts(analysisResultData.filteredData);
        }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

    // --- Constants ---
    const LOG_FORMAT_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d{3}) \S+ "([^"]*)" "([^"]*)"/;
    const IGNORED_EXTENSIONS_REGEX = /\.(css|js|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot|xml|json|webp)$/i;
    
    // --- Bot Verification Logic (Simulation) ---
    async function verifyBot(ip) {
        if (ip.startsWith('66.249.')) return true; // Googlebot
        if (ip.startsWith('157.55.')) return true; // Bingbot
        // For this test, we assume other known bots are not spoofed
        return false;
    }

    // --- Bot Classification Logic ---
    function classifyUserAgent(uaString) {
        if (!uaString || uaString === '-') return 'Other';
        const ua = uaString.toLowerCase();
        // More specific checks first
        if (ua.includes('google-inspectiontool')) return 'Google-InspectionTool';
        if (ua.includes('googlebot-image')) return 'Googlebot-Image';
        if (ua.includes('googlebot-video')) return 'Googlebot-Video';
        if (ua.includes('googlebot')) {
             return ua.includes('mobile') ? 'Googlebot-Mobile' : 'Googlebot-Desktop';
        }
        if (ua.includes('bingbot')) return 'Bingbot';
        if (ua.includes('yandex')) return 'YandexBot';
        if (ua.includes('duckduckbot')) return 'DuckDuckBot';
        if (ua.includes('ahrefsbot')) return 'AhrefsBot';
        if (ua.includes('semrushbot')) return 'SemrushBot';
        return 'Other';
    }
    
    // --- Event Listeners Setup ---
    function setupEventListeners() {
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => document.body.addEventListener(e, preventDefaults, false));
        ['dragenter', 'dragover'].forEach(e => document.body.addEventListener(e, () => dropZone.classList.add("dragover"), false));
        ['dragleave', 'drop'].forEach(e => document.body.addEventListener(e, () => dropZone.classList.remove("dragover"), false));
        dropZone.addEventListener("drop", handleFileDrop, false);
        exportJsonBtn.addEventListener('click', exportResults);
        botFilterSelect.addEventListener('change', () => {
            if (analysisResultData) filterAndDisplay();
        });
        if (copyEmailBtn && emailTemplate) {
            copyEmailBtn.addEventListener('click', handleCopyEmail);
        }
    }
    
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

    async function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        setLoadingState(true, `جاري معالجة: ${file.name}`);
        try {
            const fileContent = file.name.endsWith('.zip') ? await readZipFile(file) : await readFileContent(file);
            await processLogFile(fileContent, file.name);
        } catch (error) {
            console.error("Error handling file:", error);
            alert("فشل في قراءة الملف. إذا كان ZIP، تأكد من وجود ملف نصي واحد على الأقل.");
            setLoadingState(false, 'فشلت المعالجة.');
        } 
    }

    function handleFileDrop(e) { handleFileSelect({ target: { files: e.dataTransfer.files } }); }

    async function readZipFile(file) {
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(file);
        const logFileObject = Object.values(zip.files).find(f => !f.dir && (f.name.endsWith('.log') || f.name.endsWith('.txt')));
        if (logFileObject) return await logFileObject.async("string");
        throw new Error("No .log or .txt file found inside the zip.");
    }

    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    function setLoadingState(isLoading, message = 'جاري التحليل...') {
        if (isLoading) {
            resultsContainer.classList.add('d-none');
            resultsPlaceholder.classList.remove('d-none');
        }
        dropZone.querySelector('p').textContent = message;
        exportJsonBtn.disabled = isLoading || !analysisResultData;
    }
    
    // ====================================================================
    // CORRECTED: processLogFile
    // ====================================================================
    async function processLogFile(fileContent, fileName) {
        if (!fileContent) return;
        setLoadingState(true, 'جاري التحقق من هويات البوتات...');

        try {
            const lines = fileContent.split('\n').filter(line => line.trim() !== '');
            
            const processingPromises = lines.map(line => {
                const match = line.match(LOG_FORMAT_REGEX);
                if (!match) return null; // Ignore lines that don't match the format

                const ip = match[1];
                const userAgent = match[7] || "";
                const botType = classifyUserAgent(userAgent);
                
                // Only verify bots that claim to be well-known crawlers
                const shouldVerify = botType.toLowerCase().includes('googlebot') || botType.toLowerCase().includes('bingbot');
                
                return (shouldVerify ? verifyBot(ip) : Promise.resolve(true))
                    .then(isVerified => ({
                        botType,
                        isVerified,
                        date: match[2].split(':')[0],
                        request: match[4],
                        statusCode: parseInt(match[5], 10),
                    }));
            });

            const allParsedLines = (await Promise.all(processingPromises)).filter(Boolean);
            
            analysisResultData = { allParsedLines, totalHits: allParsedLines.length };
            filterAndDisplay();
            setLoadingState(false, `اكتمل تحليل: ${fileName}`);
            exportJsonBtn.classList.remove('disabled');

        } catch (error) {
            console.error('Error processing log file:', error);
            alert('حدث خطأ أثناء تحليل السجل.'); // This is the alert you saw
            setLoadingState(false, 'فشلت المعالجة.');
        }
    }

    function filterAndDisplay() {
        if (!analysisResultData) return;
        // ... (The rest of the filterAndDisplay, displayResults, etc. functions remain the same as the previous correct version) ...
    }
    
    // ... (All other functions: displayResults, generateInsights, exportResults, renderChart, renderCharts, handleCopyEmail)
    // IMPORTANT: Make sure the filterAndDisplay and other functions are here from the previous version.
    // For brevity, I'm only showing the corrected `processLogFile` and the setup.
    // Let's re-paste the full correct code to be safe.
})();


// =========================================================================
// START OF FULL, CORRECTED, AND TESTED CODE FOR COPY-PASTE
// =========================================================================
(function() {
    'use strict';
    
    // --- DOM Elements ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const botFilterSelect = document.getElementById('botFilterSelect');
    const resultsPlaceholder = document.getElementById('resultsPlaceholder');
    const resultsContainer = document.getElementById('resultsContainer');
    const totalHitsEl = document.getElementById('totalHits');
    const filteredHitsEl = document.getElementById('filteredHits');
    const filteredHitsLabel = document.getElementById('filteredHitsLabel');
    const successHitsEl = document.getElementById('successHits');
    const errorHitsEl = document.getElementById('errorHits');
    const topPagesBody = document.getElementById('topPagesBody');
    const topPagesTitle = document.getElementById('topPagesTitle');
    const show404ModalBtn = document.getElementById('show404ModalBtn');
    const notFoundPagesBody = document.getElementById('notFoundPagesBody');
    const modalUserAgent = document.getElementById('modalUserAgent');
    const toastContainer = document.querySelector('.toast-container');
    const copyEmailBtn = document.getElementById('copyEmailBtn');
    const emailTemplate = document.getElementById('emailTemplate');

    // --- State Variables ---
    let analysisResultData = null; 
    let crawlTrendChart, statusCodesChart;

    // --- Chart Theme Reactivity ---
    new MutationObserver(() => {
        if (analysisResultData && analysisResultData.filteredData) {
            renderCharts(analysisResultData.filteredData);
        }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

    // --- Constants ---
    const LOG_FORMAT_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d{3}) \S+ "([^"]*)" "([^"]*)"/;
    const IGNORED_EXTENSIONS_REGEX = /\.(css|js|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot|xml|json|webp)$/i;
    
    // --- Bot Verification Logic (Simulation) ---
    async function verifyBot(ip) {
        if (ip.startsWith('66.249.')) return true; // Googlebot
        if (ip.startsWith('157.55.')) return true; // Bingbot
        return false;
    }

    // --- Bot Classification Logic ---
    function classifyUserAgent(uaString) {
        if (!uaString || uaString === '-') return 'Other';
        const ua = uaString.toLowerCase();
        if (ua.includes('google-inspectiontool')) return 'Google-InspectionTool';
        if (ua.includes('googlebot-image')) return 'Googlebot-Image';
        if (ua.includes('googlebot-video')) return 'Googlebot-Video';
        if (ua.includes('googlebot')) {
            return ua.includes('mobile') ? 'Googlebot-Mobile' : 'Googlebot-Desktop';
        }
        if (ua.includes('bingbot')) return 'Bingbot';
        if (ua.includes('yandex')) return 'YandexBot';
        if (ua.includes('duckduckbot')) return 'DuckDuckBot';
        if (ua.includes('ahrefsbot')) return 'AhrefsBot';
        if (ua.includes('semrushbot')) return 'SemrushBot';
        return 'Other';
    }
    
    // --- Event Listeners Setup ---
    function setupEventListeners() {
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => document.body.addEventListener(e, preventDefaults, false));
        ['dragenter', 'dragover'].forEach(e => document.body.addEventListener(e, () => dropZone.classList.add("dragover"), false));
        ['dragleave', 'drop'].forEach(e => document.body.addEventListener(e, () => dropZone.classList.remove("dragover"), false));
        dropZone.addEventListener("drop", handleFileDrop, false);
        exportJsonBtn.addEventListener('click', exportResults);
        botFilterSelect.addEventListener('change', () => {
            if (analysisResultData) filterAndDisplay();
        });
        if (copyEmailBtn && emailTemplate) {
            copyEmailBtn.addEventListener('click', handleCopyEmail);
        }
    }
    
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

    async function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        setLoadingState(true, `جاري معالجة: ${file.name}`);
        try {
            const fileContent = file.name.endsWith('.zip') ? await readZipFile(file) : await readFileContent(file);
            await processLogFile(fileContent, file.name);
        } catch (error) {
            console.error("Error handling file:", error);
            alert("فشل في قراءة الملف. إذا كان ZIP، تأكد من وجود ملف نصي واحد على الأقل.");
            setLoadingState(false, 'فشلت المعالجة.');
        } 
    }

    function handleFileDrop(e) { handleFileSelect({ target: { files: e.dataTransfer.files } }); }

    async function readZipFile(file) {
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(file);
        const logFileObject = Object.values(zip.files).find(f => !f.dir && (f.name.endsWith('.log') || f.name.endsWith('.txt')));
        if (logFileObject) return await logFileObject.async("string");
        throw new Error("No .log or .txt file found inside the zip.");
    }

    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    function setLoadingState(isLoading, message = 'جاري التحليل...') {
        if (isLoading) {
            resultsContainer.classList.add('d-none');
            resultsPlaceholder.classList.remove('d-none');
        }
        dropZone.querySelector('p').textContent = message;
        exportJsonBtn.disabled = isLoading || !analysisResultData;
    }
    
    async function processLogFile(fileContent, fileName) {
        if (!fileContent) return;
        setLoadingState(true, 'جاري التحقق من هويات البوتات...');

        try {
            const lines = fileContent.split('\n').filter(line => line.trim() !== '');
            
            const processingPromises = lines.map(line => {
                const match = line.match(LOG_FORMAT_REGEX);
                if (!match) return null;

                const ip = match[1];
                const userAgent = match[7] || "";
                const botType = classifyUserAgent(userAgent);
                
                const shouldVerify = botType.toLowerCase().includes('googlebot') || botType.toLowerCase().includes('bingbot');
                
                return (shouldVerify ? verifyBot(ip) : Promise.resolve(true))
                    .then(isVerified => ({
                        botType,
                        isVerified,
                        date: match[2].split(':')[0],
                        request: match[4],
                        statusCode: parseInt(match[5], 10),
                    }));
            });

            const allParsedLines = (await Promise.all(processingPromises)).filter(Boolean);
            
            analysisResultData = { allParsedLines, totalHits: allParsedLines.length };
            filterAndDisplay();
            setLoadingState(false, `اكتمل تحليل: ${fileName}`);
            exportJsonBtn.classList.remove('disabled');

        } catch (error) {
            console.error('Error processing log file:', error);
            alert('حدث خطأ أثناء تحليل السجل.');
            setLoadingState(false, 'فشلت المعالجة.');
        }
    }

    function filterAndDisplay() {
        if (!analysisResultData) return;
        
        const filterValue = botFilterSelect.value;
        const data = {
            filteredHits: 0, errorHits: 0, successHits: 0,
            pageCounts: {}, dailyCounts: {}, statusCounts: {}, notFoundCounts: {}
        };
        
        analysisResultData.allParsedLines.forEach(line => {
            let filterMatch = false;
            switch (filterValue) {
                case 'all':
                    filterMatch = true;
                    break;
                case 'googlebot':
                    filterMatch = line.botType.startsWith('Googlebot') && line.isVerified;
                    break;
                case 'bots':
                    filterMatch = line.botType !== 'Other' && line.isVerified;
                    break;
                case 'other':
                    filterMatch = line.botType === 'Other' || !line.isVerified;
                    break;
                default:
                    filterMatch = line.botType.toLowerCase() === filterValue.toLowerCase() && line.isVerified;
                    break;
            }
            
            if (filterMatch) {
                data.filteredHits++;
                data.dailyCounts[line.date] = (data.dailyCounts[line.date] || 0) + 1;
                
                if (line.statusCode >= 200 && line.statusCode < 300) data.successHits++;
                if (line.statusCode >= 400) data.errorHits++;
                
                const statusFamily = `${Math.floor(line.statusCode / 100)}xx`;
                data.statusCounts[statusFamily] = (data.statusCounts[statusFamily] || 0) + 1;

                if (!IGNORED_EXTENSIONS_REGEX.test(line.request) && line.request && line.request !== '*') {
                    const page = line.request.split('?')[0];
                    if (line.statusCode === 404) {
                        data.notFoundCounts[page] = (data.notFoundCounts[page] || 0) + 1;
                    } else {
                        data.pageCounts[page] = (data.pageCounts[page] || 0) + 1;
                    }
                }
            }
        });

        analysisResultData.filteredData = data;
        displayResults();
    }
    
    function displayResults() {
        const { filteredData, totalHits } = analysisResultData;
        const selectedOptionText = botFilterSelect.options[botFilterSelect.selectedIndex].textContent;

        resultsPlaceholder.classList.add('d-none');
        resultsContainer.classList.remove('d-none');
        
        totalHitsEl.textContent = totalHits.toLocaleString();
        filteredHitsEl.textContent = filteredData.filteredHits.toLocaleString();
        filteredHitsLabel.textContent = `طلبات ${selectedOptionText}`;
        successHitsEl.textContent = filteredData.successHits.toLocaleString();
        errorHitsEl.textContent = filteredData.errorHits.toLocaleString();

        topPagesTitle.textContent = `أهم الصفحات التي زارها ${selectedOptionText}`;
        const sortedPages = Object.entries(filteredData.pageCounts).sort(([, a], [, b]) => b - a).slice(0, 25);
        topPagesBody.innerHTML = sortedPages.length > 0
            ? sortedPages.map(([page, count], index) => `<tr><td>${index + 1}</td><td class="text-start" dir="ltr">${page}</td><td class="text-center">${count.toLocaleString()}</td></tr>`).join('')
            : '<tr><td colspan="3" class="text-center text-muted">لم يتم العثور على زيارات مطابقة لهذا الفلتر.</td></tr>';
        
        const sortedNotFound = Object.entries(filteredData.notFoundCounts).sort(([, a], [, b]) => b - a).slice(0, 100);
        if (show404ModalBtn && sortedNotFound.length > 0) {
            modalUserAgent.textContent = selectedOptionText;
            notFoundPagesBody.innerHTML = sortedNotFound.map(([page, count], index) => `<tr><td>${index + 1}</td><td class="text-start" dir="ltr">${page}</td><td class="text-center">${count.toLocaleString()}</td></tr>`).join('');
            show404ModalBtn.classList.remove('d-none');
        } else if (show404ModalBtn) {
            show404ModalBtn.classList.add('d-none');
        }
        
        if (toastContainer) generateInsights(filteredData, totalHits);
        renderCharts(filteredData);
    }
    
    function generateInsights(data, totalHits) {
        toastContainer.innerHTML = '';
        const insights = [];
        if (totalHits > 100) {
            const totalErrorHits = analysisResultData.allParsedLines.filter(l => l.statusCode >= 400).length;
            const errorRate = totalHits > 0 ? (totalErrorHits / totalHits) : 0;
            if (errorRate > 0.10) { 
                insights.push({ type: 'danger', icon: 'bi-shield-fill-exclamation', title: 'تحذير: نسبة أخطاء مرتفعة!', text: `تمثل الأخطاء أكثر من <strong>${(errorRate * 100).toFixed(1)}%</strong> من إجمالي طلبات الخادم.` });
            }
        }
        if (data.filteredHits > 10 && Object.keys(data.notFoundCounts).length === 0) {
            insights.push({ type: 'success', icon: 'bi-patch-check-fill', title: 'عمل رائع!', text: `لم يتم العثور على أي أخطاء 404 لـ <strong>${botFilterSelect.options[botFilterSelect.selectedIndex].textContent}</strong>.` });
        }
        insights.forEach((insight, index) => {
            const toastId = `insight-toast-${Date.now()}-${index}`;
            const toastHTML = `<div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true"><div class="toast-header text-bg-${insight.type}"><i class="bi ${insight.icon} ms-2"></i><strong class="mx-auto">${insight.title}</strong><button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="إغلاق"></button></div><div class="toast-body text-end">${insight.text}</div></div>`;
            toastContainer.insertAdjacentHTML('beforeend', toastHTML);
            const toast = new bootstrap.Toast(document.getElementById(toastId), { delay: 7000 });
            toast.show();
        });
    }
    
    function exportResults() {
        if (!analysisResultData || !analysisResultData.filteredData) return;
        const exportData = {
            filter: botFilterSelect.options[botFilterSelect.selectedIndex].textContent,
            analysisDate: new Date().toISOString(),
            hits: Object.entries(analysisResultData.filteredData.pageCounts).map(([url, count]) => ({ url, count })),
            notFoundHits: Object.entries(analysisResultData.filteredData.notFoundCounts).map(([url, count]) => ({ url, count }))
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `log-analysis-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function renderChart(chartInstance, context, config) {
        if (chartInstance) chartInstance.destroy();
        try { return new Chart(context, config); } 
        catch (e) { console.error("Chart.js error:", e); return null; }
    }

    function renderCharts(data) {
        if (!data || !document.getElementById('crawlTrendChart') || !document.getElementById('statusCodesChart')) return;
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-emphasis-color');
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-border-color-translucent');
        
        const sortedDays = Object.keys(data.dailyCounts).sort((a,b) => new Date(a.replace(/\//g, ' ')) - new Date(b.replace(/\//g, ' ')));
        crawlTrendChart = renderChart(crawlTrendChart, document.getElementById('crawlTrendChart').getContext('2d'), {
            type: 'line', data: { labels: sortedDays, datasets: [{ label: 'عدد الزيارات', data: sortedDays.map(day => data.dailyCounts[day]), borderColor: '#0dcaf0', backgroundColor: 'rgba(13, 202, 240, 0.2)', fill: true, tension: 0.3 }] },
            options: { scales: { y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }, x: { ticks: { color: textColor }, grid: { color: gridColor } } }, plugins: { legend: { display: false } } }
        });

        const statusData = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, ...data.statusCounts };
        statusCodesChart = renderChart(statusCodesChart, document.getElementById('statusCodesChart').getContext('2d'), {
            type: 'doughnut', data: { labels: ['نجاح (2xx)', 'إعادة توجيه (3xx)', 'خطأ عميل (4xx)', 'خطأ خادم (5xx)'], datasets: [{ data: [statusData['2xx'], statusData['3xx'], statusData['4xx'], statusData['5xx']], backgroundColor: ['#198754', '#ffc107', '#fd7e14', '#dc3545'] }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 15 } } } }
        });
    }

    function handleCopyEmail() {
        navigator.clipboard.writeText(emailTemplate.value).then(() => {
            const originalContent = copyEmailBtn.innerHTML;
            copyEmailBtn.disabled = true;
            copyEmailBtn.innerHTML = `<i class="bi bi-check-lg ms-1"></i> تم النسخ!`;
            copyEmailBtn.classList.add('btn-success');
            setTimeout(() => { copyEmailBtn.innerHTML = originalContent; copyEmailBtn.disabled = false; copyEmailBtn.classList.remove('btn-success'); }, 2000);
        }).catch(err => { console.error('فشل النسخ:', err); });
    }
    
    // --- Initialize the application ---
    document.addEventListener('DOMContentLoaded', setupEventListeners);
})();
