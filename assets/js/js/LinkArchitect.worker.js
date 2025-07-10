// assets/js/js/LinkArchitect.worker.js (النسخة الذكية والنهائية)
'use strict';

// -- ✅ الخطوة 1: استيراد مكتبة compromise.js داخل العامل --
// العامل (Worker) يعمل في بيئة منفصلة، لذا يجب أن يقوم بتحميل المكتبة بنفسه.
// تأكد من أن هذا المسار صحيح نسبةً إلى ملف index.html
try {
    importScripts('../assets/js/js/libs/compromise.min.js');
} catch (e) {
    console.error("Failed to load compromise.min.js in worker. Make sure the path is correct.", e);
    // نرسل رسالة خطأ للخيط الرئيسي في حالة فشل التحميل
    self.postMessage({ error: "Failed to load NLP library." });
}

// نضع الكود المتبقي داخل شرط للتأكد من تحميل المكتبة
if (typeof compromise !== 'undefined') {

    const STOP_WORDS = new Set(['من', 'في', 'على', 'إلى', 'عن', 'هو', 'هي', 'هذا', 'هذه', 'كان', 'يكون', 'قال', 'مع', 'the', 'a', 'an', 'is', 'in', 'on', 'of', 'for', 'to', 'and', 'or', 'but']);

    // -- ✅ الخطوة 2: ترقية "البصمة الدلالية" لتشمل الكيانات --
    function createSemanticFingerprint(page) {
        if (!page || !page.seo) return null;
        
        const title = page.title || '';
        const description = page.description || '';

        // استخدم compromise لتحليل العنوان والوصف
        const doc = compromise(title + '. ' + description);
        
        // استخرج الكيانات الرئيسية (الأشخاص، الأماكن، المنظمات)
        const entities = doc.people().out('array')
            .concat(doc.places().out('array'))
            .concat(doc.organizations().out('array'))
            .filter((v, i, a) => a.indexOf(v) === i) // إزالة التكرارات
            .filter(e => e.length > 2 && !STOP_WORDS.has(e.toLowerCase())); // فلترة بسيطة

        // استخرج الكلمات المفتاحية العامة كاحتياط
        const keywords = doc.terms().out('array')
            .filter(word => word.length > 3 && !STOP_WORDS.has(word.toLowerCase()));

        return {
            id: page.id,
            url: page.url,
            title: page.title,
            // الكيانات هي الآن أهم جزء في البصمة
            entities: new Set(entities),
            keywords: new Set(keywords),
            linkEquity: page.seo.internalLinkEquity || 0
        };
    }

    // -- ✅ الخطوة 3: إعادة بناء دالة "إيجاد الفرص" بالكامل --
    function findBestLinkingOpportunity(sourcePage, targetFingerprint) {
        if (!sourcePage.content || sourcePage.id === targetFingerprint.id || targetFingerprint.entities.size === 0) {
            return null;
        }

        // تحليل النص الكامل للصفحة المصدر مرة واحدة فقط
        const sourceDoc = compromise(sourcePage.content.replace(/<style[^>]*>[\s\S]*?<\/style>|<script[^>]*>[\s\S]*?<\/script>|<[^>]+>/g, ' '));
        
        let bestOpportunity = null;

        // ابحث عن كيانات الصفحة المستهدفة داخل الصفحة المصدر
        targetFingerprint.entities.forEach(entity => {
            const matches = sourceDoc.match(entity);
            if (!matches.found) return;

            // خذ أول تطابق فقط لتبسيط الأمر
            const firstMatch = matches.first();
            
            // استخرج العبارة الاسمية الكاملة التي تحتوي على الكيان
            // هذه هي اللمسة السحرية!
            const anchorPhrase = firstMatch.nouns().first();
            const anchorText = anchorPhrase.text('normal');

            // تجاهل إذا كان الرابط موجودًا بالفعل داخل هذه العبارة
            if (anchorPhrase.has('<a>')) return;

            // استخراج السياق
            const context = firstMatch.parent().text('normal');
            
            const priorityScore = (targetFingerprint.linkEquity * 5) + (entity.length * 3);

            if (!bestOpportunity || priorityScore > bestOpportunity.priority) {
                bestOpportunity = {
                    targetPageUrl: targetFingerprint.url,
                    targetPageTitle: targetFingerprint.title,
                    anchorText: anchorText, // نص الرابط أصبح الآن أكثر طبيعية
                    context: `...${context}...`,
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

} // نهاية الشرط if (typeof compromise !== 'undefined')
