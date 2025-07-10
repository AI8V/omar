// assets/js/js/LinkArchitect.worker.js (النسخة النهائية والحاسمة)
'use strict';

try {
    // المسار الصحيح الذي توصلنا إليه
    importScripts('libs/compromise.min.js');
} catch (e) {
    console.error("CRITICAL: Failed to load compromise.min.js in worker.", e);
    self.postMessage({ error: "Failed to load NLP library." });
}

// فقط إذا تم تحميل المكتبة بنجاح، قم بتعريف بقية الوظائف
if (typeof compromise !== 'undefined') {

    const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'in', 'on', 'of', 'for', 'to']);

    function createSemanticFingerprint(page) {
        if (!page || !page.title) return null;
        
        const title = page.title;
        const description = page.description || '';
        
        // -- ✅ الإصلاح الحاسم: إزالة 'new'. الإصدار 14.13.0 هو دالة.
        const doc = compromise(title + '. ' + description);
        
        const entities = doc.people().out('array')
            .concat(doc.places().out('array'))
            .concat(doc.organizations().out('array'));

        return {
            id: page.id,
            url: page.url,
            title: page.title,
            linkEquity: page.linkEquity || 1,
            entities: new Set(entities.map(e => e.toLowerCase()).filter(e => !STOP_WORDS.has(e))),
        };
    }

    function findBestLinkingOpportunity(sourcePage, targetFingerprint) {
        if (!sourcePage.content || !targetFingerprint || targetFingerprint.entities.size === 0) {
            return null;
        }

        // -- ✅ الإصلاح الحاسم: إزالة 'new'. الإصدار 14.13.0 هو دالة.
        const sourceDoc = compromise(sourcePage.content.replace(/<[^>]+>/g, ' '));
        
        let bestOpportunity = null;

        targetFingerprint.entities.forEach(entity => {
            const matches = sourceDoc.match(entity);
            if (!matches.found) return;

            const firstMatch = matches.first();
            if (firstMatch.parent().has('<a>')) return;

            const anchorText = firstMatch.text('normal');
            const context = firstMatch.parent().text('normal');
            const priorityScore = (targetFingerprint.linkEquity * 5) + (entity.length * 3);

            if (!bestOpportunity || priorityScore > bestOpportunity.priority) {
                bestOpportunity = {
                    targetPageUrl: targetFingerprint.url,
                    targetPageTitle: targetFingerprint.title,
                    anchorText: anchorText,
                    context: `...${context.trim()}...`,
                    priority: Math.round(priorityScore)
                };
            }
        });

        return bestOpportunity;
    }

    function generateRecommendations(searchIndex) {
        const contentPages = searchIndex.filter(p => p.content && p.id);
        if (contentPages.length < 2) return [];

        const fingerprints = searchIndex.map(createSemanticFingerprint).filter(Boolean);
        const allRecommendations = [];

        contentPages.forEach(sourcePage => {
            const opportunities = [];
            fingerprints.forEach(targetFingerprint => {
                if (sourcePage.id !== targetFingerprint.id) {
                    const opp = findBestLinkingOpportunity(sourcePage, targetFingerprint);
                    if (opp) opportunities.push(opp);
                }
            });

            const sortedOpportunities = opportunities.sort((a, b) => b.priority - a.priority).slice(0, 5);
            if (sortedOpportunities.length > 0) {
                allRecommendations.push({
                    sourcePageUrl: sourcePage.url,
                    sourcePageTitle: sourcePage.title,
                    opportunities: sortedOpportunities
                });
            }
        });
        return allRecommendations;
    }

    self.onmessage = function(event) {
        try {
            const recommendations = generateRecommendations(event.data);
            self.postMessage(recommendations);
        } catch (e) {
            console.error("Error during recommendation generation in worker:", e);
            self.postMessage({ error: "An unexpected error occurred during processing.", details: e.message });
        }
    };
}
