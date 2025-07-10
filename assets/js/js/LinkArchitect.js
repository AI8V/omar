// assets/js/js/LinkArchitect.js 
window.LinkArchitect = (function() {
    'use strict';

    let architectWorker;

    function generateRecommendations(searchIndex) {
        return new Promise((resolve, reject) => {
            const contentPages = searchIndex.filter(p => p.content && p.seo);

            if (!searchIndex || searchIndex.length < 2 || contentPages.length === 0) {
                const error = new Error("No pages with full content were found. Please re-crawl the site and ensure the 'Do not save full content' checkbox is UNCHECKED to use the Link Architect.");
                error.name = 'NoContentError';
                return reject(error);
            }

            if (architectWorker) {
                architectWorker.terminate();
            }

            const workerPath = 'assets/js/js/LinkArchitect.worker.js';
            architectWorker = new Worker(workerPath);
            
            architectWorker.postMessage(searchIndex);

            architectWorker.onmessage = function(event) {
                resolve(event.data);
                architectWorker.terminate();
                architectWorker = null;
            };

            architectWorker.onerror = function(error) {
                console.error('Link Architect Worker Error:', error);
                reject(error);
                architectWorker.terminate();
                architectWorker = null;
            };
        });
    }

    return {
        generateRecommendations
    };
})();
