// assets/js/LinkArchitect.js (النسخة الجديدة)
window.LinkArchitect = (function() {
    'use strict';

    let architectWorker;

    /**
     * Main function to generate a prioritized list of linking recommendations.
     * Uses a Web Worker to avoid blocking the main thread.
     * @param {Array} searchIndex - The full search index array.
     * @returns {Promise<Array>} A promise that resolves with the sorted list of recommendations.
     */
    function generateRecommendations(searchIndex) {
        return new Promise((resolve, reject) => {
            // التحقق من الشروط الأساسية قبل تشغيل العامل
            if (!searchIndex || searchIndex.length < 2 || !searchIndex.some(p => p.content)) {
                return resolve([]);
            }

            // إنهاء أي عامل قديم إذا كان موجودًا
            if (architectWorker) {
                architectWorker.terminate();
            }

            // إنشاء عامل جديد
            architectWorker = new Worker('assets/js/LinkArchitect.worker.js');

            // إرسال البيانات إلى العامل
            architectWorker.postMessage(searchIndex);

            // الاستماع للنتائج من العامل
            architectWorker.onmessage = function(event) {
                resolve(event.data);
                architectWorker.terminate(); // إنهاء العامل بعد إرسال النتائج
                architectWorker = null;
            };

            // التعامل مع الأخطاء
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