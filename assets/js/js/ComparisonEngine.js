// /assets/js/ComparisonEngine.js

(function(exports) {
    'use strict';

    function compare(projectA_searchIndex, projectB_searchIndex) {
        if (!projectA_searchIndex || !projectB_searchIndex) {
            return null;
        }

        const urlsA = new Map(projectA_searchIndex.map(p => [p.url, p]));
        const urlsB = new Map(projectB_searchIndex.map(p => [p.url, p]));

        const addedPages = [];
        const removedPages = [];
        const commonPages = [];

        for (const [url, pageB] of urlsB.entries()) {
            if (urlsA.has(url)) {
                commonPages.push({ before: urlsA.get(url), after: pageB });
            } else {
                addedPages.push(pageB);
            }
        }

        for (const [url, pageA] of urlsA.entries()) {
            if (!urlsB.has(url)) {
                removedPages.push(pageA);
            }
        }

        const seoScoreChanges = commonPages.map(p => ({
            url: p.after.url,
            title: p.after.title,
            scoreBefore: p.before.seo?.score || 0,
            scoreAfter: p.after.seo?.score || 0,
            change: (p.after.seo?.score || 0) - (p.before.seo?.score || 0)
        })).filter(c => c.change !== 0);

        const improvedPages = seoScoreChanges.filter(c => c.change > 0).sort((a, b) => b.change - a.change);
        const declinedPages = seoScoreChanges.filter(c => c.change < 0).sort((a, b) => a.change - b.change);

        return {
            summary: {
                pagesBefore: urlsA.size,
                pagesAfter: urlsB.size,
                pagesAdded: addedPages.length,
                pagesRemoved: removedPages.length
            },
            addedPages,
            removedPages,
            improvedPages,
            declinedPages,
        };
    }

    exports.ComparisonEngine = {
        compare
    };

})(typeof exports === 'undefined' ? this : exports);