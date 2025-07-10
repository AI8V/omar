// --- START OF FILE: assets/js/js/LinkArchitect.worker.js (Final Production Version) ---
'use strict';

// This worker script is corrected to properly instantiate the compromise.js library
// and integrates the advanced priority-based recommendation logic.

try {
    // This path must be relative to the worker file's location.
    importScripts('libs/compromise.min.js');
} catch (e) {
    console.error("Failed to load compromise.min.js in worker.", e);
    // Inform the main thread about the critical failure to load a dependency.
    self.postMessage({ error: "Failed to load NLP library.", details: e.message });
    self.close(); // Terminate the worker as it cannot function.
}

// Check if the library loaded successfully before defining functions that use it.
if (typeof compromise !== 'undefined') {

    // A small set of common English stop words to filter from entities.
    const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'in', 'on', 'of', 'for', 'to']);

    /**
     * Creates a semantic profile of a page. This fingerprint now includes
     * 'linkEquity' to be used in priority scoring.
     * @param {object} page - The page object from the search index.
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
            // Propagate linkEquity, defaulting to a baseline of 1 if not provided.
            linkEquity: page.linkEquity || 1,
            // Use a Set for efficient lookups and to store unique, non-stop-word entities.
            entities: new Set(entities.map(e => e.toLowerCase()).filter(e => !STOP_WORDS.has(e))),
        };
    }

    /**
     * Scans a source page's content to find the best linking opportunity to a target page
     * based on a calculated priority score.
     * @param {object} sourcePage - The page object to scan for linking opportunities.
     * @param {object} targetFingerprint - The semantic fingerprint of the potential target page.
     * @returns {object|null} The highest-priority linking opportunity object or null.
     */
    function findBestLinkingOpportunity(sourcePage, targetFingerprint) {
        if (!sourcePage.content || !targetFingerprint || targetFingerprint.entities.size === 0) {
            return null;
        }

        // FIX: Instantiate compromise using the 'new' keyword.
        const sourceDoc = new compromise(sourcePage.content.replace(/<[^>]+>/g, ' '));

        let bestOpportunity = null;

        // RE-INTEGRATED LOGIC: Iterate through all entities to find the highest-scoring match.
        targetFingerprint.entities.forEach(entity => {
            const matches = sourceDoc.match(entity);
            if (!matches.found) return; // Continue to next entity if this one is not found.

            const firstMatch = matches.first();

            // CRUCIAL LOGIC: Do not suggest a link if the term is already part of an anchor tag.
            if (firstMatch.parent().has('<a>')) return;

            const anchorText = firstMatch.text('normal');
            const context = firstMatch.parent().text('normal');
            
            // CRUCIAL LOGIC: Calculate a priority score to find the most relevant opportunity.
            // Factors in the target page's authority and the specificity of the anchor text.
            const priorityScore = (targetFingerprint.linkEquity * 5) + (entity.length * 3);

            // CRUCIAL LOGIC: Only replace the opportunity if the new one has a higher score.
            if (!bestOpportunity || priorityScore > bestOpportunity.priority) {
                // CRUCIAL LOGIC: The returned object is richer for UI needs.
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
     * Main function to generate internal linking recommendations. It now sorts opportunities
     * by priority and returns a richer data structure for the UI.
     * @param {Array<object>} searchIndex - The full search index data.
     * @returns {Array<object>} An array of recommendations.
     */
    function generateRecommendations(searchIndex) {
        const contentPages = searchIndex.filter(p => p.content && p.id);
        if (contentPages.length < 2) {
            return [];
        }

        const fingerprints = searchIndex.map(createSemanticFingerprint).filter(Boolean);
        const allRecommendations = [];

        contentPages.forEach(sourcePage => {
            const opportunities = [];
            fingerprints.forEach(targetFingerprint => {
                // A page cannot link to itself.
                if (sourcePage.id !== targetFingerprint.id) {
                    const opp = findBestLinkingOpportunity(sourcePage, targetFingerprint);
                    if (opp) {
                        opportunities.push(opp);
                    }
                }
            });

            // RE-INTEGRATED LOGIC: Sort opportunities by priority and limit to the top 5.
            const sortedOpportunities = opportunities
                .sort((a, b) => b.priority - a.priority)
                .slice(0, 5);

            if (sortedOpportunities.length > 0) {
                // RE-INTEGRATED LOGIC: Push a richer object including the source page title.
                allRecommendations.push({
                    sourcePageUrl: sourcePage.url,
                    sourcePageTitle: sourcePage.title, // Added for UI requirements.
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
            // Ensure the worker terminates after its job is done to prevent resource leaks.
            self.close();
        }
    };
}
// --- END OF FILE ---
