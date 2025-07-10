// assets/js/js/LinkArchitect.worker.js 
'use strict';

const STOP_WORDS = new Set(['من', 'في', 'على', 'إلى', 'عن', 'هو', 'هي', 'هذا', 'هذه', 'كان', 'يكون', 'قال', 'مع', 'the', 'a', 'an', 'is', 'in', 'on', 'of', 'for', 'to', 'and', 'or', 'but']);

function createSemanticFingerprint(page) {
    if (!page || !page.seo) return null;
    const allText = [(page.title || ''), (page.seo.h1 || ''), (page.description || ''), ...(page.tags || [])].join(' ').toLowerCase();
    const keywords = allText.split(/[\s,،-]+/).filter(word => word && word.length > 2 && !STOP_WORDS.has(word));
    const keywordFrequency = keywords.reduce((map, word) => { map[word] = (map[word] || 0) + 1; return map; }, {});
    const topKeywords = Object.keys(keywordFrequency).sort((a, b) => keywordFrequency[b] - keywordFrequency[a]).slice(0, 10);
    return {
        id: page.id,
        url: page.url,
        title: page.title,
        keywords: new Set(topKeywords),
        linkEquity: page.seo.internalLinkEquity || 0,
        outgoingLinks: page.seo.contentAnalysis?.internalLinks || 0
    };
}

function findBestLinkingOpportunity(sourcePage, targetFingerprint) {
    if (!sourcePage.content || sourcePage.id === targetFingerprint.id) return null;
    const bodyText = sourcePage.content.replace(/<style[^>]*>[\s\S]*?<\/style>|<script[^>]*>[\s\S]*?<\/script>|<[^>]+>/g, ' ');
    let bestOpportunity = null;
    targetFingerprint.keywords.forEach(keyword => {
        const regex = new RegExp(`(?<!<a[^>]*>\\s*)\\b(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b(?!\\s*[^<]*<\\/a>)`, 'gi');
        if (!regex.test(bodyText)) return;
        const matchIndex = bodyText.toLowerCase().indexOf(keyword.toLowerCase());
        const start = Math.max(0, matchIndex - 70);
        const end = Math.min(bodyText.length, matchIndex + keyword.length + 70);
        let context = bodyText.substring(start, end).trim().replace(/\s+/g, ' ');
        context = (start > 0 ? '... ' : '') + context + (end < bodyText.length ? ' ...' : '');
        
        const outgoingLinksCount = sourcePage.seo?.contentAnalysis?.internalLinks ?? 0;
        const priorityScore = (targetFingerprint.linkEquity * 5) + (20 / (1 + outgoingLinksCount)) + (keyword.length * 2);

        if (!bestOpportunity || priorityScore > bestOpportunity.priority) {
            bestOpportunity = { targetPageUrl: targetFingerprint.url, targetPageTitle: targetFingerprint.title, anchorText: keyword, context: context, priority: Math.round(priorityScore) };
        }
    });
    return bestOpportunity;
}

function generateRecommendations(searchIndex) {
    if (!searchIndex || searchIndex.length < 2) return [];
    const contentPages = searchIndex.filter(p => p.content && p.seo);
    if (contentPages.length < 2) return [];
    
    const fingerprints = searchIndex.map(createSemanticFingerprint).filter(Boolean);
    const allRecommendations = [];

    contentPages.forEach(sourcePage => {
        const pageOpportunities = [];
        fingerprints.forEach(targetFingerprint => {
            const opportunity = findBestLinkingOpportunity(sourcePage, targetFingerprint);
            if (opportunity) pageOpportunities.push(opportunity);
        });
        if (pageOpportunities.length > 0) {
            allRecommendations.push({
                sourcePageUrl: sourcePage.url,
                sourcePageTitle: sourcePage.title,
                opportunities: pageOpportunities.sort((a, b) => b.priority - a.priority).slice(0, 5)
            });
        }
    });
    return allRecommendations;
}

self.onmessage = function(event) {
    const searchIndex = event.data;
    const recommendations = generateRecommendations(searchIndex);
    self.postMessage(recommendations);
};
