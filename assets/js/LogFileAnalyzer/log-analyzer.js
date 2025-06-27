// assets/js/log-analyzer.js
(function() {
    'use strict';
    
    // --- DOM Elements ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const botFilterSelect = document.getElementById('botFilterSelect'); // تم التحديث هنا
    const resultsPlaceholder = document.getElementById('resultsPlaceholder');
    const resultsContainer = document.getElementById('resultsContainer');
    const totalHitsEl = document.getElementById('totalHits');
    const filteredHitsEl = document.getElementById('filteredHits');
    const filteredHitsLabel = document.getElementById('filteredHitsLabel');
    const successHitsEl = document.getElementById('successHits');
    const errorHitsEl = document.getElementById('errorHits');
    const topPagesBody = document.getElementById('topPagesBody');
    const topPagesTitle = document.getElementById('topPagesTitle');

    let logFileContent = null;
    let analysisResultData = null; 
    let crawlTrendChart, statusCodesChart;

    new MutationObserver(() => {
        if (analysisResultData && analysisResultData.filteredData) {
            renderCharts(analysisResultData.filteredData);
        }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

    const LOG_FORMATS = [
        /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d{3}) \S+ "([^"]*)" "([^"]*)"/,
        /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d{3}) \S+$/,
    ];
    
    /**
     * يصنف سلسلة وكيل المستخدم إلى فئة محددة.
     * @param {string} uaString - سلسلة وكيل المستخدم الكاملة.
     * @returns {string} - اسم الفئة (e.g., "Googlebot-Mobile", "Bingbot", "Other").
     */
    function classifyUserAgent(uaString) {
        if (!uaString) return 'Other';
        const ua = uaString.toLowerCase();
        if (ua.includes('google-inspectiontool')) return 'Google-InspectionTool';
        if (ua.includes('googlebot-image')) return 'Googlebot-Image';
        if (ua.includes('googlebot-video')) return 'Googlebot-Video';
        if (ua.includes('googlebot') && ua.includes('mobile')) return 'Googlebot-Mobile';
        if (ua.includes('googlebot')) return 'Googlebot-Desktop';
        if (ua.includes('bingbot')) return 'Bingbot';
        if (ua.includes('yandex')) return 'YandexBot';
        if (ua.includes('duckduckbot')) return 'DuckDuckBot';
        if (ua.includes('ahrefsbot')) return 'AhrefsBot';
        if (ua.includes('semrushbot')) return 'SemrushBot';
        return 'Other';
    }

    // --- Event Listeners ---
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => document.body.addEventListener(e, preventDefaults, false));
    ['dragenter', 'dragover'].forEach(e => document.body.addEventListener(e, () => dropZone.classList.add("dragover"), false));
    ['dragleave', 'drop'].forEach(e => document.body.addEventListener(e, () => dropZone.classList.remove("dragover"), false));
    dropZone.addEventListener("drop", handleFileDrop, false);
    exportJsonBtn.addEventListener('click', exportResults);
    botFilterSelect.addEventListener('change', () => { // تم التحديث هنا
        if (analysisResultData) {
            filterAndDisplay();
        }
    });

    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

    async function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        setLoadingState(true, `جاري معالجة: ${file.name}`);
        try {
            logFileContent = file.name.endsWith('.zip') ? await readZipFile(file) : await readFileContent(file);
            dropZone.querySelector('p').textContent = `ملف جاهز للتحليل: ${file.name}`;
            processLogFile();
        } catch (error) {
            console.error("Error handling file:", error);
            alert("فشل في قراءة الملف. إذا كان ZIP، تأكد من وجود ملف نصي واحد على الأقل.");
            logFileContent = null;
            dropZone.querySelector('p').textContent = "فشلت المعالجة. حاول مرة أخرى.";
        } finally {
            setLoadingState(false);
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
        dropZone.querySelector('p').textContent = message;
        exportJsonBtn.disabled = isLoading || logFileContent === null;
    }
    
    function processLogFile() {
        if (!logFileContent) return;
        setLoadingState(true);

        setTimeout(() => {
            try {
                const lines = logFileContent.split('\n');
                const allParsedLines = [];
                let totalHits = 0;

                lines.forEach(line => {
                    if (line.trim() === '') return;
                    
                    for (const regex of LOG_FORMATS) {
                        const match = line.match(regex);
                        if (match) {
                            totalHits++;
                            allParsedLines.push({
                                userAgent: match[7] || "",
                                botType: classifyUserAgent(match[7] || ""),
                                date: match[2].split(':')[0],
                                request: match[4],
                                statusCode: parseInt(match[5], 10),
                            });
                            break;
                        }
                    }
                });
                
                analysisResultData = { allParsedLines, totalHits };
                filterAndDisplay(); 

            } catch (error) {
                console.error('Error processing log file:', error);
                alert('حدث خطأ أثناء تحليل السجل.');
            } finally {
                setLoadingState(false, dropZone.querySelector('p').textContent);
            }
        }, 10);
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
                    filterMatch = line.botType.startsWith('Googlebot') || line.botType === 'Google-InspectionTool';
                    break;
                case 'bots':
                    filterMatch = line.botType !== 'Other';
                    break;
                default:
                 filterMatch = line.botType.toLowerCase() === filterValue;
                    break;
            }
            
            if (filterMatch) {
                data.filteredHits++;
                data.dailyCounts[line.date] = (data.dailyCounts[line.date] || 0) + 1;
                
                if (line.statusCode >= 200 && line.statusCode < 300) data.successHits++;
                if (line.statusCode >= 400) data.errorHits++;
                
                const statusFamily = `${Math.floor(line.statusCode / 100)}xx`;
                data.statusCounts[statusFamily] = (data.statusCounts[statusFamily] || 0) + 1;

                if (!/\.(css|js|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot|xml|json|webp)$/i.test(line.request) && line.request && line.request !== '*') {
                    if (line.statusCode === 404) {
                        data.notFoundCounts[line.request] = (data.notFoundCounts[line.request] || 0) + 1;
                    } else {
                        data.pageCounts[line.request] = (data.pageCounts[line.request] || 0) + 1;
                    }
                }
            }
        });

        analysisResultData.filteredData = data;
        displayResults();
    }
    
    function displayResults() {
        const { filteredData, totalHits } = analysisResultData;
        
        const selectedOption = botFilterSelect.options[botFilterSelect.selectedIndex];
        const userAgentFilterText = selectedOption.textContent;
        filteredHitsLabel.textContent = `طلبات ${userAgentFilterText}`;
        topPagesTitle.textContent = `أهم الصفحات التي زارها ${userAgentFilterText}`;

        resultsPlaceholder.classList.add('d-none');
        resultsContainer.classList.remove('d-none');
        exportJsonBtn.removeAttribute('disabled');
        exportJsonBtn.classList.remove('disabled');

        totalHitsEl.textContent = totalHits.toLocaleString();
        filteredHitsEl.textContent = filteredData.filteredHits.toLocaleString();
        successHitsEl.textContent = filteredData.successHits.toLocaleString();
        errorHitsEl.textContent = filteredData.errorHits.toLocaleString();

        const sortedPages = Object.entries(filteredData.pageCounts).sort(([, a], [, b]) => b - a).slice(0, 25);
        topPagesBody.innerHTML = sortedPages.length === 0 
            ? '<tr><td colspan="3" class="text-center text-muted">لم يتم العثور على زيارات مطابقة للمرشح.</td></tr>'
            : sortedPages.map(([page, count], index) => `<tr><td>${index + 1}</td><td class="text-start" dir="ltr">${page}</td><td class="text-center">${count.toLocaleString()}</td></tr>`).join('');
        
        const show404ModalBtn = document.getElementById('show404ModalBtn');
        const notFoundPagesBody = document.getElementById('notFoundPagesBody');
        const modalUserAgent = document.getElementById('modalUserAgent');
        modalUserAgent.textContent = userAgentFilterText;
        const sortedNotFound = Object.entries(filteredData.notFoundCounts).sort(([, a], [, b]) => b - a).slice(0, 100);
        if (sortedNotFound.length > 0) {
            notFoundPagesBody.innerHTML = sortedNotFound.map(([page, count], index) => `<tr><td>${index + 1}</td><td class="text-start" dir="ltr">${page}</td><td class="text-center">${count.toLocaleString()}</td></tr>`).join('');
            show404ModalBtn.classList.remove('d-none');
        } else {
            notFoundPagesBody.innerHTML = '';
            show404ModalBtn.classList.add('d-none');
        }
        
        generateInsights(filteredData, totalHits);
        renderCharts(filteredData);
    }
    
    function generateInsights(data, totalHits) {
        const toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) return;
        
        const insights = [];
        if (totalHits > 100) { 
            const totalErrorHits = analysisResultData.allParsedLines.filter(l => l.statusCode >= 400).length;
            const errorRate = totalHits > 0 ? totalErrorHits / totalHits : 0;
            if (errorRate > 0.10) { 
                insights.push({
                    type: 'danger',
                    icon: 'bi-shield-fill-exclamation',
                    title: 'تحذير: نسبة أخطاء مرتفعة!',
                    text: `تمثل الأخطاء أكثر من <strong>${(errorRate * 100).toFixed(1)}%</strong> من إجمالي طلبات الخادم. هذا قد يضر بترتيب موقعك.`
                });
            }
        }
        
        if (data.filteredHits > 50 && Object.keys(data.notFoundCounts).length === 0) {
            const selectedOptionText = botFilterSelect.options[botFilterSelect.selectedIndex].textContent;
            insights.push({
                type: 'success',
                icon: 'bi-patch-check-fill',
                title: 'عمل رائع!',
                text: `لم يتم العثور على أي أخطاء 404 لـ <strong>${selectedOptionText}</strong>. ميزانية الزحف لديك في حالة ممتازة.`
            });
        }
        
        if (insights.length > 0) {
            insights.forEach((insight, index) => {
                const toastId = `insight-toast-${Date.now()}-${index}`;
                const toastHTML = `
                <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-header text-bg-${insight.type}">
                        <i class="bi ${insight.icon} ms-2"></i>
                        <strong class="mx-auto">${insight.title}</strong>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="إغلاق"></button>
                    </div>
                    <div class="toast-body text-end">${insight.text}</div>
                </div>`;
                toastContainer.insertAdjacentHTML('beforeend', toastHTML);
                const toastElement = document.getElementById(toastId);
                const toast = new bootstrap.Toast(toastElement, { delay: 7000 });
                toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
                toast.show();
            });
        }
    }
    
    function exportResults() {
        if (!analysisResultData || !analysisResultData.filteredData) {
            alert('لا توجد بيانات لتصديرها. يرجى تحليل ملف أولاً.');
            return;
        }

        const selectedOption = botFilterSelect.options[botFilterSelect.selectedIndex];
        const exportData = {
            filter: selectedOption.textContent,
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
        try {
            return new Chart(context, config);
        } catch(e) { console.error("Chart.js error:", e); return null; }
    }

    function renderCharts(data) {
        if (!data) return;
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-emphasis-color');
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-border-color-translucent');
        
        const sortedDays = Object.keys(data.dailyCounts).sort((a,b) => new Date(a.replace(/\//g, ' ')) - new Date(b.replace(/\//g, ' ')));
        crawlTrendChart = renderChart(crawlTrendChart, document.getElementById('crawlTrendChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: sortedDays,
                datasets: [{ label: 'عدد الزيارات', data: sortedDays.map(day => data.dailyCounts[day]), borderColor: '#0dcaf0', backgroundColor: 'rgba(13, 202, 240, 0.2)', fill: true, tension: 0.3 }]
            },
            options: { 
                scales: { 
                    y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }, 
                    x: { ticks: { color: textColor }, grid: { color: gridColor } }
                }, 
                plugins: { legend: { display: false } } 
            }
        });

        const statusData = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, ...data.statusCounts };
        statusCodesChart = renderChart(statusCodesChart, document.getElementById('statusCodesChart').getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['نجاح (2xx)', 'إعادة توجيه (3xx)', 'خطأ عميل (4xx)', 'خطأ خادم (5xx)'],
                datasets: [{ data: [statusData['2xx'], statusData['3xx'], statusData['4xx'], statusData['5xx']], backgroundColor: ['#198754', '#ffc107', '#fd7e14', '#dc3545'] }]
            },
            options: { 
                responsive: true, 
                plugins: { 
                    legend: { position: 'bottom', labels: { color: textColor, padding: 15 } } 
                } 
            }
        });
    }

    // --- Copy Email Template Button Logic ---
    const copyEmailBtn = document.getElementById('copyEmailBtn');
    const emailTemplate = document.getElementById('emailTemplate');

    if (copyEmailBtn && emailTemplate) {
        copyEmailBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(emailTemplate.value).then(() => {
                const originalContent = copyEmailBtn.innerHTML;
                copyEmailBtn.disabled = true;
                copyEmailBtn.innerHTML = `<i class="bi bi-check-lg ms-1"></i> تم النسخ بنجاح!`;
                copyEmailBtn.classList.remove('btn-outline-secondary');
                copyEmailBtn.classList.add('btn-success');
                setTimeout(() => {
                    copyEmailBtn.innerHTML = originalContent;
                    copyEmailBtn.disabled = false;
                    copyEmailBtn.classList.remove('btn-success');
                    copyEmailBtn.classList.add('btn-outline-secondary');
                }, 2000);
            }).catch(err => {
                console.error('فشل في نسخ النص:', err);
                alert('عذراً، لم نتمكن من نسخ النص تلقائياً.');
            });
        });
    }
})();