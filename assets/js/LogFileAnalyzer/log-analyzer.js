// assets/js/log-analyzer.js - FINAL, ENHANCED, AND CORRECTED (v3)

(function() {
    'use strict';

    // --- DOM Elements ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const dropZoneText = document.getElementById('dropZoneText');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const clearBtn = document.getElementById('clearBtn');
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
    const resetTopPagesFilterBtn = document.getElementById('resetTopPagesFilterBtn');
    const show404ModalBtn = document.getElementById('show404ModalBtn');
    const notFoundPagesBody = document.getElementById('notFoundPagesBody');
    const modalUserAgent = document.getElementById('modalUserAgent');
    const copyEmailBtn = document.getElementById('copyEmailBtn');
    const emailTemplate = document.getElementById('emailTemplate');
    const expertModeContainer = document.getElementById('expertModeContainer');
    const expertModeToggle = document.getElementById('expertModeToggle');
    const advancedAnalyticsContainer = document.getElementById('advancedAnalyticsContainer');
    const topUserAgentsBody = document.getElementById('topUserAgentsBody');
    const exportTrendChartBtn = document.getElementById('exportTrendChart');
    const exportStatusChartBtn = document.getElementById('exportStatusChart');
    const exportContentTypeChartBtn = document.getElementById('exportContentTypeChart');
    const exportCrawlDepthChartBtn = document.getElementById('exportCrawlDepthChart');
    const blockUserAgentModal = document.getElementById('blockUserAgentModal');

    // --- State Variables ---
    let analysisResultData = null;
    let crawlTrendChart, statusCodesChart, contentTypeChart, crawlDepthChart;
    let logWorker;
    let activeUserAgentFilter = null;

    // --- Constants ---
    const IGNORED_EXTENSIONS_REGEX = /\.(css|js|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot|xml|json|webp)$/i;
    const SESSION_STORAGE_KEY = 'logAnalyzerSession';
    const CHART_COLORS = [
        '#0d6efd', '#fd7e14', '#198754', '#d63384',
        '#6f42c1', '#20c997', '#ffc107', '#dc3545',
        '#0dcaf0', '#6c757d'
    ];


    // --- Chart Theme Reactivity ---
    new MutationObserver(() => {
        if (analysisResultData && analysisResultData.filteredData) {
            displayResults();
        }
    }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-bs-theme']
    });

    function initializeWorker() {
        if (!window.Worker) {
            alert("المتصفح الخاص بك لا يدعم Web Workers، قد يكون الأداء بطيئًا.");
            return;
        }
        logWorker = new Worker('../assets/js/LogFileAnalyzer/log-worker.js');
        logWorker.onmessage = function(event) {
            const {
                type,
                progress,
                result,
                error
            } = event.data;
            if (type === 'progress') {
                const progressPercentage = Math.round(progress);
                let message = `جاري التحليل... (${progressPercentage}%)`;
                if (progressPercentage > 95) message = `جاري تجميع النتائج النهائية...`;
                setLoadingState(true, message);
            } else if (type === 'complete') {
                const analysisEvent = new CustomEvent('analysisComplete', {
                    detail: result
                });
                document.dispatchEvent(analysisEvent);
                analysisResultData = result;
                setLoadingState(false, 'اكتمل التحليل بنجاح!');
                filterAndDisplay();
            } else if (error) {
                handleError(error);
            }
        };
    }

    function handleError(errorMessage) {
        console.error("Analysis Error:", errorMessage);
        alert(`حدث خطأ: ${errorMessage}`);
        resetUI(true);
    }

    function resetUI(fullReset = false) {
        if (fullReset) {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
        analysisResultData = null;
        activeUserAgentFilter = null;
        resultsContainer.classList.add('d-none');
        clearBtn.classList.add('d-none');
        expertModeContainer.classList.add('d-none');
        advancedAnalyticsContainer.classList.add('d-none');
        resultsPlaceholder.classList.remove('d-none');
        resetTopPagesFilterBtn.classList.add('d-none');


        totalHitsEl.textContent = '0';
        filteredHitsEl.textContent = '0';
        successHitsEl.textContent = '0';
        errorHitsEl.textContent = '0';
        topPagesBody.innerHTML = '';
        notFoundPagesBody.innerHTML = '';
        topUserAgentsBody.innerHTML = '';
        if (show404ModalBtn) show404ModalBtn.classList.add('d-none');

        [exportJsonBtn, exportCsvBtn].forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.classList.add('disabled');
            }
        });

        [crawlTrendChart, statusCodesChart, contentTypeChart, crawlDepthChart].forEach(chart => {
            if (chart) chart.destroy();
        });
        crawlTrendChart = statusCodesChart = contentTypeChart = crawlDepthChart = null;

        if (fileInput) fileInput.value = '';
        if (dropZoneText) dropZoneText.textContent = 'اسحب وأفلت ملف السجل هنا';
    }

    function setLoadingState(isLoading, message = 'جاري التحليل...') {
        if (dropZoneText) dropZoneText.textContent = message;
        if (fileInput) fileInput.disabled = isLoading;
        [exportJsonBtn, exportCsvBtn, clearBtn].forEach(btn => {
            if (btn) btn.disabled = isLoading;
        });
    }

    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        resetUI(true);
        setLoadingState(true, `جاري قراءة: ${file.name}`);
        try {
            const fileContent = file.name.endsWith('.zip') ? await readZipFile(file) : await readFileContent(file);
            if (logWorker) {
                setLoadingState(true, 'بدء التحليل...');
                logWorker.postMessage(fileContent);
            }
        } catch (error) {
            handleError(error.message);
        }
    }

    function filterAndDisplay() {
        if (!analysisResultData) return;
        activeUserAgentFilter = null; // Reset sub-filter when main filter changes

        const filterValue = botFilterSelect.value;
        const data = {
            filteredHits: 0,
            errorHits: 0,
            successHits: 0,
            pageCounts: {},
            dailyCounts: {},
            statusCounts: {},
            notFoundCounts: {},
            contentTypeCounts: {},
            crawlDepthCounts: {},
            userAgentCounts: {}
        };

        analysisResultData.allParsedLines.forEach(line => {
            let filterMatch = false;
            const isVerifiedBot = line.botType !== 'Other' && line.isVerified;
            switch (filterValue) {
                case 'all':
                    filterMatch = true;
                    break;
                case 'googlebot':
                    filterMatch = line.botType.startsWith('Googlebot') && line.isVerified;
                    break;
                case 'bots':
                    filterMatch = isVerifiedBot;
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
                const statusCode = line.statusCode;

                if (statusCode >= 200 && statusCode < 300) data.successHits++;
                if (statusCode >= 400) data.errorHits++;
                const statusFamily = `${Math.floor(statusCode / 100)}xx`;
                data.statusCounts[statusFamily] = (data.statusCounts[statusFamily] || 0) + 1;

                if (line.request && line.request !== '*') {
                    const page = line.request.split('?')[0];

                    if (!IGNORED_EXTENSIONS_REGEX.test(page)) {
                        const targetGroup = (statusCode === 404) ? data.notFoundCounts : data.pageCounts;
                        if (!targetGroup[page]) {
                            targetGroup[page] = {
                                count: 0,
                                ips: {}
                            };
                        }
                        targetGroup[page].count++;
                        targetGroup[page].ips[line.ip] = (targetGroup[page].ips[line.ip] || 0) + 1;
                    }

                    const extensionMatch = page.match(/\.([a-zA-Z0-9]+)$/);
                    let contentType = extensionMatch ? extensionMatch[1].toLowerCase() : 'html';
                    if (contentType.length > 5) contentType = 'other'; // Normalize long extensions
                    data.contentTypeCounts[contentType] = (data.contentTypeCounts[contentType] || 0) + 1;

                    const depth = (page.match(/\//g) || []).length - 1;
                    const depthLabel = `عمق ${depth < 0 ? 0 : depth}`;
                    data.crawlDepthCounts[depthLabel] = (data.crawlDepthCounts[depthLabel] || 0) + 1;

                    if (line.botType === 'Other' && line.userAgent) {
                        data.userAgentCounts[line.userAgent] = (data.userAgentCounts[line.userAgent] || 0) + 1;
                    }
                }
            }
        });
        analysisResultData.filteredData = data;
        saveSession();
        displayResults();
    }

    function displayResults() {
        if (!analysisResultData || !analysisResultData.filteredData) return;

        const {
            filteredData,
            totalHits
        } = analysisResultData;
        const selectedOptionText = botFilterSelect.options[botFilterSelect.selectedIndex].textContent;
        const hasData = totalHits > 0;

        [exportJsonBtn, exportCsvBtn].forEach(btn => {
            if (btn) {
                btn.disabled = !hasData;
                btn.classList.toggle('disabled', !hasData);
            }
        });
        if (clearBtn) {
            clearBtn.disabled = !hasData;
            clearBtn.classList.toggle('d-none', !hasData);
        }
        if (expertModeContainer) {
            expertModeContainer.classList.toggle('d-none', !hasData);
        }

        resultsPlaceholder.classList.toggle('d-none', hasData);
        resultsContainer.classList.toggle('d-none', !hasData);

        if (!hasData) return;

        totalHitsEl.textContent = totalHits.toLocaleString();
        filteredHitsEl.textContent = filteredData.filteredHits.toLocaleString();
        filteredHitsLabel.querySelector('i').setAttribute('data-bs-title', `إجمالي عدد الطلبات التي تطابق الفلتر المحدد (${selectedOptionText}).`);
        filteredHitsLabel.firstChild.nodeValue = `${selectedOptionText} `;

        successHitsEl.textContent = filteredData.successHits.toLocaleString();
        errorHitsEl.textContent = filteredData.errorHits.toLocaleString();

        renderTopPagesTable(); // Initial render for the main filter

        const sortedNotFound = Object.entries(filteredData.notFoundCounts).sort(([, a], [, b]) => b.count - a.count);
        if (show404ModalBtn) {
            const has404 = sortedNotFound.length > 0;
            show404ModalBtn.classList.toggle('d-none', !has404);
            if (has404) {
                modalUserAgent.textContent = selectedOptionText;
                notFoundPagesBody.innerHTML = sortedNotFound.map(([page, pageData], index) => `<tr><td>${index + 1}</td><td class="text-start" dir="ltr">${page}</td><td class="text-center">${pageData.count.toLocaleString()}</td></tr>`).join('');
            }
        }

        renderPrimaryCharts(filteredData);
        renderAdvancedCharts(filteredData);
        renderUserAgentsTable(filteredData.userAgentCounts);
    }

    function saveSession() {
        if (!analysisResultData) return;
        try {
            const session = {
                analysisResultData: analysisResultData,
                filterValue: botFilterSelect.value
            };
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        } catch (e) {
            console.warn("Could not save session, it might be too large.", e);
        }
    }

    function loadSession() {
        const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                analysisResultData = session.analysisResultData;
                botFilterSelect.value = session.filterValue;
                setLoadingState(false, 'تم استعادة الجلسة السابقة');
                const analysisEvent = new CustomEvent('analysisComplete', {
                    detail: analysisResultData
                });
                document.dispatchEvent(analysisEvent);
                filterAndDisplay();
            } catch (e) {
                console.error("Failed to load previous session.", e);
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
            }
        }
    }

    function downloadFile(blob, fileName) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        }, 100);
    }

    function exportChart(chart, filename) {
        if (!chart) return;
        const a = document.createElement('a');
        a.href = chart.toBase64Image();
        a.download = filename;
        a.click();
    }

    // --- Chart Rendering ---
    function renderPrimaryCharts(data) {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color');
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-border-color-translucent');

        if (crawlTrendChart) crawlTrendChart.destroy();
        const sortedDays = Object.keys(data.dailyCounts).sort((a, b) => new Date(a.replace(/\//g, ' ')) - new Date(b.replace(/\//g, ' ')));
        crawlTrendChart = new Chart(document.getElementById('crawlTrendChart').getContext('2d'), {
            type: 'line',
            data: {
                labels: sortedDays,
                datasets: [{
                    label: 'عدد الزيارات',
                    data: sortedDays.map(day => data.dailyCounts[day]),
                    borderColor: '#0dcaf0',
                    backgroundColor: 'rgba(13, 202, 240, 0.2)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            precision: 0
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });

        if (statusCodesChart) statusCodesChart.destroy();
        const statusData = {
            '2xx': 0,
            '3xx': 0,
            '4xx': 0,
            '5xx': 0,
            ...data.statusCounts
        };
        statusCodesChart = new Chart(document.getElementById('statusCodesChart').getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['نجاح (2xx)', 'إعادة توجيه (3xx)', 'خطأ عميل (4xx)', 'خطأ خادم (5xx)'],
                datasets: [{
                    data: [statusData['2xx'], statusData['3xx'], statusData['4xx'], statusData['5xx']],
                    backgroundColor: ['#198754', '#ffc107', '#fd7e14', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            padding: 15
                        }
                    }
                }
            }
        });
    }

    function renderAdvancedCharts(data) {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color');

        if (contentTypeChart) contentTypeChart.destroy();
        const sortedContentTypes = Object.entries(data.contentTypeCounts).sort(([, a], [, b]) => b - a).slice(0, 10);
        contentTypeChart = new Chart(document.getElementById('contentTypeChart').getContext('2d'), {
            type: 'pie',
            data: {
                labels: sortedContentTypes.map(([type]) => type),
                datasets: [{
                    data: sortedContentTypes.map(([, count]) => count),
                    backgroundColor: CHART_COLORS
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: textColor,
                            padding: 10
                        }
                    }
                }
            }
        });

        if (crawlDepthChart) crawlDepthChart.destroy();
        const sortedDepths = Object.entries(data.crawlDepthCounts).sort(([a], [b]) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));
        crawlDepthChart = new Chart(document.getElementById('crawlDepthChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: sortedDepths.map(([depth]) => depth),
                datasets: [{
                    label: 'عدد الطلبات',
                    data: sortedDepths.map(([, count]) => count),
                    backgroundColor: CHART_COLORS[0]
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            precision: 0
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // --- Command Center Implementation ---

    function classifyUnknownUserAgent(uaString) {
        if (!uaString) return {
            classification: 'غير معروف',
            class: 'secondary',
            tooltip: 'لم يتم توفير وكيل مستخدم.',
            type: 'unknown'
        };
        const ua = uaString.toLowerCase();
        if (/\b(python|scrapy|curl|java|wget|go-http-client|aiohttp)\b/i.test(ua)) {
            return {
                classification: 'بوت برمجي',
                class: 'danger',
                tooltip: 'هذا وكيل مستخدم شائع تستخدمه برامج سحب المحتوى (Scrapers). راقب نشاطه.',
                type: 'script'
            };
        }
        if (/\b(uptimerobot|monitor|validator|sitechecker)\b/i.test(ua)) {
            return {
                classification: 'بوت خدمة',
                class: 'info',
                tooltip: 'هذا بوت مخصص لمراقبة أداء أو صحة الموقع.',
                type: 'service'
            };
        }
        if (/\b(mozilla|chrome|firefox|safari|edg|opera)\b/i.test(ua)) {
            return {
                classification: 'متصفح ويب',
                class: 'success',
                tooltip: 'يبدو كأنه متصفح ويب يستخدمه زائر بشري.',
                type: 'browser'
            };
        }
        return {
            classification: 'غير معروف',
            class: 'secondary',
            tooltip: 'لم يتم التعرف على نوع هذا الوكيل.',
            type: 'unknown'
        };
    }

    function renderUserAgentsTable(userAgentData) {
        const sortedUserAgents = Object.entries(userAgentData).sort(([, a], [, b]) => b - a).slice(0, 25);
        if (sortedUserAgents.length === 0) {
            topUserAgentsBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">لا يوجد وكلاء مستخدم غير معروفين.</td></tr>`;
            return;
        }

        topUserAgentsBody.innerHTML = sortedUserAgents.map(([ua, count]) => {
            const classificationInfo = classifyUnknownUserAgent(ua);
            const encodedUa = ua.replace(/"/g, '"'); // Sanitize for attribute

            let actionBtn = '';
            if (classificationInfo.type === 'script') {
                actionBtn = `<button class="btn btn-outline-danger btn-sm p-1" data-bs-toggle="modal" data-bs-target="#blockUserAgentModal" data-user-agent="${encodedUa}" title="إنشاء قاعدة حظر لهذا البوت"><i class="bi bi-shield-slash"></i></button>`;
            }

            return `
                <tr data-user-agent="${encodedUa}" style="cursor: pointer;" title="انقر لتصفية الصفحات التي زارها هذا الوكيل">
                    <td class="text-start" dir="ltr"><small>${ua}</small></td>
                    <td class="text-center">
                        <span class="badge bg-${classificationInfo.class}" data-bs-toggle="tooltip" title="${classificationInfo.tooltip}">${classificationInfo.classification}</span>
                    </td>
                    <td class="text-center">${count.toLocaleString()}</td>
                    <td class="text-center">${actionBtn}</td>
                </tr>`;
        }).join('');
    }

    function renderTopPagesTable() {
        if (!analysisResultData) return;

        let title;
        let pageCounts;

        if (activeUserAgentFilter) {
            title = `أهم الصفحات التي زارها: <code class="text-body-emphasis small" dir="ltr">${activeUserAgentFilter}</code>`;
            const pageSourceData = analysisResultData.allParsedLines.filter(line => line.userAgent === activeUserAgentFilter);
            const calculatedCounts = {};
            pageSourceData.forEach(line => {
                if (line.request && line.request !== '*' && !IGNORED_EXTENSIONS_REGEX.test(line.request)) {
                    const page = line.request.split('?')[0];
                    if (!calculatedCounts[page]) {
                        calculatedCounts[page] = {
                            count: 0,
                            ips: {}
                        };
                    }
                    calculatedCounts[page].count++;
                    calculatedCounts[page].ips[line.ip] = (calculatedCounts[page].ips[line.ip] || 0) + 1;
                }
            });
            pageCounts = calculatedCounts;
            resetTopPagesFilterBtn.classList.remove('d-none');
        } else {
            const selectedOptionText = botFilterSelect.options[botFilterSelect.selectedIndex].textContent;
            title = `أهم الصفحات التي زارها ${selectedOptionText}`;
            pageCounts = analysisResultData.filteredData.pageCounts;
            resetTopPagesFilterBtn.classList.add('d-none');
        }

        topPagesTitle.innerHTML = title;
        topPagesBody.innerHTML = generateTopPagesHtml(pageCounts);
    }

    function generateTopPagesHtml(pageCountsObject) {
        const sortedPages = Object.entries(pageCountsObject).sort(([, a], [, b]) => b.count - a.count).slice(0, 50);
        if (sortedPages.length === 0) {
            return `<tr><td colspan="4" class="text-center text-muted">لم يتم العثور على زيارات مطابقة لهذا الفلتر.</td></tr>`;
        }
        return sortedPages.map(([page, pageData], index) => {
            const topIpsHtml = Object.entries(pageData.ips).sort(([, a], [, b]) => b - a).slice(0, 3).map(([ip, count]) => {
                const verificationUrl = `https://mxtoolbox.com/SuperTool.aspx?action=ptr:${encodeURIComponent(ip)}&run=toolpage`;
                return `<div class="d-flex justify-content-between align-items-center py-1"><code dir="ltr">${ip}</code><div class="d-flex align-items-center gap-2"><span class="badge bg-light text-dark border border-secondary-subtle rounded-pill">${count.toLocaleString()}</span><a href="${verificationUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-secondary btn-sm p-0 px-1" style="line-height: 1;" title="التحقق من هذا الـ IP باستخدام MXToolbox" aria-label="التحقق من IP ${ip}"><i class="bi bi-shield-check" aria-hidden="true"></i></a></div></div>`;
            }).join('<hr class="my-1">');
            return `<tr><td>${index + 1}</td><td class="text-start" dir="ltr" style="max-width: 300px; word-wrap: break-word;">${page}</td><td class="text-center">${pageData.count.toLocaleString()}</td><td class="text-center" style="min-width: 220px;">${topIpsHtml || 'N/A'}</td></tr>`;
        }).join('');
    }


    // --- UPGRADED: Export Functions ---
    function getFullAnalysisData() {
        if (!analysisResultData || !analysisResultData.filteredData) return null;

        const {
            allParsedLines,
            filteredData,
            totalHits
        } = analysisResultData;
        const selectedOptionText = botFilterSelect.options[botFilterSelect.selectedIndex].textContent;

        const dates = allParsedLines.map(l => l.date).filter(Boolean);
        const sortedUniqueDates = [...new Set(dates)].sort((a, b) => new Date(a.replace(/\//g, ' ')) - new Date(b.replace(/\//g, ' ')));
        const startDate = sortedUniqueDates[0] || 'N/A';
        const endDate = sortedUniqueDates[sortedUniqueDates.length - 1] || 'N/A';

        const processPageData = (pageDataObject) => Object.entries(pageDataObject).sort(([, a], [, b]) => b.count - a.count).map(([url, data]) => ({
            url,
            hits: data.count,
            topIps: Object.entries(data.ips).sort(([, a], [, b]) => b - a).slice(0, 5).map(([ip, count]) => `${ip} (${count})`)
        }));

        return {
            metadata: {
                reportTitle: `تحليل لـ: ${selectedOptionText}`,
                analysisDate: new Date().toISOString(),
                logFileTimeRange: `${startDate} to ${endDate}`
            },
            summary_ForFilter: {
                totalHitsInFile: totalHits,
                filteredHits: filteredData.filteredHits,
                successHits: filteredData.successHits,
                errorHits: filteredData.errorHits
            },
            advanced_ForFilter: {
                contentTypes: Object.entries(filteredData.contentTypeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => ({
                    type,
                    count
                })),
                crawlDepth: Object.entries(filteredData.crawlDepthCounts).sort(([a], [b]) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1])).map(([depth, count]) => ({
                    depth,
                    count
                })),
            },
            topCrawledPages_ForFilter: processPageData(filteredData.pageCounts),
            top404Errors_ForFilter: processPageData(filteredData.notFoundCounts),
            topUnknownUserAgents_ForFilter: Object.entries(filteredData.userAgentCounts).sort(([, a], [, b]) => b - a).slice(0, 20).map(([userAgent, count]) => ({
                userAgent,
                count
            })),
        };
    }

    function exportToJson() {
        const data = getFullAnalysisData();
        if (!data) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }
        const filterName = botFilterSelect.value.replace(/[^a-z0-9]/gi, '_');
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        downloadFile(blob, `log_analysis_${filterName}_${Date.now()}.json`);
    }

    async function exportToCsv() {
        const data = getFullAnalysisData();
        if (!data) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }

        const zip = new JSZip();
        const BOM = "\uFEFF"; // For UTF-8 support in Excel

        const toCsv = (headers, dataRows) => {
            const headerRow = headers.join(',');
            const bodyRows = dataRows.map(row =>
                headers.map(header => {
                    let value = row[header] ?? '';
                    if (Array.isArray(value)) value = value.join('; ');
                    return `"${String(value).replace(/"/g, '""')}"`;
                }).join(',')
            );
            return [headerRow, ...bodyRows].join('\n');
        };

        const summaryHeaders = ['metric', 'value'];
        const summaryRows = Object.entries(data.summary_ForFilter).map(([key, val]) => ({
            metric: key,
            value: val
        }));
        summaryRows.unshift({
            metric: 'reportTitle',
            value: data.metadata.reportTitle
        });
        zip.file("01_summary.csv", BOM + toCsv(summaryHeaders, summaryRows));
        if (data.topCrawledPages_ForFilter.length > 0) {
            zip.file("02_top_crawled_pages.csv", BOM + toCsv(['url', 'hits', 'topIps'], data.topCrawledPages_ForFilter));
        }
        if (data.top404Errors_ForFilter.length > 0) {
            zip.file("03_top_404_errors.csv", BOM + toCsv(['url', 'hits', 'topIps'], data.top404Errors_ForFilter));
        }
        if (data.advanced_ForFilter.contentTypes.length > 0) {
            zip.file("04_content_type_analysis.csv", BOM + toCsv(['type', 'count'], data.advanced_ForFilter.contentTypes));
        }
        if (data.advanced_ForFilter.crawlDepth.length > 0) {
            zip.file("05_crawl_depth_analysis.csv", BOM + toCsv(['depth', 'count'], data.advanced_ForFilter.crawlDepth));
        }
        if (data.topUnknownUserAgents_ForFilter.length > 0) {
            zip.file("06_unknown_user_agents.csv", BOM + toCsv(['userAgent', 'count'], data.topUnknownUserAgents_ForFilter));
        }

        const filterName = botFilterSelect.value.replace(/[^a-z0-9]/gi, '_');
        const content = await zip.generateAsync({
            type: "blob"
        });
        downloadFile(content, `log_analysis_report_${filterName}_${Date.now()}.zip`);
    }

    // --- Event Listeners and Initialization ---
    document.addEventListener('DOMContentLoaded', () => {
        initializeWorker();
        loadSession();

        new bootstrap.Tooltip(document.body, {
            selector: "[data-bs-toggle='tooltip']"
        });

        if (dropZone) {
            dropZone.addEventListener('click', () => fileInput.click());
            dropZone.addEventListener('dragenter', (e) => {
                e.preventDefault();
                dropZone.classList.add("dragover");
            });
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add("dragover");
            });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove("dragover"));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove("dragover");
                handleFileSelect({
                    target: {
                        files: e.dataTransfer.files
                    }
                });
            });
        }

        if (fileInput) fileInput.addEventListener('change', handleFileSelect);
        if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportToJson);
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);
        if (clearBtn) clearBtn.addEventListener('click', () => resetUI(true));
        if (botFilterSelect) botFilterSelect.addEventListener('change', () => {
            if (analysisResultData) filterAndDisplay();
        });
        if (copyEmailBtn) copyEmailBtn.addEventListener('click', () => copyToClipboard(emailTemplate.value, copyEmailBtn, true));

        if (expertModeToggle) {
            expertModeToggle.addEventListener('change', (e) => {
                advancedAnalyticsContainer.classList.toggle('d-none', !e.target.checked);
            });
        }

        // Command Center Listeners
        topUserAgentsBody.addEventListener('click', (event) => {
            const row = event.target.closest('tr[data-user-agent]');
            if (!row) return;

            const currentActive = topUserAgentsBody.querySelector('tr.table-primary');
            if (currentActive) currentActive.classList.remove('table-primary');

            const userAgent = row.dataset.userAgent;
            if (activeUserAgentFilter === userAgent) { // If clicking the same row again, deselect
                activeUserAgentFilter = null;
            } else {
                activeUserAgentFilter = userAgent;
                row.classList.add('table-primary');
            }
            renderTopPagesTable();
        });

        resetTopPagesFilterBtn.addEventListener('click', () => {
            activeUserAgentFilter = null;
            const currentActive = topUserAgentsBody.querySelector('tr.table-primary');
            if (currentActive) currentActive.classList.remove('table-primary');
            renderTopPagesTable();
        });

        if (blockUserAgentModal) {
            blockUserAgentModal.addEventListener('show.bs.modal', event => {
                const button = event.relatedTarget;
                const userAgent = button.dataset.userAgent;
                const modalTitle = blockUserAgentModal.querySelector('.modal-title');
                const robotsTxtRule = blockUserAgentModal.querySelector('#robotsTxtRule');
                const htaccessRule = blockUserAgentModal.querySelector('#htaccessRule');

                modalTitle.innerHTML = `<i class="bi bi-shield-slash-fill ms-2 text-danger"></i> إنشاء قاعدة حظر لـ <code dir="ltr" class="small">${userAgent}</code>`;

                robotsTxtRule.value = `User-agent: ${userAgent}\nDisallow: /`;
                htaccessRule.value = `RewriteEngine On\nRewriteCond %{HTTP_USER_AGENT} "${userAgent.replace(/"/g, '\\"')}" [NC]\nRewriteRule .* - [F,L]`;
            });

            blockUserAgentModal.addEventListener('click', event => {
                const button = event.target.closest('.copy-rule-btn');
                if (!button) return;
                const targetId = button.dataset.targetId;
                const textarea = document.getElementById(targetId);
                copyToClipboard(textarea.value, button);
            });
        }

        if (exportTrendChartBtn) exportTrendChartBtn.addEventListener('click', () => exportChart(crawlTrendChart, 'crawl-trend.png'));
        if (exportStatusChartBtn) exportStatusChartBtn.addEventListener('click', () => exportChart(statusCodesChart, 'status-codes.png'));
        if (exportContentTypeChartBtn) exportContentTypeChartBtn.addEventListener('click', () => exportChart(contentTypeChart, 'content-types.png'));
        if (exportCrawlDepthChartBtn) exportCrawlDepthChartBtn.addEventListener('click', () => exportChart(crawlDepthChart, 'crawl-depth.png'));
    });

    // --- Helper Functions ---
    function copyToClipboard(text, buttonElement, isSpecialEmailBtn = false) {
        if (!text || !buttonElement) return;
        navigator.clipboard.writeText(text).then(() => showCopySuccess(buttonElement, isSpecialEmailBtn), (err) => showCopyError(err));
    }

    function showCopySuccess(buttonElement, isSpecialEmailBtn) {
        const originalContent = buttonElement.innerHTML;
        buttonElement.disabled = true;

        if (isSpecialEmailBtn) {
            buttonElement.innerHTML = `<i class="bi bi-check-lg ms-1"></i> تم النسخ بنجاح!`;
            buttonElement.classList.remove('btn-secondary');
            buttonElement.classList.add('btn-success');
        } else {
            buttonElement.innerHTML = `<i class="bi bi-check-lg"></i>`;
        }

        setTimeout(() => {
            buttonElement.innerHTML = originalContent;
            buttonElement.disabled = false;
            if (isSpecialEmailBtn) {
                buttonElement.classList.remove('btn-success');
                buttonElement.classList.add('btn-secondary');
            }
        }, 2000);
    }

    function showCopyError(err) {
        console.error('فشل في نسخ النص:', err);
        alert('عذراً، لم نتمكن من نسخ النص تلقائياً.');
    }

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
