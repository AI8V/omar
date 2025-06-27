// Mind & Machine - Schema Architect v1.5 (Final: User Control + Smart Nesting)
// This script powers the standalone schema generation lab.
// Final, production-ready version with intelligent merging logic.

(function() {
    'use strict';

    // ===================================================================
    //  1. DOM Element Caching
    // ===================================================================

    const analyzeBtn = document.getElementById('analyzeBtn');
    const analysisResults = document.getElementById('analysisResults');
    const generatedCode = document.getElementById('generatedCode');
    const copyBtn = document.getElementById('copyBtn');
    const urlInput = document.getElementById('urlInput');
    const htmlContentInput = document.getElementById('htmlContentInput');

    // ===================================================================
    //  2. Core Analysis Engine (The "Brain")
    // ===================================================================

    function analyzeContent(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const entities = [];

        // Primary entities
        const headline = doc.querySelector('h1')?.textContent.trim();
        if (headline) entities.push({ name: 'العنوان الرئيسي (H1)', value: headline, schemaProp: 'headline' });
        
        const description = doc.querySelector('meta[name="description"]')?.content;
        if (description) entities.push({ name: 'وصف الميتا', value: description, schemaProp: 'description' });

        const image = doc.querySelector('meta[property="og:image"]')?.content;
        if (image) entities.push({ name: 'الصورة الرئيسية (OG)', value: image, schemaProp: 'image' });

        // Contextual entities
        const author = doc.querySelector('.author, [rel="author"], a[href*="/author/"]')?.textContent.trim();
        if (author) entities.push({ name: 'المؤلف', value: author, schemaProp: 'author' });

        const date = doc.querySelector('time')?.getAttribute('datetime') || doc.querySelector('[itemprop="datePublished"]')?.getAttribute('content');
        if (date) {
            const dateObj = new Date(date);
            const displayDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : date;
            entities.push({ name: 'تاريخ النشر', value: displayDate, schemaProp: 'datePublished', rawValue: dateObj.toISOString() });
        }

        // Structural entities (e.g., FAQs)
        const faqItems = Array.from(doc.querySelectorAll('.faq-item, .question-wrapper, .faq-card'));
        if (faqItems.length > 0) {
             const questions = faqItems.map(item => {
                 const question = item.querySelector('.question, .faq-q, h3, h4')?.textContent.trim();
                 const answer = item.querySelector('.answer, .faq-a, div > p, .card-body')?.textContent.trim();
                 return { q: question, a: answer };
             }).filter(item => item.q && item.a);
             
             if(questions.length > 0) {
                 entities.push({ name: 'الأسئلة الشائعة', value: `${questions.length} سؤال وجواب`, schemaProp: 'mainEntity', type: 'FAQ', rawValue: questions });
             }
        }
        
        // Fallback entity
        const pageTitle = doc.querySelector('title')?.textContent.trim();
        if (pageTitle) entities.push({ name: 'عنوان الصفحة (Title)', value: pageTitle, schemaProp: null });

        return entities;
    }

    function suggestSchema(entities) {
        const suggestions = [{ type: 'WebPage', confidence: 0.5, reason: "الخيار الافتراضي لأي صفحة ويب." }];
        const hasHeadline = entities.some(e => e.schemaProp === 'headline');
        const hasDate = entities.some(e => e.schemaProp === 'datePublished');

        if (hasHeadline && hasDate) {
            suggestions.push({ type: 'Article', confidence: 0.9, reason: "تم العثور على عنوان رئيسي وتاريخ نشر." });
        }
        if (entities.some(e => e.type === 'FAQ')) {
             suggestions.push({ type: 'FAQPage', confidence: 0.95, reason: "تم العثور على بنية أسئلة وأجوبة." });
        }
        
        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }
    
    // ===================================================================
    //  >>>>> THE REBUILT AND FINAL FUNCTION <<<<<
    // ===================================================================
    function generateFinalSchema(entities, primaryType, pageUrl) {
        const hasArticleData = entities.some(e => e.schemaProp === 'headline') && entities.some(e => e.schemaProp === 'datePublished');
        const faqEntity = entities.find(e => e.type === 'FAQ');

        // --- Smart Nesting Logic (Only when Article is selected) ---
        if (primaryType === 'Article' && hasArticleData && faqEntity) {
            const schema = {
                "@context": "https://schema.org",
                "@type": "Article",
                "mainEntityOfPage": { "@type": "WebPage", "@id": pageUrl || "" },
            };

            entities.forEach(entity => {
                if (entity.type !== 'FAQ') {
                    if (entity.schemaProp === 'author') {
                        schema.author = { "@type": "Person", "name": entity.value };
                    } else if (entity.schemaProp) {
                        schema[entity.schemaProp] = entity.rawValue || entity.value;
                    }
                }
            });
            
            schema.mainEntity = {
                "@type": "FAQPage",
                "mainEntity": faqEntity.rawValue.map(item => ({
                    "@type": "Question",
                    "name": item.q,
                    "acceptedAnswer": { "@type": "Answer", "text": item.a }
                }))
            };
            
            if (!schema.headline) {
                const titleEntity = entities.find(e => e.name === 'عنوان الصفحة (Title)');
                if (titleEntity) schema.headline = titleEntity.value;
            }
            if (!schema.description) {
                schema.description = schema.headline || "وصف موجز للصفحة.";
            }
            return schema;
        }

        // --- General Logic for all other cases (respects user's choice) ---
        const schema = {
            "@context": "https://schema.org",
            "@type": primaryType,
            "mainEntityOfPage": { "@type": "WebPage", "@id": pageUrl || "" },
        };

        const detectedTypes = new Set([primaryType]);
        if (primaryType !== 'WebPage') {
            if (hasArticleData) detectedTypes.add('Article');
            if (faqEntity && primaryType === 'FAQPage') detectedTypes.add('FAQPage');
        }
        
        const finalTypes = Array.from(detectedTypes);
        schema["@type"] = finalTypes.length === 1 ? finalTypes[0] : finalTypes;

        entities.forEach(entity => {
            if (entity.schemaProp === 'mainEntity' && entity.type === 'FAQ') {
                if (primaryType === 'FAQPage' || (Array.isArray(schema["@type"]) && schema["@type"].includes('FAQPage'))) {
                    schema.mainEntity = entity.rawValue.map(item => ({
                        "@type": "Question",
                        "name": item.q,
                        "acceptedAnswer": { "@type": "Answer", "text": item.a }
                    }));
                }
            } else if (entity.schemaProp === 'author') {
                if (primaryType === 'Article' || (Array.isArray(schema["@type"]) && schema["@type"].includes('Article'))) {
                   schema.author = { "@type": "Person", "name": entity.value };
                }
            } else if (entity.schemaProp) {
                schema[entity.schemaProp] = entity.rawValue || entity.value;
            }
        });
        
        if (!schema.headline) {
            const titleEntity = entities.find(e => e.name === 'عنوان الصفحة (Title)');
            if (titleEntity) schema.headline = titleEntity.value;
        }
        if (!schema.description) {
            schema.description = schema.headline || "وصف موجز للصفحة.";
        }
        
        if (schema["@type"] === 'WebPage') {
            delete schema.mainEntity;
            delete schema.author;
            delete schema.datePublished;
        }
        
        return schema;
    }


    // ===================================================================
    //  3. UI Rendering & State Management
    // ===================================================================

    function renderAnalysis(entities, suggestions) {
        let html = `<h3 class="h5 mb-3">1. الكيانات المكتشفة:</h3>`;
        if (entities.length === 0) {
            html += `<p class="text-muted small">لم يتم اكتشاف كيانات واضحة. قد يكون المحتوى بسيطًا جدًا.</p>`;
        } else {
            entities.forEach(entity => {
                html += `
                    <div class="card p-3 mb-2 entity-card">
                        <div class="d-flex justify-content-between align-items-center">
                            <strong class="text-primary-emphasis">${entity.name}</strong>
                            ${entity.schemaProp ? `<span class="badge bg-secondary">${entity.schemaProp}</span>` : ''}
                        </div>
                        <p class="mb-0 mt-2 text-muted text-truncate" title="${entity.value}">${entity.value}</p>
                    </div>`;
            });
        }

        html += `<h3 class="h5 mt-4 mb-3">2. أنواع السكيما المقترحة:</h3>`;
        suggestions.forEach(suggestion => {
            html += `
                <div class="p-3 mb-2 border rounded schema-suggestion" data-schema-type="${suggestion.type}" style="cursor: pointer;">
                    <strong>${suggestion.type}</strong>
                    <div class="progress mt-2" style="height: 5px;">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${suggestion.confidence * 100}%;" aria-valuenow="${suggestion.confidence * 100}" aria-label="مستوى الثقة في هذا الاقتراح"></div>
                    </div>
                    <div class="schema-explanation mt-2 p-2 small border-top">
                        <strong>لماذا؟</strong> ${suggestion.reason}
                    </div>
                </div>`;
        });
        analysisResults.innerHTML = html;
    }

    function updateCopyButtonState(isEnabled, text = 'نسخ') {
        copyBtn.disabled = !isEnabled;
        copyBtn.classList.toggle('disabled', !isEnabled); 
        
        if (text === 'نسخ') {
            copyBtn.innerHTML = `<i class="bi bi-clipboard-check me-1"></i> نسخ`;
        } else {
            copyBtn.innerHTML = text;
        }
    }

    // ===================================================================
    //  4. Main Logic Flow & Event Listeners
    // ===================================================================
    
    async function handleAnalysis() {
        const url = urlInput.value.trim();
        const html = htmlContentInput.value.trim();

        if (!url && !html) {
            alert("يرجى إدخال رابط أو لصق كود HTML للبدء.");
            return;
        }
        
        analysisResults.innerHTML = `<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">جاري التحليل...</span></div><p class="mt-2">جاري فك شفرة المحتوى...</p></div>`;
        generatedCode.value = '';
        updateCopyButtonState(false);
        
        try {
            let contentToAnalyze = html;
            if (!contentToAnalyze && url) {
                contentToAnalyze = await fetchContent(url);
                if (!contentToAnalyze) throw new Error("فشل في جلب المحتوى من الرابط. تأكد من صحته.");
            }

            const entities = analyzeContent(contentToAnalyze);
            const suggestions = suggestSchema(entities);
            
            renderAnalysis(entities, suggestions);

            const updateSchemaOutput = (type) => {
                const finalSchema = generateFinalSchema(entities, type, url);
                generatedCode.value = JSON.stringify(finalSchema, null, 2);
            };

            if (suggestions.length > 0) {
                const bestType = suggestions[0].type;
                updateSchemaOutput(bestType);
                updateCopyButtonState(true);
                
                const bestSuggestionEl = document.querySelector(`.schema-suggestion[data-schema-type="${bestType}"]`);
                if (bestSuggestionEl) {
                    bestSuggestionEl.classList.add('border-primary', 'border-2');
                }
            }

            document.querySelectorAll('.schema-suggestion').forEach(el => {
                el.addEventListener('click', () => {
                    document.querySelectorAll('.schema-suggestion').forEach(s => s.classList.remove('border-primary', 'border-2'));
                    el.classList.add('border-primary', 'border-2');
                    
                    const selectedType = el.dataset.schemaType;
                    updateSchemaOutput(selectedType);
                });
            });

        } catch (error) {
            analysisResults.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
            updateCopyButtonState(false); 
        }
    }

    async function fetchContent(url) {
        const PROXY_URL = `https://api.allorigins.win/raw?url={url}`;
        try {
            const response = await fetch(PROXY_URL.replace('{url}', encodeURIComponent(url)));
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.text();
        } catch (networkError) {
             throw new Error(`فشل في الاتصال بالشبكة. تأكد من اتصالك بالإنترنت أو أن البروكسي يعمل.`);
        }
    }

    analyzeBtn.addEventListener('click', handleAnalysis);
    
    copyBtn.addEventListener('click', () => {
        if (!copyBtn.disabled && generatedCode.value) {
            navigator.clipboard.writeText(generatedCode.value)
                .then(() => {
                    updateCopyButtonState(true, `<i class="bi bi-check-lg me-1"></i> تم النسخ!`);
                    setTimeout(() => updateCopyButtonState(true), 2000);
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                    alert('فشل النسخ إلى الحافظة. قد لا يدعم متصفحك هذه الميزة أو أن الصفحة غير آمنة (non-https).');
                });
        }
    });

})();