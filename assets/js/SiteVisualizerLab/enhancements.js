// Mind & Machine - Site Visualizer Lab Enhancements v4.0 (The Performance & Insight Update)
console.log("✅ Visualizer Enhancements v4.0 is loading...");

document.addEventListener("DOMContentLoaded", function() {
    'use strict';

    let visualizerWorker;

    const dom = {
        fileInput: document.getElementById('fileInput'),
        jsonInput: document.getElementById('jsonInput'),
        renderBtn: document.getElementById('renderBtn'),
        renderBtnText: document.querySelector('#renderBtn .btn-text'),
        renderBtnSpinner: document.querySelector('#renderBtn .spinner-border'),
        loadSampleDataBtn: document.getElementById('loadSampleDataBtn'),
        legendContainer: document.getElementById('view-legend'),
        viewModeButtons: document.querySelectorAll('[data-view-mode]'),
        viewModesGroup: document.getElementById('view-modes-group'),
        topicClusterControls: document.getElementById('topic-cluster-controls'),
        clusterRulesContainer: document.getElementById('cluster-rules-container'),
        addClusterRuleBtn: document.getElementById('addClusterRuleBtn'),
        applyClusterRulesBtn: document.getElementById('applyClusterRulesBtn'),
        clusterRuleTemplate: document.getElementById('cluster-rule-template'),
        inspector: {
            placeholder: document.getElementById('inspector-placeholder'),
            details: document.getElementById('inspector-details'),
            title: document.getElementById('inspector-title'),
            url: document.getElementById('inspector-url'),
            depth: document.getElementById('inspector-depth'),
            inlinks: document.getElementById('inspector-inlinks'),
            outlinks: document.getElementById('inspector-outlinks'),
            status: document.getElementById('inspector-status'),
        },
        toast: {
            el: document.getElementById('appToast'),
            instance: null,
            icon: document.getElementById('toast-icon'),
            title: document.getElementById('toast-title'),
            body: document.getElementById('toast-body'),
        }
    };

    window.enhancements = {
        showToast(message, type = 'error', title = null) {
            if (!dom.toast.el) return;
            if (!dom.toast.instance) {
                dom.toast.instance = new bootstrap.Toast(dom.toast.el, { delay: 6000 });
            }
            dom.toast.body.textContent = message;
            if (type === 'error') {
                dom.toast.title.textContent = title || 'خطأ';
                dom.toast.icon.className = 'bi bi-exclamation-triangle-fill text-danger me-2';
            } else if (type === 'success') {
                dom.toast.title.textContent = title || 'نجاح';
                dom.toast.icon.className = 'bi bi-check-circle-fill text-success me-2';
            } else {
                 dom.toast.title.textContent = title || 'معلومة';
                 dom.toast.icon.className = 'bi bi-info-circle-fill text-info me-2';
            }
            dom.toast.instance.show();
        },
        
        setLoadingState(isLoading) {
            if (isLoading) {
                dom.renderBtnText.textContent = 'جاري المعالجة...';
                dom.renderBtnSpinner.classList.remove('d-none');
                dom.renderBtn.disabled = true;
                dom.loadSampleDataBtn.disabled = true;
            } else {
                dom.renderBtnText.innerHTML = '<i class="bi bi-play-fill ms-2" aria-hidden="true"></i> عرض وتحليل البنية';
                dom.renderBtnSpinner.classList.add('d-none');
                dom.renderBtn.disabled = false;
                dom.loadSampleDataBtn.disabled = false;
            }
        },

        processWithWorker(fileContent, fileType) {
            if (!fileContent) {
                this.showToast('لا توجد بيانات للمعالجة.', 'error');
                return;
            }
            this.setLoadingState(true);
            this.showToast('بدأت معالجة البيانات في الخلفية...', 'info', 'جاري العمل');
            visualizerWorker.postMessage({ fileContent, fileType });
        },
        
        updateLegend(mode, rules = []) {
            let legendHtml = '';
            const createSwatch = (color, text) => `<li><span class="legend-color-swatch" style="background-color: ${color};"></span> ${text}</li>`;
            
            switch (mode) {
                case 'crawlDepth':
                    legendHtml = `<ul>
                        ${createSwatch(window.svl.getDepthColor(0), 'الرئيسية')}
                        ${createSwatch(window.svl.getDepthColor(1), 'قريب')}
                        ${createSwatch(window.svl.getDepthColor(5), 'متوسط')}
                        ${createSwatch(window.svl.getDepthColor(10), 'بعيد')}
                    </ul>`;
                    break;
                case 'topicCluster':
                    if (rules.length > 0) {
                        let rulesHtml = rules.map(rule => {
                             try {
                                 const pattern = new RegExp(rule.pattern).source;
                                 return createSwatch(rule.color, pattern);
                             } catch (e) {
                                 return createSwatch('#888', 'قاعدة غير صالحة');
                             }
                        }).join('');
                        legendHtml = `<ul>${rulesHtml}${createSwatch('#cccccc', 'أخرى')}</ul>`;
                    } else {
                         legendHtml = `<p class="mb-0 small text-muted">يتم تلوين كل قسم (حسب المسار) بلون فريد.</p>`;
                    }
                    break;
                case 'linkEquity':
                default:
                    legendHtml = `<ul>
                        ${createSwatch('#5bc0de', 'صفحة عادية')}
                        ${createSwatch('#f0ad4e', 'صفحة يتيمة')}
                        ${createSwatch('#d9534f', 'صفحة NoIndex')}
                    </ul>`;
                    break;
            }
            dom.legendContainer.innerHTML = legendHtml;
        },

        updateInspector(nodeId) {
            if (!nodeId || !window.svl?.fullSearchIndex) {
                dom.inspector.details.classList.add('d-none');
                dom.inspector.placeholder.classList.remove('d-none');
                return;
            }
            
            const page = window.svl.fullSearchIndex.find(p => p.url === nodeId);
            if (!page) return;

            const seo = page.seo || {};
            const analysis = seo.contentAnalysis || {};
            dom.inspector.title.textContent = page.title || page.url;
            dom.inspector.title.title = page.title || page.url;
            dom.inspector.url.href = page.url;
            dom.inspector.depth.textContent = seo.crawlDepth ?? 'N/A';
            dom.inspector.inlinks.textContent = seo.internalLinkEquity || 0;
            dom.inspector.outlinks.textContent = analysis.outgoingInternalLinks?.length || 0;
            
            let statusText = 'عادية';
            if (seo.isNoIndex) statusText = 'NoIndex';
            else if (seo.isOrphan) statusText = 'يتيمة';
            dom.inspector.status.textContent = statusText;

            dom.inspector.placeholder.classList.add('d-none');
            dom.inspector.details.classList.remove('d-none');
        },
        
        onNodeSelection(nodeIds) {
            const nodeId = nodeIds.length > 0 ? nodeIds[0] : null;
            this.updateInspector(nodeId);

            document.querySelectorAll('#visualizer-page-list li').forEach(li => {
                const isActive = li.dataset.nodeId === nodeId;
                li.classList.toggle('active', isActive);
                if (isActive) li.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
            
            if (!window.svl.network || !window.svl.currentNodes) return;
            
            const allNodeIds = window.svl.currentNodes.getIds();
            if (!nodeId) { // Reset if nothing is selected
                 if (window.svl.isClustered) return; // Don't reset colors if clustered
                const nodesToUpdate = allNodeIds.map(id => {
                    const originalSettings = window.svl.originalNodeSettings[id];
                    if (!originalSettings) return null;
                    return {
                        id,
                        color: originalSettings.color,
                        font: window.svl.areLabelsVisible ? originalSettings.font : { size: 0 }
                    };
                }).filter(Boolean);

                if (nodesToUpdate.length > 0) window.svl.currentNodes.update(nodesToUpdate);
                if (window.svl.currentEdges) window.svl.currentEdges.update(window.svl.currentEdges.get().map(e => ({ id: e.id, hidden: false })));
            } else {
                const connectedNodes = new Set([nodeId, ...window.svl.network.getConnectedNodes(nodeId)]);
                const dimColor = 'rgba(200, 200, 200, 0.1)';

                const nodesToUpdate = allNodeIds.map(id => {
                    const originalSettings = window.svl.originalNodeSettings[id];
                    if (!originalSettings) return null;

                    if (connectedNodes.has(id)) {
                        return {
                            id,
                            color: originalSettings.color,
                            font: window.svl.areLabelsVisible ? originalSettings.font : { size: 0 }
                        };
                    } else {
                        return {
                            id,
                            color: { background: dimColor, border: 'rgba(200,200,200,0.2)' },
                            font: { color: dimColor, strokeWidth: 0 }
                        };
                    }
                }).filter(Boolean);
                
                window.svl.currentNodes.update(nodesToUpdate);
                
                const connectedEdgeIds = new Set(window.svl.network.getConnectedEdges(nodeId));
                window.svl.currentEdges.update(window.svl.currentEdges.get().map(edge => ({ id: edge.id, hidden: !connectedEdgeIds.has(edge.id) })));
            }
        },

        onGraphRendered() {
            if (!window.svl.network) return;
            this.updateLegend('linkEquity');
            this.updateInspector(null);
            
            window.svl.network.off('selectNode');
            window.svl.network.off('deselectNode');
            window.svl.network.off('click');

            window.svl.network.on('selectNode', (params) => this.onNodeSelection(params.nodes));
            window.svl.network.on('deselectNode', () => this.onNodeSelection([]));
            window.svl.network.on('click', (params) => {
                if (params.nodes.length === 0 && params.edges.length === 0) {
                    window.svl.network.unselectAll();
                    this.onNodeSelection([]);
                }
            });
        },

        initialize() {
            window.showToast = (msg, type, title) => this.showToast(msg, type, title);

            // Init Web Worker
            try {
                visualizerWorker = new Worker('../assets/js/SiteVisualizerLab/visualizer-worker.js');
                visualizerWorker.onmessage = (e) => {
                    this.setLoadingState(false);
                    const { status, data, message } = e.data;
                    if (status === 'success') {
                        this.showToast('تمت معالجة البيانات بنجاح، جاري الآن رسم الخريطة.', 'success');
                        window.svl.renderFromProcessedData(data);
                        this.onGraphRendered();
                    } else {
                        this.showToast(message, 'error');
                    }
                };
                visualizerWorker.onerror = (e) => {
                    this.setLoadingState(false);
                    console.error('Worker Error:', e);
                    this.showToast(`حدث خطأ فني في العامل: ${e.message}`, 'error');
                };
            } catch (e) {
                console.error("Failed to initialize Web Worker:", e);
                this.showToast('متصفحك لا يدعم Web Workers أو هناك مشكلة في تحميله. ستعمل الأداة في الوضع العادي.', 'error', 'تحذير التوافقية');
            }

            // --- Event Listeners ---
            dom.renderBtn.addEventListener('click', () => {
                this.processWithWorker(dom.jsonInput.value, 'json');
            });

            dom.fileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    const fileType = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
                    dom.jsonInput.value = ''; // Clear textarea if file is used
                    this.processWithWorker(e.target.result, fileType);
                };
                reader.readAsText(file, 'UTF-8');
            });
            
            dom.loadSampleDataBtn.addEventListener('click', () => {
                fetch('assets/js/SiteVisualizerLab/sample-data.json')
                    .then(res => res.ok ? res.text() : Promise.reject('فشل تحميل الملف التجريبي.'))
                    .then(data => {
                        dom.jsonInput.value = data;
                        this.processWithWorker(data, 'json');
                    }).catch(err => this.showToast(err, 'error'));
            });
            
            // Regex Cluster Controls Logic
            dom.viewModesGroup.addEventListener('click', (e) => {
                if (e.target.matches('[data-view-mode]')) {
                    const mode = e.target.dataset.viewMode;
                    this.updateLegend(mode);
                    dom.topicClusterControls.classList.toggle('d-none', mode !== 'topicCluster');
                }
            });

            dom.addClusterRuleBtn.addEventListener('click', () => {
                const ruleNode = dom.clusterRuleTemplate.firstElementChild.cloneNode(true);
                dom.clusterRulesContainer.appendChild(ruleNode);
            });

            dom.clusterRulesContainer.addEventListener('click', (e) => {
                if (e.target.closest('.remove-cluster-rule-btn')) {
                    e.target.closest('.cluster-rule-item').remove();
                }
            });

            dom.applyClusterRulesBtn.addEventListener('click', () => {
                if (!window.svl.network) return;
                
                const rules = Array.from(dom.clusterRulesContainer.querySelectorAll('.cluster-rule-item')).map(item => {
                    const pattern = item.querySelector('.cluster-regex-input').value.trim();
                    const color = item.querySelector('.cluster-color-input').value;
                    return { pattern, color };
                }).filter(rule => rule.pattern);

                try {
                    // Test regex validity
                    rules.forEach(rule => new RegExp(rule.pattern));
                    window.svl.updateNodeDisplay('topicCluster', { rules });
                    this.updateLegend('topicCluster', rules);
                } catch(e) {
                    this.showToast(`تعبير نمطي غير صالح: ${e.message}`, 'error');
                }
            });
            
            this.updateLegend('linkEquity');
            this.updateInspector(null);
        }
    };

    window.enhancements.initialize();
});
