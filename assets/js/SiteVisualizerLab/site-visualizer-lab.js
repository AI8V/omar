// Mind & Machine - Site Visualizer Lab v5.2 (The Final Countdown Fix)
console.log("✅ Site Visualizer Lab v5.2 (The Final Countdown Fix) is loading...");

document.addEventListener("DOMContentLoaded", function() {
    'use strict';

    // ===================================================================
    //  1. DOM Element Caching & State
    // ===================================================================
    let network = null;
    let fullSearchIndex = [];
    let currentNodes = null; 
    let currentEdges = null;
    let areLabelsVisible = true;
    let originalNodeSettings = {};
    let isPhysicsEnabled = true;

    // ... DOM element constants ...
    const jsonInput = document.getElementById('jsonInput');
    const fileInput = document.getElementById('fileInput');
    const renderBtn = document.getElementById('renderBtn');
    const graphContainer = document.getElementById('site-graph-container');
    const placeholder = document.getElementById('visualizerPlaceholder');
    const viewModeButtons = document.querySelectorAll('[data-view-mode]');
    const searchInput = document.getElementById('visualizer-search');
    const toggleLabelsBtn = document.getElementById('toggleLabelsBtn');
    const togglePhysicsBtn = document.getElementById('togglePhysicsBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    // ... Helper functions (sanitizeHTML, etc) ...
    function sanitizeHTML(str) {
        if (typeof str !== 'string' || !str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    function truncateLabel(str, maxLength = 25) {
        if (!str || typeof str !== 'string') return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '…';
    }

    const getDepthColor = (depth) => {
        if (!fullSearchIndex || fullSearchIndex.length === 0) return '#cccccc';
        const validDepths = fullSearchIndex.map(p => p.seo?.crawlDepth).filter(d => typeof d === 'number');
        if (validDepths.length === 0) return '#cccccc';
        const maxDepth = Math.max(0, ...validDepths);
        if (depth === 0) return '#28a745'; 
        if (maxDepth <= 1) return '#0dcaf0';
        const percentage = depth / maxDepth;
        if (percentage <= 0.33) return '#0dcaf0'; 
        if (percentage <= 0.66) return '#ffc107';
        return '#dc3545';
    };

    const stringToColor = (str) => {
        let hash = 0; if (!str) return '#cccccc';
        str.split('').forEach(char => { hash = char.charCodeAt(0) + ((hash << 5) - hash); });
        let color = '#'; for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF; color += `00${value.toString(16)}`.slice(-2);
        } return color;
    };
    
    function populateSidebar(searchIndex, edges) {
        document.getElementById('visualizer-total-pages').textContent = searchIndex.length;
        document.getElementById('visualizer-total-links').textContent = edges.length;
        const pageList = document.getElementById('visualizer-page-list');
        pageList.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const sortedIndex = searchIndex.slice().sort((a, b) => (b.seo?.internalLinkEquity || 0) - (a.seo?.internalLinkEquity || 0));

        sortedIndex.forEach(page => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center list-group-item-action';
            li.dataset.nodeId = page.url;
            const pageTitle = page.title || page.url;
            li.dataset.pageTitle = pageTitle.toLowerCase();
            const titleSpan = document.createElement('span');
            titleSpan.className = 'text-truncate';
            titleSpan.title = pageTitle;
            titleSpan.textContent = pageTitle;
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'badge bg-secondary rounded-pill';
            badgeSpan.textContent = page.seo?.internalLinkEquity || 0;
            li.appendChild(titleSpan);
            li.appendChild(badgeSpan);
            li.addEventListener('click', () => focusOnNode(page.url));
            fragment.appendChild(li);
        });
        pageList.appendChild(fragment);
    }
     
    function focusOnNode(nodeId) {
        if (network && nodeId) {
            network.selectNodes([nodeId]);
        }
    }

    function getFontSettings() {
        const isDarkMode = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        if (isDarkMode) {
            return { color: '#FFFFFF', face: 'Tahoma', strokeWidth: 2, strokeColor: '#212529', size: 14 };
        } else {
            return { color: '#212529', face: 'Tahoma', strokeWidth: 4, strokeColor: '#FFFFFF', size: 14 };
        }
    }
    
    // ===================================================================
    //  3. Core Logic
    // ===================================================================

    function processAndRender(jsonDataString) {
        try {
            // Nuke all previous state. This part is correct.
            if (network) network.destroy();
            network = null;
            fullSearchIndex = [];
            originalNodeSettings = {};
            currentNodes = new vis.DataSet();
            currentEdges = new vis.DataSet();
            document.getElementById('visualizer-page-list').innerHTML = '';
            document.getElementById('visualizer-total-pages').textContent = '0';
            document.getElementById('visualizer-total-links').textContent = '0';
            document.getElementById('visualizer-search').value = '';

            const data = JSON.parse(jsonDataString);
            if (!Array.isArray(data) || data.length === 0) throw new Error("بيانات JSON غير صالحة أو فارغة.");
            fullSearchIndex = data.filter(item => item && item.url); 
            if (fullSearchIndex.length === 0) throw new Error("لم يتم العثور على صفحات صالحة (تحتوي على url) في البيانات.");

            placeholder.classList.add('d-none');
            graphContainer.classList.remove('d-none');
            
            toggleLabelsBtn.classList.remove('d-none');
            togglePhysicsBtn.classList.remove('d-none');
            fullscreenBtn.classList.remove('d-none');
            
            viewModeButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector('[data-view-mode="linkEquity"]').classList.add('active');

            createGraphData();
            updateNodeDisplay('linkEquity'); 
            renderGraph();

        } catch (e) {
            alert(`خطأ في معالجة البيانات: ${e.message}`);
            console.error("Processing Error:", e);
            graphContainer.classList.add('d-none');
            placeholder.classList.remove('d-none');
            toggleLabelsBtn.classList.add('d-none');
            togglePhysicsBtn.classList.add('d-none');
            fullscreenBtn.classList.add('d-none');
        }
    }
    
     function createGraphData() {
        const fontSettings = getFontSettings();
        const newNodes = fullSearchIndex.map(page => {
            const tooltipElement = document.createElement('div');
            const pageTitle = page.title || page.url;
            const internalLinkEquity = page.seo?.internalLinkEquity || 0;
            const crawlDepth = page.seo?.crawlDepth ?? 'N/A';
            const value = 1 + internalLinkEquity;
            const safeTitle = sanitizeHTML(pageTitle);
            tooltipElement.innerHTML = `<b>${safeTitle}</b><br>الروابط الواردة: ${internalLinkEquity}<br>العمق: ${crawlDepth}`;
            return { id: page.url, value, title: tooltipElement, label: truncateLabel(pageTitle), font: { ...fontSettings } };
        });
        currentNodes.add(newNodes);

        const pageUrls = new Set(fullSearchIndex.map(p => p.url));
        const edgeAggregator = {};
        fullSearchIndex.forEach(sourcePage => {
            const outgoingLinks = sourcePage.seo?.contentAnalysis?.outgoingInternalLinks || [];
            outgoingLinks.forEach(targetUrl => {
                if (pageUrls.has(targetUrl) && sourcePage.url !== targetUrl) {
                    const key = [sourcePage.url, targetUrl].sort().join('|');
                    if (!edgeAggregator[key]) edgeAggregator[key] = { from: sourcePage.url, to: targetUrl, count: 0 };
                    edgeAggregator[key].count++;
                }
            });
        });
        
        const newEdges = Object.values(edgeAggregator).map(edgeInfo => {
            const isBidirectional = edgeInfo.count > 1;
            return {
                from: edgeInfo.from, to: edgeInfo.to, value: edgeInfo.count, 
                length: 350 / edgeInfo.count,
                title: isBidirectional ? `رابط متبادل (x${edgeInfo.count})` : 'رابط أحادي',
                arrows: { to: { enabled: true, scaleFactor: 0.5 }, from: { enabled: isBidirectional, scaleFactor: 0.5 } }
            };
        });
        currentEdges.add(newEdges);
        populateSidebar(fullSearchIndex, newEdges);
    }
    
    function updateNodeDisplay(displayMode) {
        const fontSettings = getFontSettings();
        originalNodeSettings = {}; 
        const nodesToUpdate = fullSearchIndex.map(page => {
            const pageTitle = page.title || page.url;
            let newProperties = { id: page.url, font: { ...fontSettings } };
            switch (displayMode) {
                case 'crawlDepth':
                    newProperties.color = getDepthColor(page.seo?.crawlDepth);
                    newProperties.label = (page.seo?.crawlDepth ?? 'N/A').toString();
                    break;
                case 'topicCluster':
                    const firstSegment = (page.url || '').split('/')[1] || 'homepage';
                    newProperties.color = stringToColor(firstSegment);
                    break;
                case 'linkEquity': default:
                    newProperties.color = page.seo?.isOrphan ? '#f0ad4e' : (page.seo?.isNoIndex ? '#d9534f' : '#5bc0de');
                    newProperties.label = truncateLabel(pageTitle);
                    break;
            }
            originalNodeSettings[page.url] = { color: newProperties.color, font: newProperties.font };
            return newProperties;
        });
        currentNodes.update(nodesToUpdate);
    }

    function renderGraph() {
        const options = {
             nodes: { shape: 'dot' },
            edges: { scaling: { min: 0.5, max: 5, label: false }, color: { inherit: 'from', opacity: 0.4 }, smooth: { type: 'continuous' } },
            physics: { 
                enabled: true, forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 200, springConstant: 0.08, avoidOverlap: 0.5 }, 
                maxVelocity: 50, solver: 'forceAtlas2Based', timestep: 0.5,
                stabilization: { iterations: 1000, fit: true, updateInterval: 25 }
            },
            interaction: { tooltipDelay: 200, hideEdgesOnDrag: true, navigationButtons: true, selectConnectedEdges: false },
        };
        network = new vis.Network(graphContainer, { nodes: currentNodes, edges: currentEdges }, options);
        
        network.on("stabilizationIterationsDone", function () {
            network.setOptions({ physics: false });
            isPhysicsEnabled = false;
            togglePhysicsBtn.innerHTML = '<i class="bi bi-activity ms-2"></i>إعادة تفعيل الحركة';
            togglePhysicsBtn.classList.replace('btn-info', 'btn-outline-info');
        });

        attachNetworkEvents();
    }
    
    function attachNetworkEvents() {
        if (!network) return;
        network.on("select", function(params) {
            const selectedNodeId = params.nodes.length > 0 ? params.nodes[0] : null;
            
            // 1. Update the FAST part of the UI immediately. This is safe.
            document.querySelectorAll('#visualizer-page-list li').forEach(li => {
                const isActive = li.dataset.nodeId === selectedNodeId;
                li.classList.toggle('active', isActive);
                if (isActive) li.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            // 2. Schedule the SLOW, DESTRUCTIVE part of the UI update to run later.
            // This breaks the race condition.
            setTimeout(() => {
                if (!network) return; // The network might have been destroyed while we waited
                
                // We need to re-verify the selection, in case another event happened.
                const currentSelection = network.getSelectedNodes();
                const currentNodeId = currentSelection.length > 0 ? currentSelection[0] : null;

                const allNodeIds = currentNodes.getIds();
                const allEdges = currentEdges.get();

                if (currentNodeId) {
                    const connectedEdges = network.getConnectedEdges(currentNodeId);
                    const connectedNodes = new Set([...network.getConnectedNodes(currentNodeId), currentNodeId]);
                    const dimColor = 'rgba(200, 200, 200, 0.1)';
                    
                    const nodesToUpdate = allNodeIds.map(nodeId => (connectedNodes.has(nodeId))
                        ? { id: nodeId, ...originalNodeSettings[nodeId] }
                        : { id: nodeId, color: { background: dimColor, border: 'rgba(200, 200, 200, 0.2)' }, font: { color: dimColor, strokeColor: dimColor } }
                    );
                    currentNodes.update(nodesToUpdate);

                    const connectedEdgeIds = new Set(connectedEdges);
                    const edgesToUpdate = allEdges.map(edge => ({ id: edge.id, hidden: !connectedEdgeIds.has(edge.id) }));
                    currentEdges.update(edgesToUpdate);
                } else {
                    // Reset all visuals if nothing is selected.
                    const nodesToUpdate = allNodeIds.map(nodeId => ({ id: nodeId, ...originalNodeSettings[nodeId] }));
                    currentNodes.update(nodesToUpdate);
                    const edgesToUpdate = allEdges.map(edge => ({ id: edge.id, hidden: false }));
                    currentEdges.update(edgesToUpdate);
                }
            }, 0);
        });
    }

    // ... handleFileLoad, initialize, etc. ...
    function handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            jsonInput.value = e.target.result;
            checkRenderButtonState();
            processAndRender(e.target.result);
        };
        reader.readAsText(file);
    }
    
    function checkRenderButtonState() {
        const isDisabled = jsonInput.value.trim().length < 3;
        renderBtn.disabled = isDisabled;
        renderBtn.classList.toggle('disabled', isDisabled);
    }
    
    function initialize() {
        checkRenderButtonState();
        toggleLabelsBtn.classList.add('d-none');
        togglePhysicsBtn.classList.add('d-none');
        fullscreenBtn.classList.add('d-none');
        
        renderBtn.addEventListener('click', () => processAndRender(jsonInput.value));
        fileInput.addEventListener('change', handleFileLoad);
        jsonInput.addEventListener('input', checkRenderButtonState);

        document.querySelectorAll('[data-bs-theme-value]').forEach(toggle => {
            toggle.addEventListener('click', () => {
                setTimeout(() => {
                    if (network) {
                        const currentViewMode = document.querySelector('[data-view-mode].active').dataset.viewMode;
                        const selectedNodes = network.getSelectedNodes();
                        updateNodeDisplay(currentViewMode);
                        if (selectedNodes.length > 0) {
                            network.selectNodes(selectedNodes);
                        }
                    }
                }, 50);
            });
        });

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            document.querySelectorAll('#visualizer-page-list li').forEach(item => {
                const itemText = item.dataset.pageTitle || '';
                item.classList.toggle('d-none', !itemText.includes(searchTerm));
            });
        });

        viewModeButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (!network) return; 
                const selectedNodes = network.getSelectedNodes();
                viewModeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                updateNodeDisplay(button.dataset.viewMode);
                if (selectedNodes.length > 0) {
                    network.selectNodes(selectedNodes);
                }
            });
        });

        toggleLabelsBtn.addEventListener('click', () => {
            if (!network) return;
            areLabelsVisible = !areLabelsVisible;
            const nodesToUpdate = currentNodes.getIds().map(nodeId => {
                return { 
                    id: nodeId, 
                    font: areLabelsVisible ? originalNodeSettings[nodeId].font : { size: 0 } 
                };
            });
            currentNodes.update(nodesToUpdate);
            toggleLabelsBtn.innerHTML = areLabelsVisible
                ? '<i class="bi bi-chat-text ms-2"></i>إخفاء العناوين'
                : '<i class="bi bi-chat-text-fill ms-2"></i>إظهار العناوين';
        });
        
        togglePhysicsBtn.addEventListener('click', () => {
            if (!network) return;
            isPhysicsEnabled = !isPhysicsEnabled;
            network.setOptions({ physics: isPhysicsEnabled });
            if (isPhysicsEnabled) {
                togglePhysicsBtn.innerHTML = '<i class="bi bi-pause-circle-fill ms-2"></i>إيقاف الحركة';
                togglePhysicsBtn.classList.replace('btn-outline-info', 'btn-info');
            } else {
                togglePhysicsBtn.innerHTML = '<i class="bi bi-activity ms-2"></i>إعادة تفعيل الحركة';
                togglePhysicsBtn.classList.replace('btn-info', 'btn-outline-info');
            }
        });

        fullscreenBtn.addEventListener('click', () => {
            const body = document.body;
            body.classList.toggle('fullscreen-mode');
            const icon = fullscreenBtn.querySelector('i');
            
            if (body.classList.contains('fullscreen-mode')) {
                icon.classList.replace('bi-arrows-fullscreen', 'bi-fullscreen-exit');
                fullscreenBtn.setAttribute('title', 'الخروج من وضع ملء الشاشة');
            } else {
                icon.classList.replace('bi-fullscreen-exit', 'bi-arrows-fullscreen');
                fullscreenBtn.setAttribute('title', 'وضع ملء الشاشة');
            }
            if (network) {
                setTimeout(() => { network.fit(); }, 300);
            }
        });
    }

    initialize();
});