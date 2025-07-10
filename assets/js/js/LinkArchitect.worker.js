// --- START OF FILE: assets/js/js/LinkArchitect.worker.js (Final Production Version) ---
'use strict';

// This worker script is corrected to properly instantiate the compromise.js library
// and implements the advanced, priority-based recommendation logic.
try {
    // Note: This path must be relative to the worker file's location.
    importScripts('libs/compromise.min.js');
} catch (e) {
    console.error("Failed to load compromise.min.js in worker.", e);
    // Inform the main thread about the critical failure to load a dependency.
    self.postMessage({ error: "Failed to load NLP library.", details: e.message });
    self.close(); // Terminate the worker as it cannot function.
}

// Check if the library loaded successfully before defining functions that use it.
if (typeof compromise !== 'undefined') {

    // A small set of common English stop words.
    const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'in', 'on', 'of', 'for', 'to']);
    const MAX_RECOMMENDATIONS_PER_PAGE = 5;

    /**
     * Creates a semantic profile of a page based on its title and description.
     * @param {object} page - The page object from the search index. Assumed to have `linkEquity`.
     * @returns {object|null} A fingerprint object or null if invalid.
     */
    function createSemanticFingerprint(page) {
        if (!page || !page.title) return null;
        const title = page.title;
        const description = page.description || '';

        // FIX: Instantiate compromise using the 'new' keyword, as required by v14+.
        const doc = new compromise(title + '. ' + description);

        const entities = doc.people().out('array')
            .concat(doc.places().out('array'))
            .concat(doc.organizations().out('array'));

        return {
            id: page.id,
            url: page.url,
            title: page.title,
            // LOGIC: Capture linkEquity for priority scoring. Default to 1 if not present.
            linkEquity: page.linkEquity || 1,
            entities: new Set(entities.map(e => e.toLowerCase()).filter(e => !STOP_WORDS.has(e))),
        };
    }

    /**
     * Scans source content to find the BEST linking opportunity to a target page based on a priority score.
     * @param {object} sourcePage - The page object to scan for linking opportunities.
     * @param {object} targetFingerprint - The semantic fingerprint of the potential target page.
     * @returns {object|null} The highest-priority linking opportunity object or null if none is found.
     */
    function findBestLinkingOpportunity(sourcePage, targetFingerprint) {
        if (!sourcePage.content || !targetFingerprint || targetFingerprint.entities.size === 0) {
            return null;
        }

        // FIX: Instantiate compromise using the 'new' keyword.
        const sourceDoc = new compromise(sourcePage.content.replace(/<[^>]+>/g, ' '));
        
        // LOGIC: Find the opportunity with the highest score, not just the first one.
        let bestOpportunity = null;

        targetFingerprint.entities.forEach(entity => {
            const matches = sourceDoc.match(entity);
            if (!matches.found) return; // 'return' in forEach acts like 'continue'

            const firstMatch = matches.first();
            
            // LOGIC: Do not suggest a link if the matched text is already inside an anchor tag.
            if (firstMatch.parent().has('<a>')) return;

            const anchorText = firstMatch.text('normal');
            const context = firstMatch.parent().text('normal');

            // LOGIC: Calculate a priority score to find the most valuable opportunity.
            const priorityScore = (targetFingerprint.linkEquity * 5) + (anchorText.length * 3);

            // LOGIC: Only replace the opportunity if the new one has a higher score.
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

    /**
     * Main function to generate internal linking recommendations.
     * @param {Array<object>} searchIndex - The full search index data.
     * @returns {Array<object>} An array of recommendations, sorted and enriched for the UI.
     */
    function generateRecommendations(searchIndex) {
        const contentPages = searchIndex.filter(p => p.content && p.id);
        if (contentPages.length < 2) {
            return [];
        }

        const fingerprints = searchIndex.map(createSemanticFingerprint).filter(Boolean);
        const allRecommendations = [];

        contentPages.forEach(sourcePage => {
            let opportunitiesForSourcePage = [];
            fingerprints.forEach(targetFingerprint => {
                if (sourcePage.id !== targetFingerprint.id) {
                    const opp = findBestLinkingOpportunity(sourcePage, targetFingerprint);
                    if (opp) {
                        opportunitiesForSourcePage.push(opp);
                    }
                }
            });

            if (opportunitiesForSourcePage.length > 0) {
                // LOGIC: Sort opportunities by priority and take the top N.
                const sortedOpportunities = opportunitiesForSourcePage
                    .sort((a, b) => b.priority - a.priority)
                    .slice(0, MAX_RECOMMENDATIONS_PER_PAGE);
                
                // LOGIC: Push the final, enriched object required by the UI.
                allRecommendations.push({
                    sourcePageUrl: sourcePage.url,
                    sourcePageTitle: sourcePage.title,
                    opportunities: sortedOpportunities
                });
            }
        });
        return allRecommendations;
    }

    /**
     * Worker message handler. Receives data from the main thread.
     */
    self.onmessage = (event) => {
        try {
            const recommendations = generateRecommendations(event.data);
            self.postMessage(recommendations);
        } catch (e) {
            console.error("Error during recommendation generation in worker:", e);
            self.postMessage({ error: "An unexpected error occurred during processing.", details: e.message });
        } finally {
            // Best practice: Ensure the worker always terminates after completing its single task.
            self.close();
        }
    };
}
// --- END OF FILE ---
