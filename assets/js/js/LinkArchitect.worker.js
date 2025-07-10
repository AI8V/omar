// assets/js/js/LinkArchitect.worker.js 
'use strict';

// الخطوة 1: استيراد المكتبة لتصبح متاحة داخل العامل
// تأكد من أن المسار صحيح نسبةً لمكان هذا الملف
try {
    importScripts('assets/js/js/libs/compromise.min.js');
} catch (e) {
    console.error("Failed to load compromise.min.js in worker. Make sure the path is correct.", e);
    // إذا فشل تحميل المكتبة، أرسل رسالة خطأ للخيط الرئيسي
    self.postMessage({ error: "Compromise library failed to load." });
}

const STOP_WORDS = new Set(['من', 'في', 'على', 'إلى', 'عن', 'هو', 'هي', 'هذا', 'هذه', 'كان', 'يكون', 'قال', 'مع', 'the', 'a', 'an', 'is', 'in', 'on', 'of', 'for', 'to', 'and', 'or', 'but', 'it', 'is', 'was', 'be']);

/**
 * [مُطوّر] ينشئ بصمة دلالية للصفحة باستخدام فهم اللغة الطبيعية.
 * يستخرج الكيانات (الأسماء، الأماكن، المنظمات) والأسماء الهامة.
 */
function createSemanticFingerprint(page) {
    if (!page || !page.seo || !self.compromise) return null;
    
    // تجميع النصوص الهامة من الصفحة
    const allText = [
        (page.title || ''), 
        (page.seo.h1 || ''), 
        (page.description || ''), 
        ...(page.tags || [])
    ].join(' ').toLowerCase();

    const doc = self.compromise(allText);

    // استخراج الكيانات الرئيسية والأسماء (مع استبعاد الضمائر)
    let keywords = new Set([
        ...doc.nouns().not('#Pronoun').out('array'),
        ...doc.people().out('array'),
        ...doc.places().out('array'),
        ...doc.organizations().out('array')
    ]);

    // تنقية الكلمات المفتاحية
    const cleanedKeywords = new Set();
    keywords.forEach(k => {
        const cleaned = k.trim();
        if (cleaned.length > 2 && !STOP_WORDS.has(cleaned)) {
            cleanedKeywords.add(cleaned);
        }
    });

    return {
        id: page.id,
        url: page.url,
        title: page.title,
        keywords: cleanedKeywords, // الآن هذه ليست مجرد كلمات، بل مفاهيم
        linkEquity: page.seo.internalLinkEquity || 0
    };
}

/**
 * [مُطوّر] يبحث عن أفضل فرصة للربط باستخدام فهم السياق.
 * يقترح عبارات كاملة كنص للرابط بدلاً من كلمات مفردة.
 */
function findBestLinkingOpportunity(sourcePage, targetFingerprint, sourceDoc) {
    if (!sourcePage.content || sourcePage.id === targetFingerprint.id) return null;
    
    let bestOpportunity = null;

    targetFingerprint.keywords.forEach(keyword => {
        // ابحث عن الكلمة المفتاحية في محتوى الصفحة المصدر
        const matches = sourceDoc.match(keyword);
        if (!matches.found) return;

        // خذ أفضل تطابق (يمكن تطوير هذا لاحقًا ليأخذ كل التطابقات)
        const match = matches.first();
        
        // ابحث عن العبارة الاسمية الكاملة التي تنتمي إليها الكلمة (هذه هي القوة الحقيقية)
        let anchorPhrase = match.parent('NounPhrase');
        let anchorText = (anchorPhrase.found ? anchorPhrase : match).text('clean');

        // لا تقم بإنشاء رابط إذا كانت الكلمة موجودة بالفعل داخل رابط آخر
        if (match.has('#Link')) {
            return;
        }

        // احصل على السياق المحيط بالعبارة
        const context = match.sentence().text('clean');

        const outgoingLinksCount = sourcePage.seo?.contentAnalysis?.internalLinks ?? 0;
        const priorityScore = (targetFingerprint.linkEquity * 5) + (20 / (1 + outgoingLinksCount)) + (anchorText.length * 1.5);

        if (!bestOpportunity || priorityScore > bestOpportunity.priority) {
            bestOpportunity = {
                targetPageUrl: targetFingerprint.url,
                targetPageTitle: targetFingerprint.title,
                anchorText: anchorText, // نص رابط ذكي
                context: context,
                priority: Math.round(priorityScore)
            };
        }
    });
    return bestOpportunity;
}

function generateRecommendations(searchIndex) {
    if (!searchIndex || searchIndex.length < 2 || !self.compromise) return [];
    
    const contentPages = searchIndex.filter(p => p.content && p.seo);
    if (contentPages.length < 2) return [];

    const fingerprints = searchIndex.map(createSemanticFingerprint).filter(Boolean);
    const allRecommendations = [];

    contentPages.forEach(sourcePage => {
        // [تحسين أداء] قم بتحليل الصفحة المصدر مرة واحدة فقط
        const sourceDoc = self.compromise(sourcePage.content);

        const pageOpportunities = [];
        fingerprints.forEach(targetFingerprint => {
            const opportunity = findBestLinkingOpportunity(sourcePage, targetFingerprint, sourceDoc);
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
    if (!self.compromise) {
        console.error("Compromise library is not available in worker.");
        return;
    }
    const searchIndex = event.data;
    const recommendations = generateRecommendations(searchIndex);
    self.postMessage(recommendations);
};
