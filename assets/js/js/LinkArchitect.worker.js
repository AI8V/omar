// assets/js/js/LinkArchitect.worker.js (النسخة النهائية الذكية والعاملة)
'use strict';

// -- ✅ الإصلاح 1: تصحيح المسار بشكل نهائي --
// المسار الآن صحيح نسبةً لموقع ملف العامل نفسه.
try {
    importScripts('libs/compromise.min.js');
} catch (e) {
    console.error("Failed to load compromise.min.js in worker. Path should be relative to the worker file itself.", e);
    self.postMessage({ error: "Failed to load NLP library." });
}

// نضع الكود المتبقي داخل شرط للتأكد من تحميل المكتبة
if (typeof compromise !== 'undefined') {

    const STOP_WORDS = new Set(['من', 'في', 'على', 'إلى', 'عن', 'هو', 'هي', 'هذا', 'هذه', 'كان', 'يكون', 'قال', 'مع', 'the', 'a', 'an', 'is', 'in', 'on', 'of', 'for', 'to', 'and', 'or', 'but']);

    function createSemanticFingerprint(page) {
        if (!page || !page.seo) return null;
        
        const title = page.title || '';
        const description = page.description || '';
        const doc = compromise(title + '. ' + description);
        
        const entities = doc.people().out('array')
            .concat(doc.places().out('array'))
            .concat(doc.organizations().out('array'))
            .filter((v, i, a) => a.indexOf(v) === i)
            .filter(e => e.length > 2 && !STOP_WORDS.has(e.toLowerCase()));

        return {
            id: page.id,
            url: page.url,
            title: page.title,
            entities: new Set(entities),
            linkEquity: page.seo.internalLinkEquity || 0
        };
    }

    function findBestLinkingOpportunity(sourcePage, targetFingerprint) {
        if (!sourcePage.content || sourcePage.id === targetFingerprint.id || targetFingerprint.entities.size === 0) {
            return null;
        }

        const sourceDoc = compromise(sourcePage.content.replace(/<style[^>]*>[\s\S]*?<\/style>|<script[^>]*>[\s\S]*?<\/script>|<[^>]+>/g, ' '));
        
        let bestOpportunity = null;

        targetFingerprint.entities.forEach(entity => {
            const matches = sourceDoc.match(entity);
            if (!matches.found) return;

            const firstMatch = matches.first();
            
            // -- ✅ الإصلاح 2: جعل استخراج نص الرابط أكثر أمانًا وقوة --
            // بدلاً من البحث عن العبارة الاسمية، نأخذ نص التطابق مباشرة.
            // هذا يضمن دائمًا وجود قيمة، ويمنع الأخطاء.
            const anchorText = firstMatch.text('normal');
            
            // تجاهل إذا كان الرابط موجودًا بالفعل في الجملة الأم
            if (firstMatch.parent().has('<a>')) return;

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

}
