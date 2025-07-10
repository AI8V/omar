// assets/js/js/LinkArchitect.worker.js (النسخة النهائية والمحصّنة)
'use strict';

try {
    importScripts('libs/compromise.min.js');
} catch (e) {
    console.error("CRITICAL: Failed to load compromise.min.js in worker.", e);
    self.postMessage({ error: "Failed to load NLP library." });
}

if (typeof compromise !== 'undefined') {

    const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'in', 'on', 'of', 'for', 'to']);

    function createSemanticFingerprint(page) {
        if (!page) return null;
        
        const title = page.title || '';
        const description = page.description || '';
        const textToAnalyze = (title + '. ' + description).trim();
        
        // -- ✅ الإصلاح الحاسم والنهائي: التحقق من وجود نص قبل استدعاء المكتبة --
        // هذا يمنع تمرير بيانات فارغة تسبب انهيار المكتبة.
        if (!textToAnalyze || textToAnalyze === '.') {
            return null;
        }

        const doc = new compromise(textToAnalyze);
        
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
        if (!sourcePage || !sourcePage.content || !targetFingerprint || targetFingerprint.entities.size === 0) {
            return null;
        }

        const bodyText = sourcePage.content.replace(/<[^>]+>/g, ' ').trim();

        // -- ✅ الإصلاح الحاسم والنهائي: التحقق من وجود محتوى فعلي --
        if (!bodyText) {
            return null;
        }

        const sourceDoc = new compromise(bodyText);
        
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
