'use strict';

document.addEventListener('DOMContentLoaded', () => {

    // ===========================================
    // 1. الثوابت وإعدادات الواجهة
    // ===========================================
    const AVAILABLE_COMPONENTS = [
        'ARTICLE_HERO', 'PRODUCT_REVIEW_HERO', 'BREADCRUMB', 'HOW_TO_GUIDE',
        'RECIPE_CARD', 'FAQ_ACCORDION', 'EVENT_CARD', 'ORGANIZATION_CARD', 'FINAL_CTA'
    ];

    const MAESTRO_STRATEGY_PROTOCOL = `THE MAESTRO PROTOCOL
TO: Large Language Model (LLM) - designated as "The Maestro"
FROM: AI Tech Lead & Chief Strategist
SUBJECT: - Fully automated analysis and strategic preparation of the "Genesis Protocol". Your primary function is now to act as an SEO Analyst and Content Strategist, dynamically determining the correct schema structure from raw text before generating the final, ready-to-execute prompt.

🔥 PRIME DIRECTIVE
Your designation is The Maestro. You are the architect of the strategy. You will receive this mandate and a raw text file (\`article-filled.txt\`). Your mission is to analyze this text and construct a fully-formed, ready-to-execute "Genesis Protocol" prompt.

You do not generate HTML. You generate the master plan for the Architect AI.

🧠 CORE LOGIC & INFERENCE TASKS (Your Cognitive Process)

**Phase 1: Comprehensive Content Recreation & Polishing**
1.  Full Content Ingestion: Ingest the entirety of \`article-filled.txt\`, preserving all sections, paragraphs, and nuanced ideas without omission.
2.  Content Transformation & Enrichment: Your task is not to merely translate, but to recreate the content with strategic enhancements.
    a. Full & Faithful Recreation: Recreate the *entire* text in fluent, professional Arabic, ensuring no sections or paragraphs are dropped. The final output must be complete.
    b. Strategic Enrichment: Enhance the core text by subtly weaving in related concepts, illustrative examples, or stronger, more descriptive vocabulary. The goal is to elevate the original text, making it more comprehensive and authoritative without altering its core message.
    c. Human-Centric Tone: Adopt a highly engaging, expert, and human-like writing style. The final text should feel as if it were written by a seasoned content strategist, not a machine.
3.  Editorial Sanitization & Neutralization: After recreation and enrichment, perform a final editorial pass.
    a. Remove Promotions: Erase any direct calls-to-action for specific agencies, personal consultations, or promotional phrases (e.g., "Schedule a free consultation today", "Partner with our agency").
    b. Anonymize Authorship: Remove any personal author attribution (e.g., "By Houston Barnett-Gearhart"). The content must be presented neutrally.
4.  Final Structuring: Structure the final, polished Arabic text with descriptive Markdown headings (e.g., ## عنوان رئيسي). This refined content will become \`THE_SOUL\`.


**Phase 2: Intelligent Schema Detection & DNA Generation (CRITICAL TASK)**
1. Analyze the structured Arabic text to identify all present schema types based on the following comprehensive rules:
    - If the text provides an opinion or rating on a specific item (product, book, etc.) -> Detect **PRODUCT_REVIEW_HERO**.
    - If the text is primarily informational, journalistic, or a blog post with an author -> Detect **ARTICLE_HERO**.
    - If a clear navigational path (e.g., Home > Category > Page) is mentioned or implied -> Detect **BREADCRUMB**.
    - If the text provides a sequence of numbered or ordered instructions on how to achieve a result -> Detect **HOW_TO_GUIDE**.
    - If the text lists ingredients and cooking/preparation times -> Detect **RECIPE_CARD**.
    - If the text contains a clear question-and-answer format -> Detect **FAQ_ACCORDION**.
    - If the text mentions a specific event with a date, location, or organizer -> Detect **EVENT_CARD**.
    - If the text mentions specific company details like an address, official logo, or phone number -> Detect **ORGANIZATION_CARD**.
    - If the text ends with a clear call to action (e.g., "Buy Now", "Learn More") -> Detect **FINAL_CTA**.

2.  Assemble the TEMPLATE_DNA: Based on your detection, construct the \`[QUINARY INPUT - TEMPLATE_DNA]\` block. This is a critical strategic step.
    *   The primary entity (**ARTICLE_HERO** or **PRODUCT_REVIEW_HERO**) **MUST** be the first item.
    *   **BREADCRUMB** should typically be the second item if present.
    *   The order of the other detected components should follow a logical narrative flow as presented in the article.
    *   **FINAL_CTA** should always be the last item if present.

**Phase 3: Creative Asset Inference**
1. Based on the structured text, identify 3-5 opportunities for impactful images.
2. Generate all required metadata (filename, alt text, context keyword matching a Blueprint name) for each proposed image.
3. Assemble the ASSET_MANIFEST.

**Phase 4: Final Assembly**
1. Fetch the master template for the "Genesis Protocol v3.0".
2. Inject all your generated data into the appropriate blocks:
    - The structured Arabic text into \`[PRIMARY INPUT - THE_SOUL]\`.
    - The inferred image data into \`[SECONDARY INPUT - ASSET_MANIFEST]\`.
    - The dynamically generated component list into \`[QUINARY INPUT - TEMPLATE_DNA]\`.


✅ FINAL OUTPUT
Your ONLY output will be a clean, structured block of text containing the three required inputs for the next stage. Do NOT generate the full "Genesis Protocol". Your entire response should be ONLY the following structure, with the placeholders filled with your analysis:

"""
[PRIMARY INPUT - THE_SOUL]:
---
(Your generated and polished Arabic content based on Phase 1 goes here.)
---
   
[SECONDARY INPUT - ASSET_MANIFEST]:
---
(Your generated asset list based on Phase 3 goes here, in the format "- IMAGE: ... | alt: ... | context: ...")
---

[QUINARY INPUT - TEMPLATE_DNA]:
---
(Your detected component list from Phase 2 goes here, in the format "- COMPONENT_NAME")
---
"""
`;

    // ===========================================
    // 2. جلب العناصر من الواجهة (DOM Caching)
    // ===========================================
    const rawContentInput = document.getElementById('rawContentInput');
    const assetManifestInput = document.getElementById('assetManifestInput');
    const generatedPromptOutput = document.getElementById('generatedPromptOutput');
    const generateBtn = document.getElementById('generateBtn');
    const copyPromptBtn = document.getElementById('copyPromptBtn');
    const clearBtn = document.getElementById('clearBtn');
    const dnaContainer = document.getElementById('dna-container');
    const generateBtnSpinner = document.getElementById('generateBtnSpinner');
    const generateBtnIcon = document.getElementById('generateBtnIcon');
    const getMaestroProtocolBtn = document.getElementById('getMaestroProtocolBtn');

    // ===========================================
    // 3. الدوال الوظيفية
    // ===========================================

    /**
     * يقوم بإنشاء مربعات الاختيار للمكونات بشكل ديناميكي
     */
    function populateDnaSelector() {
        let html = '';
        AVAILABLE_COMPONENTS.forEach(component => {
            html += `
                <div class="form-check form-switch mb-2">
                    <input class="form-check-input component-checkbox" type="checkbox" role="switch" id="check-${component}" value="${component}">
                    <label class="form-check-label" for="check-${component}">${component.replace(/_/g, ' ')}</label>
                </div>
            `;
        });
        dnaContainer.innerHTML = html;
    }

    /**
     * الدالة الرئيسية التي تدير عملية التوليد
     */
    function handleGeneration() {
        const rawContent = rawContentInput.value;
        if (!rawContent.trim()) {
            showToast('الرجاء إدخال المحتوى الخام أولاً.', 'warning');
            return;
        }

        const assetManifest = assetManifestInput.value;
        
        const selectedComponents = Array.from(document.querySelectorAll('.component-checkbox:checked'))
                                        .map(cb => cb.value);

        if (selectedComponents.length === 0) {
            showToast('الرجاء اختيار مكون واحد على الأقل من قائمة TEMPLATE_DNA.', 'warning');
            return;
        }
        
        setLoadingState(true);
        
        // محاكاة تأخير بسيط كما لو أننا نتصل بـ API
        setTimeout(() => {
            const finalPrompt = GenesisProtocolGenerator.generate({
                rawContent: rawContent,
                assetManifest: assetManifest,
                templateDnaArray: selectedComponents
            });

            if (finalPrompt) {
                generatedPromptOutput.value = finalPrompt;
                    copyPromptBtn.classList.remove('btn-danger');
                    copyPromptBtn.classList.add('btn-success');
                    copyPromptBtn.innerHTML = `<i class="bi bi-clipboard ms-1" aria-hidden="true"></i> نسخ البروتوكول`;
                    copyPromptBtn.disabled = false;
                showToast('تم توليد بروتوكول Genesis بنجاح!', 'success');
            } else {
                showToast('حدث خطأ أثناء توليد البروتوكول.', 'danger');
            }
            setLoadingState(false);
        }, 500); // 0.5 ثانية تأخير للمحاكاة
    }

    /**
     * يقوم بمسح جميع المدخلات والمخرجات
     */
    function clearAll() {
        rawContentInput.value = '';
        assetManifestInput.value = '';
        generatedPromptOutput.value = '';
        document.querySelectorAll('.component-checkbox').forEach(cb => cb.checked = false);
        copyPromptBtn.disabled = true;
        copyPromptBtn.classList.remove('btn-success');
        copyPromptBtn.classList.add('btn-danger');
        copyPromptBtn.innerHTML = `<i class="bi bi-clipboard-x ms-1" aria-hidden="true"></i> نسخ البروتوكول`;
        showToast('تم مسح جميع الحقول.', 'info');
        rawContentInput.focus();
    }

    /**
     * إدارة حالة التحميل للزر الرئيسي
     */
    function setLoadingState(isLoading) {
        if (isLoading) {
            generateBtn.disabled = true;
            generateBtnSpinner.style.display = 'inline-block';
            generateBtnIcon.style.display = 'none';
        } else {
            generateBtn.disabled = false;
            generateBtnSpinner.style.display = 'none';
            generateBtnIcon.style.display = 'inline-block';
        }
    }

    // ===========================================
    // 4. ربط الأحداث وتهيئة الواجهة
    // ===========================================
    populateDnaSelector(); // بناء مربعات الاختيار عند تحميل الصفحة
    generateBtn.addEventListener('click', handleGeneration);
    clearBtn.addEventListener('click', clearAll);

    copyPromptBtn.addEventListener('click', () => {
    if (!generatedPromptOutput.value) return; // حماية إضافية

    navigator.clipboard.writeText(generatedPromptOutput.value)
        .then(() => {
            const originalHtml = copyPromptBtn.innerHTML;
            copyPromptBtn.innerHTML = `<i class="bi bi-check-lg ms-1" aria-hidden="true"></i> تم النسخ!`;
            copyPromptBtn.disabled = true; // تعطيل مؤقت لمنع الضغط المتكرر

            // إعادة الزر إلى حالته الطبيعية بعد ثانيتين
            setTimeout(() => {
                copyPromptBtn.innerHTML = `<i class="bi bi-clipboard ms-1" aria-hidden="true"></i> نسخ البروتوكول`;
                copyPromptBtn.disabled = false;
            }, 2000);

            showToast('تم نسخ البروتوكول إلى الحافظة بنجاح.', 'success');
        })
        .catch(err => {
            console.error('فشل النسخ:', err);
            showToast('فشل نسخ البروتوكول.', 'danger');
        });
});
        getMaestroProtocolBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(MAESTRO_STRATEGY_PROTOCOL)
            .then(() => {
                showToast('تم نسخ بروتوكول "المايسترو" بنجاح.', 'success');
                
                const guidanceMessage = `
                    <strong class="d-block mb-2">الخطوة التالية:</strong>
                    <ol class="mb-0 ps-3">
                        <li>اذهب إلى نموذج اللغة (LLM).</li>
                        <li>الصق البروتوكول الذي تم نسخه.</li>
                        <li>أضف النص الخام الخاص بك.</li>
                        <li>عد إلى هنا بالمخرجات.</li>
                    </ol>
                `;
                showToast(guidanceMessage, 'info', 10000); 
            })
            .catch(err => {
                console.error('فشل نسخ بروتوكول المايسترو:', err);
                showToast('فشل نسخ بروتوكول المايسترو.', 'danger');
            });
    });
});
