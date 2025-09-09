(function() {
    'use strict';

    // ===================================================================
    //  1. DOM Element Caching
    // ===================================================================

    const DOM = {
        analyzeBtn: document.getElementById('analyzeBtn'),
        analysisResults: document.getElementById('analysisResults'),
        generatedCode: document.getElementById('generatedCode'),
        urlInput: document.getElementById('urlInput'),
        htmlContentInput: document.getElementById('htmlContentInput'),
        baseUrlContainer: document.getElementById('baseUrlContainer'),
        baseUrlInput: document.getElementById('baseUrlInput'),

        copyBtn: document.getElementById('copyBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        validateBtn: document.getElementById('validateBtn'),

        sgePreviewContainer: document.getElementById('sge-preview'),
        sgePreviewContent: document.getElementById('sge-preview-content'),

        copyEnhancedPromptBtn: document.getElementById('copyEnhancedPromptBtn'),

        // --- منطقة المُعرّفات المخصصة ---
        faqItem: document.getElementById('customFaqItem'),
        faqQuestion: document.getElementById('customFaqQuestion'),
        faqAnswer: document.getElementById('customFaqAnswer'),
        productPrice: document.getElementById('customProductPrice'),
        productCurrency: document.getElementById('customProductCurrency'),
        productSku: document.getElementById('customProductSku'),
        productBrand: document.getElementById('customProductBrand'),
        recipePrepTime: document.getElementById('customRecipePrepTime'),
        recipeCookTime: document.getElementById('customRecipeCookTime'),
        recipeIngredients: document.getElementById('customRecipeIngredients'),
        reviewRating: document.getElementById('customReviewRating'),
        reviewItemName: document.getElementById('customReviewItemName'),
        howToStep: document.getElementById('customHowToStep'),
        howToText: document.getElementById('customHowToText'),
        eventStartDate: document.getElementById('customEventStartDate'),
        eventLocation: document.getElementById('customEventLocation'),
        eventOrganizer: document.getElementById('customEventOrganizer'),
        orgLogo: document.getElementById('customOrgLogo'),
        orgAddress: document.getElementById('customOrgAddress'),
        orgTelephone: document.getElementById('customOrgTelephone'),
        breadcrumbItem: document.getElementById('customBreadcrumbItem'),
    };

    let selectedPrimaryType = null;
    
    // Show/hide the optional base URL input when user pastes HTML
    if (DOM.htmlContentInput && DOM.baseUrlContainer) {
        DOM.htmlContentInput.addEventListener('input', () => {
            DOM.baseUrlContainer.style.display = DOM.htmlContentInput.value.trim() ? 'block' : 'none';
        });
    }

    // ===================================================================
    //  2. Core Analysis & Helper Functions
    // ===================================================================
    
    function getSelector(inputElement, defaultSelector) {
        return inputElement && inputElement.value.trim() ? inputElement.value.trim() : defaultSelector;
    }

    function convertToISODuration(text) {
        if (!text) return null;
        let hours = 0;
        let minutes = 0;
        const hourRegex = /(\d+)\s*(ساعة|ساعات|hour|hours)/i;
        const minuteRegex = /(\d+)\s*(دقيقة|دقائق|minute|minutes)/i;
        const hourMatch = text.match(hourRegex);
        const minuteMatch = text.match(minuteRegex);
        if (hourMatch) hours = parseInt(hourMatch[1], 10);
        if (minuteMatch) minutes = parseInt(minuteMatch[1], 10);
        if (!hourMatch && !minuteMatch && /^\d+$/.test(text.trim())) {
             minutes = parseInt(text.trim(), 10);
        }
        if (hours === 0 && minutes === 0) return null;
        let duration = 'PT';
        if (hours > 0) duration += `${hours}H`;
        if (minutes > 0) duration += `${minutes}M`;
        return duration;
    }

    function analyzeContent(html, baseUrl) {
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Create a <base> element to ensure all relative URLs are resolved correctly
        if (baseUrl) {
            let base = doc.querySelector('base');
            if (!base) {
                base = doc.createElement('base');
                doc.head.appendChild(base);
            }
            base.href = baseUrl;
        }

        let entities = [];
        // Sub-functions will now correctly resolve relative URLs via doc.baseURI
        entities = entities.concat(
            analyzePrimaryEntities(doc),
            analyzeProductEntities(doc),
            analyzeReviewEntities(doc), 
            analyzeEventEntities(doc),
            analyzeOrganizationEntities(doc),
            analyzeHowToEntities(doc),
            analyzeRecipeEntities(doc),
            analyzeFaqEntities(doc),
            analyzeBreadcrumbEntities(doc)
        );
        const pageTitle = doc.querySelector('title')?.textContent.trim();
        if (pageTitle && !entities.some(e => e.schemaProp === 'name')) {
             entities.push({ name: 'عنوان الصفحة (Title)', value: pageTitle, schemaProp: 'name' });
        }
        return entities;
    }

    function findClosestHeading(element) {
        const container = element.closest('section, article');
        if (container) {
            const heading = container.querySelector('h2, h3');
            if (heading) return heading.textContent.trim();
        }
        let current = element;
        while(current) {
            let sibling = current.previousElementSibling;
            while(sibling) {
                if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(sibling.tagName)) {
                    return sibling.textContent.trim();
                }
                sibling = sibling.previousElementSibling;
            }
            current = current.parentElement;
            if(current && current.tagName === 'BODY') break;
        }
        return null;
    }

    function analyzePrimaryEntities(doc) {
        const entities = [];
        const headline = doc.querySelector('h1')?.textContent.trim();
        if (headline) entities.push({ name: 'العنوان الرئيسي (H1)', value: headline, schemaProp: 'name' });

        const description = doc.querySelector('meta[name="description"]')?.content;
        if (description) entities.push({ name: 'وصف الميتا', value: description, schemaProp: 'description' });

        const image = doc.querySelector('meta[property="og:image"]')?.content;
        if (image) entities.push({ name: 'الصورة الرئيسية (OG)', value: image, schemaProp: 'image' });

        const author = doc.querySelector('.author, [rel="author"], a[href*="/author/"]')?.textContent.trim();
        if (author) entities.push({ name: 'المؤلف', value: author, schemaProp: 'author', type: 'Article' });

        const date = doc.querySelector('time')?.getAttribute('datetime') || doc.querySelector('[itemprop="datePublished"]')?.getAttribute('content');
        if (date) {
            const dateObj = new Date(date);
            const displayDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : date;
            entities.push({ name: 'تاريخ النشر', value: displayDate, schemaProp: 'datePublished', rawValue: dateObj.toISOString(), type: 'Article' });
        }
        return entities;
    }
    
    function analyzeBreadcrumbEntities(doc) {
        const itemSelector = getSelector(DOM.breadcrumbItem, 'nav[aria-label="breadcrumb"] ol li, .breadcrumb li, [class*="breadcrumbs"] li');
        const items = Array.from(doc.querySelectorAll(itemSelector));

        if (items.length > 1) { 
            const breadcrumbItems = items.map(item => {
                const link = item.querySelector('a');
                const name = item.textContent.trim();
                const url = link ? new URL(link.getAttribute('href'), doc.baseURI).href : null;
                return { name, url };
            }).filter(i => i.name);

            if (breadcrumbItems.length > 1) {
                return [{ 
                    name: 'مسار التنقل (Breadcrumb)', 
                    value: breadcrumbItems.map(i => i.name).join(' > '), 
                    schemaProp: 'itemListElement', 
                    type: 'Breadcrumb', 
                    rawValue: breadcrumbItems 
                }];
            }
        }
        return [];
    }

    function analyzeFaqEntities(doc) {
        const itemSelector = getSelector(DOM.faqItem, '.faq-item, .accordion-item, .qa-item');
        const questionSelector = getSelector(DOM.faqQuestion, '.question, .faq-q, .accordion-button, .query-title');
        const answerSelector = getSelector(DOM.faqAnswer, '.answer, .faq-a, .accordion-body, .response-text');
        
        const items = Array.from(doc.querySelectorAll(itemSelector));
        if (items.length > 0) {
             const questions = items.map(item => ({ 
                 q: item.querySelector(questionSelector)?.textContent.trim(), 
                 a: item.querySelector(answerSelector)?.textContent.trim() 
             })).filter(i => i.q && i.a);

             if (questions.length > 0) {
                 const contextualName = findClosestHeading(items[0]);
                 return [{ name: contextualName || 'الأسئلة الشائعة', value: `${questions.length} سؤال وجواب`, schemaProp: 'mainEntity', type: 'FAQ', rawValue: questions, contextualName }];
             }
        }
        return [];
    }

    function analyzeProductEntities(doc) {
        const entities = [];
        const priceSelector = getSelector(DOM.productPrice, '[class*="price"], [id*="price"], .cost');
        const skuSelector = getSelector(DOM.productSku, '[class*="sku"], [id*="sku"], .item-code');
        const brandSelector = getSelector(DOM.productBrand, '[class*="brand"], [id*="brand"], .vendor-name');

        const priceEl = doc.querySelector(priceSelector);
        if (priceEl) {
            const priceText = priceEl.textContent.trim();
            const price = priceText.replace(/[^0-9.]/g, '');
            if(price) {
                entities.push({ name: 'السعر', value: price, schemaProp: 'price', type: 'Product' });
                const contextualName = findClosestHeading(priceEl);
                if(contextualName) entities.push({ name: contextualName, value: contextualName, schemaProp: 'contextualName', type: 'Product', contextualName });
                
                const inferredCurrency = inferCurrency(priceText);
                if (inferredCurrency) {
                     entities.push({ name: 'العملة (مستنتج)', value: inferredCurrency, schemaProp: 'priceCurrency', type: 'Product' });
                }
            }
        }
        
        const currencyInput = DOM.productCurrency.value.trim().toUpperCase();
        if (currencyInput) { 
            const existingCurrencyIndex = entities.findIndex(e => e.schemaProp === 'priceCurrency');
            if (existingCurrencyIndex > -1) entities.splice(existingCurrencyIndex, 1);
            entities.push({ name: 'العملة (مخصص)', value: currencyInput, schemaProp: 'priceCurrency', type: 'Product' });
        }
        
        const skuEl = doc.querySelector(skuSelector);
        if (skuEl) entities.push({ name: 'SKU', value: skuEl.textContent.trim(), schemaProp: 'sku', type: 'Product' });
        
        const brandEl = doc.querySelector(brandSelector);
        if (brandEl) entities.push({ name: 'العلامة التجارية', value: brandEl.textContent.trim(), schemaProp: 'brand', type: 'Product' });
        
        return entities;
    }
    
    function analyzeReviewEntities(doc) {
        const entities = [];
        const ratingSelector = getSelector(DOM.reviewRating, '[class*="rating"], [itemprop="ratingValue"]');
        const itemNameSelector = getSelector(DOM.reviewItemName, '.reviewed-item-name');

        const ratingEl = doc.querySelector(ratingSelector);
        if (ratingEl) {
            const ratingText = ratingEl.getAttribute('content') || ratingEl.textContent.trim();
            const ratingValue = ratingText.match(/(\d+(\.\d+)?)/);
            if (ratingValue && ratingValue[0]) {
                 entities.push({ name: 'تقييم المراجعة', value: ratingValue[0], schemaProp: 'reviewRating', type: 'Review' });
            }
        }
        
        const itemNameEl = doc.querySelector(itemNameSelector);
        if (itemNameEl) {
            entities.push({ name: 'اسم العنصر المُرَاجَع', value: itemNameEl.textContent.trim(), schemaProp: 'itemName', type: 'Review' });
        }

        return entities;
    }

    function analyzeRecipeEntities(doc) {
        const entities = [];
        const recipeSelector = 'section[itemtype*="schema.org/Recipe"], .recipe-card';
        const recipeContainer = doc.querySelector(recipeSelector);
        if (!recipeContainer) return [];
    
        // All selectors are now relative to the recipeContainer
        const prepTimeSelector = getSelector(DOM.recipePrepTime, '[class*="prep-time"], [itemprop="prepTime"]');
        const cookTimeSelector = getSelector(DOM.recipeCookTime, '[class*="cook-time"], [itemprop="cookTime"]');
        const ingredientsSelector = getSelector(DOM.recipeIngredients, '.ingredients li, [itemprop="recipeIngredient"]');
        const instructionsSelector = '.recipe-instructions li, [itemprop="recipeInstructions"]'; // New selector for recipe steps
    
        // Find contextual image
        const contextualImageEl = recipeContainer.querySelector('img');
        if (contextualImageEl) {
            entities.push({ name: 'صورة الوصفة السياقية', value: new URL(contextualImageEl.src, doc.baseURI).href, schemaProp: 'image', type: 'Recipe' });
        }
    
        // Find ingredients
        const ingredients = Array.from(recipeContainer.querySelectorAll(ingredientsSelector));
        if (ingredients.length > 0) {
            const ingredientList = ingredients.map(li => li.textContent.trim()).filter(Boolean);
            const contextualName = findClosestHeading(ingredients[0]) || recipeContainer.querySelector('h1, h2, h3')?.textContent.trim();
            entities.push({ name: contextualName || 'وصفة', value: `${ingredientList.length} مكون`, schemaProp: 'recipeIngredient', type: 'Recipe', rawValue: ingredientList, contextualName });
        }
        
        // **NEW LOGIC: Find instructions ONLY within the recipe container**
        const instructions = Array.from(recipeContainer.querySelectorAll(instructionsSelector));
        if (instructions.length > 0) {
            const instructionData = instructions.map(step => ({ "@type": "HowToStep", "text": step.textContent.trim() })).filter(s => s.text);
            if (instructionData.length > 0) {
                entities.push({ name: 'تعليمات الوصفة', value: `${instructionData.length} خطوة`, schemaProp: 'recipeInstructions', type: 'Recipe', rawValue: instructionData });
            }
        }
    
        // Find prep and cook times
        const prepTimeEl = recipeContainer.querySelector(prepTimeSelector);
        if (prepTimeEl) {
            const prepTimeText = prepTimeEl.getAttribute('content') || prepTimeEl.textContent.trim();
            const prepTimeISO = convertToISODuration(prepTimeText);
            entities.push({ name: 'وقت التحضير', value: prepTimeText, rawValue: prepTimeISO, schemaProp: 'prepTime', type: 'Recipe' });
        }
        
        const cookTimeEl = recipeContainer.querySelector(cookTimeSelector);
        if (cookTimeEl) {
            const cookTimeText = cookTimeEl.getAttribute('content') || cookTimeEl.textContent.trim();
            const cookTimeISO = convertToISODuration(cookTimeText);
            entities.push({ name: 'وقت الطهي', value: cookTimeText, rawValue: cookTimeISO, schemaProp: 'cookTime', type: 'Recipe' });
        }
        
        return entities;
    }

    function analyzeHowToEntities(doc) {
        const howtoSelector = 'section[itemtype*="schema.org/HowTo"], .howto-guide'; // A robust selector for the HowTo container
        const howtoContainer = doc.querySelector(howtoSelector);
        if (!howtoContainer) return [];
    
        const entities = [];
        const stepSelector = getSelector(DOM.howToStep, '.step, .howto-step, [itemprop="step"]');
        const textSelector = getSelector(DOM.howToText, '.step-text, .howto-text, [itemprop="text"]');
        
        // **NEW: Find the contextual image WITHIN the HowTo container**
        const contextualImageEl = howtoContainer.querySelector('img');
        if (contextualImageEl) {
            entities.push({ name: 'صورة الإرشادات السياقية', value: new URL(contextualImageEl.src, doc.baseURI).href, schemaProp: 'image', type: 'HowTo' });
        }
    
        const steps = Array.from(howtoContainer.querySelectorAll(stepSelector));
        if (steps.length > 0) {
            const stepData = steps.map(step => ({ 
                "@type": "HowToStep", 
                "text": step.querySelector(textSelector)?.textContent.trim() 
            })).filter(s => s.text);
    
            if (stepData.length > 0) {
                const contextualName = findClosestHeading(steps[0]) || howtoContainer.querySelector('h1, h2, h3')?.textContent.trim();
                entities.push({ name: contextualName || 'الإرشادات', value: `${stepData.length} خطوة`, schemaProp: 'step', type: 'HowTo', rawValue: stepData, contextualName });
            }
        }
        return entities;
    }

    function analyzeEventEntities(doc) {
        const entities = [];
        const startDateSelector = getSelector(DOM.eventStartDate, '[class*="start-date"], [itemprop*="startDate"]');
        const locationSelector = getSelector(DOM.eventLocation, '[class*="location"], [itemprop*="location"]');
        const organizerSelector = getSelector(DOM.eventOrganizer, '[class*="organizer"], [itemprop*="organizer"]');

        const startDateEl = doc.querySelector(startDateSelector);
        if (startDateEl) {
            const dateValue = startDateEl.getAttribute('datetime') || startDateEl.textContent.trim();
            entities.push({ name: 'تاريخ بدء الحدث', value: dateValue, schemaProp: 'startDate', type: 'Event' });
            
            const contextualName = findClosestHeading(startDateEl);
            if(contextualName) entities.push({ name: contextualName, value: contextualName, schemaProp: 'contextualName', type: 'Event', contextualName });

            const locationEl = doc.querySelector(locationSelector);
            if(locationEl) entities.push({ name: 'مكان الحدث', value: locationEl.textContent.trim(), schemaProp: 'location', type: 'Event' });

            const organizerEl = doc.querySelector(organizerSelector);
            if(organizerEl) entities.push({ name: 'منظم الحدث', value: organizerEl.textContent.trim(), schemaProp: 'organizer', type: 'Event' });
        }
        return entities;
    }

    function analyzeOrganizationEntities(doc) {
        const entities = [];
        const logoSelector = getSelector(DOM.orgLogo, 'img[src*="logo"], img[alt*="logo"]');
        const addressSelector = getSelector(DOM.orgAddress, '.address, .contact-address, footer address');
        const telephoneSelector = getSelector(DOM.orgTelephone, 'a[href^="tel:"]');

        const logoEl = doc.querySelector(logoSelector);
        const addressElFromCustom = DOM.orgAddress.value.trim() ? doc.querySelector(DOM.orgAddress.value.trim()) : null;

        if (logoEl || addressElFromCustom) {
             if (logoEl) entities.push({ name: 'شعار المنظمة', value: new URL(logoEl.src, doc.baseURI).href, schemaProp: 'logo', type: 'Organization' });
             
             const addressEl = addressElFromCustom || doc.querySelector(addressSelector);
             if (addressEl) {
                const addressText = addressEl.textContent.replace(/\s+/g, ' ').trim();
                entities.push({ name: 'عنوان المنظمة', value: addressText.split('\n')[0], schemaProp: 'address', type: 'Organization' });
             }
             
             const telephoneEl = doc.querySelector(telephoneSelector);
             if (telephoneEl) {
                 const phone = telephoneEl.getAttribute('href')?.replace('tel:', '') || telephoneEl.textContent.trim();
                 entities.push({ name: 'هاتف المنظمة', value: phone, schemaProp: 'telephone', type: 'Organization' });
             }
        }
        return entities;
    }

    function inferCurrency(text) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('ريال') || lowerText.includes('sar')) return 'SAR';
        if (lowerText.includes('درهم') || lowerText.includes('aed')) return 'AED';
        if (lowerText.includes('جنية') || lowerText.includes('egp')) return 'EGP';
        if (lowerText.includes('$') || lowerText.includes('usd') || lowerText.includes('dollar')) return 'USD';
        if (lowerText.includes('€') || lowerText.includes('eur')) return 'EUR';
        return null;
    }

    function suggestSchema(entities) {
    const suggestions = [];
    const foundTypes = new Map(); // Use a Map to store the best evidence for each type

    // Define the schema types and their detection logic
    const hierarchy = [
        { type: 'Product', reason: "تم العثور على سعر للمنتج.", confidence: 0.98, evidenceKey: 'Product' },
        { type: 'Review', reason: "تم العثور على بيانات تقييم.", confidence: 0.97, evidenceKey: 'Review' },
        { type: 'Recipe', reason: "تم العثور على قائمة مكونات.", confidence: 0.95, evidenceKey: 'Recipe' },
        { type: 'BreadcrumbList', reason: "تم العثور على مسار تنقل (Breadcrumb).", confidence: 0.96, evidenceKey: 'Breadcrumb' },
        { type: 'HowTo', reason: "تم العثور على بنية خطوات إرشادية.", confidence: 0.92, evidenceKey: 'HowTo' },
        { type: 'FAQPage', reason: "تم العثور على بنية أسئلة وأجوبة.", confidence: 0.90, evidenceKey: 'FAQ' },
        { type: 'Event', reason: "تم العثور على تاريخ أو مكان للحدث.", confidence: 0.90, evidenceKey: 'Event' },
        { type: 'Article', reason: "تم العثور على تاريخ نشر أو مؤلف.", confidence: 0.85, evidenceKey: 'Article' },
        { type: 'Organization', reason: "تم العثور على بيانات منظمة (شعار، عنوان).", confidence: 0.80, evidenceKey: 'Organization' }
    ];

    // Find all unique entity types present in the analysis
    const presentEntityTypes = new Set(entities.map(e => e.type).filter(Boolean));

    // For each schema type in our hierarchy, check if its evidence exists
    hierarchy.forEach(schema => {
        if (presentEntityTypes.has(schema.evidenceKey)) {
            suggestions.push({
                type: schema.type,
                confidence: schema.confidence,
                reason: schema.reason
            });
        }
    });

    // **THE TRANSPARENCY GUARANTEE**
    // Always add WebPage as a safe, default option, but ensure it's at the end
    // if other, more specific suggestions were found.
    suggestions.push({ type: 'WebPage', confidence: 0.5, reason: "الخيار الافتراضي لأي صفحة ويب." });

    // Sort the final list by confidence score in descending order
    return suggestions.sort((a, b) => b.confidence - a.confidence);
}
    


function displayExistingSchema(htmlContent) {
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));

    if (scripts.length === 0) {
        return ''; // لا تفعل شيئًا إذا لم توجد سكيما
    }

    let outputHtml = `<hr class="my-4"><h3 class="h5 mt-4 mb-3"><span class="bi bi-shield-check ms-2"></span> 3. السكيما الحالية المكتشفة:</h3>`;

    scripts.forEach((script, index) => {
        try {
            const jsonData = JSON.parse(script.textContent);
            const schemaType = jsonData['@type'] || 'غير معروف';
            outputHtml += `
                <div class="card shadow-sm mb-3">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <span class="fw-bold">النوع: ${schemaType}</span>
                        <span class="badge bg-info text-dark">#${index + 1}</span>
                    </div>
                    <div class="card-body p-0">
                        <textarea class="border-0 form-control" dir="ltr" readonly rows="8">${JSON.stringify(jsonData, null, 2)}</textarea>
                    </div>
                </div>`;
        } catch (e) {
            // تجاهل أي كود JSON غير صالح
        }
    });

    return outputHtml;
}

    // ===================================================================
    //  3. Final Schema Generation Engine
    // ===================================================================
    
    function generateFinalSchema(entities, primaryType, pageUrl) {
        let schema = { 
            "@context": "https://schema.org", 
            "@type": primaryType, 
            "mainEntityOfPage": { "@type": "WebPage", "@id": pageUrl || "" } 
        };
        
        const generalName = entities.find(e => e.schemaProp === 'name');
        if (generalName) schema.name = generalName.value;

        const mainImage = entities.find(e => e.schemaProp === 'image');
        if (mainImage) schema.image = mainImage.value;
        
        const mainDesc = entities.find(e => e.schemaProp === 'description');
        if (mainDesc) schema.description = mainDesc.value;

        const populationMap = { 
            'Article': populateArticleProperties, 
            'Product': populateProductProperties,
            'Review': populateReviewProperties,
            'Recipe': populateRecipeProperties, 
            'HowTo': populateHowToProperties, 
            'FAQPage': populateFaqProperties, 
            'Event': populateEventProperties, 
            'Organization': populateOrganizationProperties,
            'BreadcrumbList': populateBreadcrumbProperties
        };
        if(populationMap[primaryType]) {
            populationMap[primaryType](schema, entities, true);
        }

        const nestedSchemas = [];
        const processedNestedTypes = new Set();
        
        if(primaryType === 'Recipe' && entities.some(e => e.type === 'HowTo')) {
            processedNestedTypes.add('HowTo');
        }
        
        if(primaryType === 'Review' && entities.some(e => e.type === 'Product')) {
            processedNestedTypes.add('Product');
        }

        entities.forEach(entity => {
            if (!entity.type) return;
            
            let schemaType = entity.type;
            if (schemaType === 'FAQ') schemaType = 'FAQPage';
            if (schemaType === 'Breadcrumb') schemaType = 'BreadcrumbList';


            if(primaryType === 'Product' && (schemaType === 'Recipe' || schemaType === 'HowTo' || schemaType === 'Review')) {
                return; 
            }
            
            if (schemaType !== primaryType && !['Article', 'Event', 'Organization'].includes(schemaType) && !processedNestedTypes.has(schemaType)) {
                const fragment = buildSchemaFragment(schemaType, entities);
                if (fragment) nestedSchemas.push(fragment);
                processedNestedTypes.add(schemaType);
            }
        });

        if(nestedSchemas.length > 0) schema.hasPart = nestedSchemas;
        
        if(primaryType === 'BreadcrumbList'){
            delete schema.mainEntityOfPage;
        }

        return schema;
    }
    
    function buildSchemaFragment(type, entities) {
        const fragment = { "@type": type };
        const mainImage = entities.find(e => e.schemaProp === 'image');
        if (mainImage) fragment.image = mainImage.value;
        
        const mainDesc = entities.find(e => e.schemaProp === 'description');
        if (mainDesc) fragment.description = mainDesc.value;
        
        const populationMap = { 
            'Product': populateProductProperties, 
            'Recipe': populateRecipeProperties,
            'Review': populateReviewProperties,
            'HowTo': populateHowToProperties, 
            'FAQPage': populateFaqProperties,
            'Event': populateEventProperties, 
            'Organization': populateOrganizationProperties,
            'BreadcrumbList': populateBreadcrumbProperties 
        };
        if(populationMap[type]) {
            populationMap[type](fragment, entities, false);
        }
        
        return Object.keys(fragment).length > (type === 'BreadcrumbList' ? 1 : 2) ? fragment : null;
    }
    
    function populateBreadcrumbProperties(schema, entities) {
        const breadcrumbEntity = entities.find(e => e.type === 'Breadcrumb');
        if(breadcrumbEntity && breadcrumbEntity.rawValue) {
            schema.itemListElement = breadcrumbEntity.rawValue.map((item, index) => {
                const listItem = {
                    "@type": "ListItem",
                    "position": index + 1,
                    "name": item.name
                };
                if (item.url) {
                    listItem.item = item.url;
                }
                return listItem;
            });
        }
    }


    /**
 * Creates a complete publisher/organization object, prioritizing data from the EMP.
 * This is the single source of truth for all core organization data.
 * @param {Array} entities - The array of all discovered entities.
 * @returns {Object|null} A complete organization object or null if no valid name is found.
 */
function getPublisherData(entities) {
    const empIsAvailable = typeof getEntity !== 'undefined';
    const orgData = {
        "@type": "Organization"
    };

    // 1. Handle Core Properties (Name, Logo, Telephone) with EMP as priority
    const empName = empIsAvailable ? getEntity('organizationName') : null;
    const empLogo = empIsAvailable ? getEntity('logo') : null;
    const empTelephone = empIsAvailable ? getEntity('telephone') : null;

    // Set Name (Priority: EMP -> Page -> Abort)
    if (empName) {
        orgData.name = empName;
    } else {
        const orgNameEntity = entities.find(e => e.type === 'Organization' && e.schemaProp === 'name');
        if (orgNameEntity) {
            orgData.name = orgNameEntity.value;
        } else {
            return null; // An Organization without a name is invalid.
        }
    }
    
    // Set Logo (Priority: EMP -> Page)
    if (empLogo) {
        orgData.logo = { "@type": "ImageObject", "url": empLogo };
    } else {
        const logoEntity = entities.find(e => e.type === 'Organization' && e.schemaProp === 'logo');
        if (logoEntity) {
            orgData.logo = { "@type": "ImageObject", "url": logoEntity.value };
        }
    }
    
    // Set Contact Point (Telephone) (Priority: EMP -> Page)
    if (empTelephone) {
        orgData.contactPoint = { "@type": "ContactPoint", "telephone": empTelephone, "contactType": "customer service" };
    } else {
        const telephoneEntity = entities.find(e => e.type === 'Organization' && e.schemaProp === 'telephone');
        if (telephoneEntity) {
            orgData.contactPoint = { "@type": "ContactPoint", "telephone": telephoneEntity.value, "contactType": "customer service" };
        }
    }

    // 2. Handle Custom Properties (additionalProperty) from EMP
    if (empIsAvailable) {
        const savedEmpData = JSON.parse(localStorage.getItem('schemaArchitect_emp') || '{}');
        const additionalProperties = [];
        const predefinedKeys = ['organizationName', 'logo', 'telephone', 'mainAuthor'];

        for (const key in savedEmpData) {
            if (!predefinedKeys.includes(key)) {
                additionalProperties.push({
                    "@type": "PropertyValue",
                    "name": key,
                    "value": savedEmpData[key]
                });
            }
        }

        if (additionalProperties.length > 0) {
            orgData.additionalProperty = additionalProperties;
        }
    }

    return orgData;
}
   
    function populateArticleProperties(schema, entities) {
    const empAuthor = typeof getEntity !== 'undefined' ? getEntity('mainAuthor') : null;
    
    // Handle Author with EMP as priority
    if (empAuthor) {
        schema.author = { "@type": "Person", "name": empAuthor };
        // If author is from EMP, still get date from page
        const dateEntity = entities.find(e => e.type === 'Article' && e.schemaProp === 'datePublished');
        if (dateEntity) schema.datePublished = dateEntity.rawValue || dateEntity.value;
    } else {
        // Fallback to on-page data
        const authorEntity = entities.find(e => e.type === 'Article' && e.schemaProp === 'author');
        if (authorEntity) schema.author = { "@type": "Person", "name": authorEntity.value };
        const dateEntity = entities.find(e => e.type === 'Article' && e.schemaProp === 'datePublished');
        if (dateEntity) schema.datePublished = dateEntity.rawValue || dateEntity.value;
    }

    if (!schema.headline && schema.name) schema.headline = schema.name;

    // **CRITICAL INTEGRATION POINT**
    const publisherData = getPublisherData(entities);
    if (publisherData) {
        schema.publisher = publisherData;
    }
}
    
    function populateFaqProperties(schema, entities, isPrimary) {
        const faqEntity = entities.find(e => e.type === 'FAQ');
        if(faqEntity) {
            if(isPrimary && faqEntity.contextualName) {
                schema.name = faqEntity.contextualName;
            } else if (faqEntity.contextualName) {
                schema.name = faqEntity.contextualName;
            }
            schema.mainEntity = faqEntity.rawValue.map(item => ({ 
                "@type": "Question", 
                "name": item.q, 
                "acceptedAnswer": { "@type": "Answer", "text": item.a } 
            }));
        }
    }

    function populateProductProperties(schema, entities, isPrimary) {
        const offer = { "@type": "Offer", "availability": "https://schema.org/InStock" };
        const productEntities = entities.filter(e => e.type === 'Product');
        
        const contextualNameEntity = productEntities.find(e => e.schemaProp === 'contextualName');
        if (contextualNameEntity) {
            schema.name = contextualNameEntity.value;
        }
        
        productEntities.forEach(e => {
            if (e.schemaProp === 'price') offer.price = e.value;
            if (e.schemaProp === 'priceCurrency') offer.priceCurrency = e.value;
            if (e.schemaProp === 'sku') schema.sku = e.value.split(':').pop().trim();
            if (e.schemaProp === 'brand') schema.brand = { "@type": "Brand", "name": e.value };
        });
        
        if (offer.price) {
            if (!offer.priceCurrency) offer.priceCurrency = "USD";
            schema.offers = offer;
        }
    }

    function populateReviewProperties(schema, entities, isPrimary) {
    const reviewEntities = entities.filter(e => e.type === 'Review');
    const dateEntity = entities.find(e => e.type === 'Article' && e.schemaProp === 'datePublished');

    const empAuthor = typeof getEntity !== 'undefined' ? getEntity('mainAuthor') : null;
    if (empAuthor) {
        schema.author = { "@type": "Person", "name": empAuthor };
    } else {
        const authorEntity = entities.find(e => e.type === 'Article' && e.schemaProp === 'author');
        if (authorEntity) schema.author = { "@type": "Person", "name": authorEntity.value };
    }
    
    if(dateEntity) schema.datePublished = dateEntity.rawValue || dateEntity.value;
    
    // **CRITICAL INTEGRATION POINT**
    const publisherData = getPublisherData(entities);
    if (publisherData) {
        schema.publisher = publisherData;
    }

    const ratingEntity = reviewEntities.find(e => e.schemaProp === 'reviewRating');
    if(ratingEntity) {
        schema.reviewRating = {
            "@type": "Rating",
            "ratingValue": ratingEntity.value,
            "bestRating": "5" 
        };
    }
    
    const itemReviewed = {"@type": "Thing"};
    const itemNameEntity = reviewEntities.find(e => e.schemaProp === 'itemName');
    
    const productContextualName = entities.find(e => e.type === 'Product' && e.schemaProp === 'contextualName');
    if (itemNameEntity) {
        itemReviewed.name = itemNameEntity.value;
    } else if (productContextualName) {
        itemReviewed.name = productContextualName.value;
    } else {
         const generalNameEntity = entities.find(e => e.schemaProp === 'name');
         if(generalNameEntity) itemReviewed.name = generalNameEntity.value;
    }

    const productEntities = entities.filter(e => e.type === 'Product');
    if (productEntities.length > 0) {
        itemReviewed["@type"] = "Product";
        const imageEntity = entities.find(e => e.schemaProp === 'image');
        if(imageEntity) itemReviewed.image = imageEntity.value;
        populateProductProperties(itemReviewed, productEntities, false); 
    }
    
    if(itemReviewed.name) {
        schema.itemReviewed = itemReviewed;
    }
}

    function populateRecipeProperties(schema, entities, isPrimary) {
        const recipeEntities = entities.filter(e => e.type === 'Recipe');
        
        const contextualImage = recipeEntities.find(e => e.schemaProp === 'image');
        if (contextualImage) {
            schema.image = contextualImage.value;
        } else if (isPrimary) {
            const mainImage = entities.find(e => e.schemaProp === 'image' && !e.type);
            if(mainImage) schema.image = mainImage.value;
        }
    
        const contextualNameEntity = recipeEntities.find(e => e.contextualName);
        if (contextualNameEntity) {
            schema.name = contextualNameEntity.contextualName;
        }
        
        recipeEntities.forEach(e => {
            if (['prepTime', 'cookTime', 'recipeIngredient', 'recipeInstructions'].includes(e.schemaProp)) {
                if(e.rawValue) {
                    schema[e.schemaProp] = e.rawValue;
                }
            } else if (e.schemaProp !== 'contextualName' && e.schemaProp !== 'image') {
                schema[e.schemaProp] = e.rawValue || e.value;
            }
        });
    }

    function populateHowToProperties(schema, entities, isPrimary) {
        const howToEntities = entities.filter(e => e.type === 'HowTo');
    
        // **NEW LOGIC: Prioritize contextual image**
        const contextualImage = howToEntities.find(e => e.schemaProp === 'image');
        if (contextualImage) {
            schema.image = contextualImage.value;
        } else if (isPrimary) {
            // Fallback to global image only if it's the main entity
            const mainImage = entities.find(e => e.schemaProp === 'image' && !e.type);
            if(mainImage) schema.image = mainImage.value;
        }
    
        const howToEntity = howToEntities.find(e => e.type === 'HowTo' && e.schemaProp === 'step');
        if (howToEntity) {
             if (howToEntity.contextualName) {
                schema.name = howToEntity.contextualName;
            }
            schema.step = howToEntity.rawValue;
        }
    }
    
    function populateEventProperties(schema, entities, isPrimary) {
        const eventEntities = entities.filter(e => e.type === 'Event');
        
        const contextualNameEntity = eventEntities.find(e => e.schemaProp === 'contextualName');
        if (contextualNameEntity) {
            schema.name = contextualNameEntity.value;
        }

        eventEntities.forEach(e => {
            if (e.schemaProp === 'startDate') {
                try {
                    schema.startDate = new Date(e.value).toISOString();
                } catch(err) {
                    schema.startDate = e.value;
                }
            } else if (e.schemaProp === 'location') {
                schema.location = { "@type": "Place", "name": e.value, "address": e.value };
            } else if (e.schemaProp === 'organizer') {
                schema.organizer = { "@type": "Organization", "name": e.value };
            }
        });

        if (!schema.name) {
            const pageTitle = entities.find(e => e.schemaProp === 'name');
            if(pageTitle) schema.name = pageTitle.value;
        }
    }

    function populateOrganizationProperties(schema, entities, isPrimary) {
    const orgData = getPublisherData(entities);
    if (orgData) {
        // Merge all centrally-managed data (name, logo, telephone, custom props)
        Object.assign(schema, orgData);
    }

    // Add properties ONLY relevant when Organization is the PRIMARY type
    if (isPrimary) {
        // Ensure name is set, even if EMP is empty, using page title as last resort
        if (!schema.name) {
             const pageTitle = entities.find(e => e.schemaProp === 'name');
             if (pageTitle) schema.name = pageTitle.value;
        }
        const pageUrl = DOM.urlInput.value.trim();
        if(pageUrl) schema.url = pageUrl;
    }
    
    // Add contextual properties that are NOT part of the core brand identity (EMP)
    // and therefore not handled by getPublisherData.
    const addressEntity = entities.find(e => e.type === 'Organization' && e.schemaProp === 'address');
    if(addressEntity) {
        schema.address = { "@type": "PostalAddress", "streetAddress": addressEntity.value };
    }
    
    const mainDesc = entities.find(e => e.schemaProp === 'description');
    if (mainDesc && !schema.description) {
        schema.description = mainDesc.value;
    }
}


    // ===================================================================
    //  4. UI Rendering & State Management
    // ===================================================================
    
    function renderAnalysis(entities, suggestions) {
        let html = `<h3 class="h5 mb-3">1. الكيانات المكتشفة:</h3>`;
        if (entities.length === 0) {
            html += `<p class="text-muted small">لم يتم اكتشاف كيانات واضحة.</p>`;
        } else {
            entities.forEach(entity => {
                let badgeColor = 'bg-secondary';
                if (entity.type === 'Article') badgeColor = 'bg-info text-dark';
                if (entity.type === 'FAQ') badgeColor = 'bg-warning text-dark';
                if (entity.type === 'Product') badgeColor = 'bg-success';
                if (entity.type === 'Review') badgeColor = 'bg-warning';
                if (entity.type === 'Recipe') badgeColor = 'bg-danger';
                if (entity.type === 'HowTo') badgeColor = 'bg-primary';
                if (entity.type === 'Event') badgeColor = 'bg-info-subtle text-info-emphasis border border-info-subtle';
                if (entity.type === 'Organization') badgeColor = 'bg-dark';
                if (entity.type === 'Breadcrumb') badgeColor = 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
                
                html += `
                    <div class="card p-3 mb-2 entity-card">
                        <div class="d-flex justify-content-between align-items-center">
                            <strong class="text-primary-emphasis">${entity.name}</strong>
                            ${entity.type ? `<span class="badge ${badgeColor}">${entity.type}</span>` : ''}
                        </div>
                        <p class="mb-0 mt-2 text-muted text-truncate" title="${entity.value}">${entity.value}</p>
                    </div>`;
            });
        }
        html += `<h3 class="h5 mt-4 mb-3">2. أنواع السكيما المقترحة:</h3>`;
        suggestions.forEach((suggestion, index) => {
            const confidencePercent = Math.round(suggestion.confidence * 100);
            html += `
                <div class="p-3 mb-2 border rounded schema-suggestion" data-schema-type="${suggestion.type}"
                     role="button" tabindex="0" aria-pressed="${index === 0 ? 'true' : 'false'}">
                    <strong>${suggestion.type}</strong>
                    <div class="progress mt-2" style="height: 5px;">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${confidencePercent}%;"
                             aria-label="مستوى الثقة في اقتراح ${suggestion.type}" 
                             aria-valuenow="${confidencePercent}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <div class="schema-explanation mt-2 p-2 small border-top">
                        <strong>لماذا؟</strong> ${suggestion.reason}
                    </div>
                </div>`;
        });
        return html;
    }

    function updateActionButtonsState(isEnabled, copyText = 'نسخ') {
        const buttons = [DOM.copyBtn, DOM.downloadBtn, DOM.validateBtn];
        buttons.forEach(btn => {
            btn.disabled = !isEnabled;
            btn.classList.toggle('disabled', !isEnabled);
        });
        DOM.copyBtn.innerHTML = (copyText === 'نسخ') ? `<i class="bi bi-clipboard-check ms-1"></i> نسخ` : copyText;
    }

    function renderSgePreview(schema) {
        let previewHtml = '';
        const type = schema['@type'];
        switch (type) {
            case 'BreadcrumbList':
                if (schema.itemListElement && schema.itemListElement.length > 0) {
                    previewHtml = `
                        <nav aria-label="breadcrumb">
                          <ol class="breadcrumb" style="font-size: 0.9rem;">
                            ${schema.itemListElement.map((item, index) => {
                                const isLast = index === schema.itemListElement.length - 1;
                                return `<li class="breadcrumb-item ${isLast ? 'active" aria-current="page' : ''}">
                                            ${item.item && !isLast ? `<a href="#" onclick="return false;">${item.name}</a>` : item.name}
                                        </li>`;
                            }).join('')}
                          </ol>
                        </nav>`;
                }
                break;
            case 'Product':
                previewHtml = `
                    <div class="card">
                        <div class="card-body">
                            ${schema.image ? `<img src="${schema.image}" alt="صورة ${schema.name || 'المنتج'}" width="100" height="100" class="img-fluid rounded float-start me-3" style="max-width: 100px; height: auto; object-fit: cover;">` : ''}
                            <h4 class="card-title">${schema.name || ''}</h4>
                            <p class="card-text">
                                ${schema.offers ? `<strong class="text-high-contrast-success">${schema.offers.price} ${schema.offers.priceCurrency}</strong>` : ''}
                                ${schema.brand ? `<span class="text-muted d-block">بواسطة: ${schema.brand.name}</span>` : ''}
                            </p>
                        </div>
                    </div>`;
                break;
            case 'Review':
                const rating = schema.reviewRating?.ratingValue;
                const item = schema.itemReviewed?.name;
                let starsHtml = '';
                if(rating){
                    const filledStars = Math.round(parseFloat(rating));
                    for(let i=0; i < 5; i++){
                        starsHtml += `<i class="bi ${i < filledStars ? 'bi-star-fill text-warning' : 'bi-star'}"></i>`;
                    }
                }
                 previewHtml = `
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title">${item ? `مراجعة لـ: ${item}` : (schema.name || 'مراجعة')}</h4>
                            ${rating ? `
                            <p class="card-text mb-1" title="التقييم: ${rating} من 5">
                                ${starsHtml}
                                <span class="ms-2 fw-bold">${rating} / 5</span>
                            </p>` : ''}
                            ${schema.author ? `<span class="text-muted d-block small">بواسطة: ${schema.author.name}</span>` : ''}
                        </div>
                    </div>`;
                break;
            case 'Recipe':
                 let prep = schema.prepTime ? String(schema.prepTime).replace('PT','').replace('H', ' ساعة ').replace('M',' دقيقة') : '';
                 let cook = schema.cookTime ? String(schema.cookTime).replace('PT','').replace('H', ' ساعة ').replace('M',' دقيقة') : '';
                 previewHtml = `
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title">${schema.name || ''}</h4>
                            <p class="card-text small text-muted">
                                ${prep ? `وقت التحضير: ${prep}` : ''}
                                ${cook ? ` | وقت الطهي: ${cook}` : ''}
                            </p>
                            <h5 class="h6 small fw-bold">أبرز المكونات:</h5>
                            <ul class="list-group list-group-flush small">
                                ${schema.recipeIngredient?.slice(0, 3).map(i => `<li class="list-group-item p-1">${i}</li>`).join('') || ''}
                            </ul>
                        </div>
                    </div>`;
                break;
            case 'FAQPage':
                previewHtml = `
                    <div class="accordion accordion-flush" id="sgeFaqAccordion">
                    ${schema.mainEntity?.slice(0, 2).map((item, index) => `
                        <div class="accordion-item">
                            <h2 class="accordion-header">
                                <button class="accordion-button collapsed small" type="button" data-bs-toggle="collapse" data-bs-target="#sge-faq-${index}">
                                    ${item.name}
                                </button>
                            </h2>
                            <div id="sge-faq-${index}" class="accordion-collapse collapse" data-bs-parent="#sgeFaqAccordion">
                                <div class="accordion-body small">${item.acceptedAnswer.text}</div>
                            </div>
                        </div>`).join('') || ''}
                    </div>`;
                break;
             case 'HowTo':
                previewHtml = `
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title">${schema.name || ''}</h4>
                             <ol class="list-group list-group-numbered list-group-flush small">
                                ${schema.step?.slice(0, 3).map(s => `<li class="list-group-item p-1">${s.text}</li>`).join('') || ''}
                            </ol>
                        </div>
                    </div>`;
                break;
            case 'Event':
                let eventDate = '';
                if(schema.startDate) {
                    try {
                        eventDate = new Date(schema.startDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    } catch(e) { eventDate = schema.startDate; }
                }
                previewHtml = `
                    <div class="card">
                        <div class="card-body">
                            <h4 class="card-title"><i class="bi bi-calendar-event ms-2"></i>${schema.name || ''}</h4>
                            <p class="card-text small">
                                ${eventDate ? `<span class="d-block"><strong>التاريخ:</strong> ${eventDate}</span>` : ''}
                                ${schema.location ? `<span class="d-block"><strong>المكان:</strong> ${schema.location.name}</span>` : ''}
                                ${schema.organizer ? `<span class="d-block text-muted">المنظم: ${schema.organizer.name}</span>` : ''}
                            </p>
                        </div>
                    </div>`;
                break;
            case 'Organization':
                 previewHtml = `
                   <div class="card">
                        <div class="card-body d-flex align-items-center">
                            ${schema.logo ? `<img src="${schema.logo.url || schema.logo}" alt="شعار ${schema.name || 'المنظمة'}" width="60" height="60" class="rounded-circle ms-3" style="width: 60px; height: 60px; object-fit: contain; border: 1px solid var(--bs-border-color);">` : `<div class="rounded-circle ms-3 bg-secondary-subtle d-flex align-items-center justify-content-center" style="width: 60px; height: 60px; flex-shrink: 0;"><i class="bi bi-building fs-4 text-muted"></i></div>`}
                            <div class="flex-grow-1">
                                <h4 class="card-title mb-0">${schema.name || ''}</h4>
                                ${schema.address ? `<p class="card-text small text-muted mb-0">${schema.address.streetAddress}</p>` : ''}
                            </div>
                        </div>
                    </div>`;
                break;
            default:
                previewHtml = '<p class="text-muted small">لا توجد معاينة متاحة لهذا النوع من السكيما.</p>';
        }
        DOM.sgePreviewContent.innerHTML = previewHtml;
        DOM.sgePreviewContainer.style.display = previewHtml.trim() ? 'block' : 'none';
    }


    // ===================================================================
    //  5. Main Logic Flow & Event Listeners
    // ===================================================================
    
    async function handleAnalysis() {
        let url = DOM.urlInput.value.trim();
        const html = DOM.htmlContentInput.value.trim();
        if (!url && !html) { 
            showToast("يرجى إدخال رابط أو لصق كود HTML للبدء.", 'warning'); 
            return; 
        }
        if (url && !/^https?:\/\//i.test(url)) { 
            url = 'https://' + url; 
            DOM.urlInput.value = url; 
        }
        
        DOM.analysisResults.innerHTML = `<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">جاري التحليل...</span></div><p class="mt-2">جاري فك شفرة المحتوى...</p></div>`;
        DOM.generatedCode.value = '';
        DOM.sgePreviewContainer.style.display = 'none';
        updateActionButtonsState(false);
        DOM.copyEnhancedPromptBtn.disabled = true;
        selectedPrimaryType = null;

        try {
            let contentToAnalyze = html;
            if (!contentToAnalyze && url) {
                contentToAnalyze = await fetchContent(url);
            }
            
            // Use the main URL input, or the new base URL input if that one is empty
            const baseUrl = DOM.urlInput.value.trim() || DOM.baseUrlInput.value.trim();
            const entities = analyzeContent(contentToAnalyze, baseUrl);
            const suggestions = suggestSchema(entities);
            const analysisHtml = renderAnalysis(entities, suggestions);
            const existingSchemaHtml = displayExistingSchema(contentToAnalyze);
            DOM.analysisResults.innerHTML = analysisHtml + existingSchemaHtml;

            const updateSchemaOutput = (type) => {
                const finalSchema = generateFinalSchema(entities, type, baseUrl); // Pass baseUrl to generator
                DOM.generatedCode.value = JSON.stringify(finalSchema, null, 2);
                renderSgePreview(finalSchema);
            };

            if (suggestions.length > 0) {
                const bestType = suggestions[0].type;
                selectedPrimaryType = bestType;
                DOM.copyEnhancedPromptBtn.disabled = false;
                updateSchemaOutput(bestType);
                updateActionButtonsState(true);
                const bestSuggestionEl = document.querySelector(`.schema-suggestion[data-schema-type="${bestType}"]`);
                if (bestSuggestionEl) bestSuggestionEl.classList.add('border-primary', 'border-2');
            }

            document.querySelectorAll('.schema-suggestion').forEach(el => {
                const selectAction = () => {
                    document.querySelectorAll('.schema-suggestion').forEach(s => {
                        s.classList.remove('border-primary', 'border-2');
                        s.setAttribute('aria-pressed', 'false');
                    });
                    el.classList.add('border-primary', 'border-2');
                    el.setAttribute('aria-pressed', 'true');
                    
                    const schemaType = el.dataset.schemaType;
                    selectedPrimaryType = schemaType;
                    DOM.copyEnhancedPromptBtn.disabled = false;
                    updateSchemaOutput(schemaType);
                };
                
                el.addEventListener('click', selectAction);
                el.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectAction();
                    }
                });
            });

        } catch (error) {
            showToast(error.message, 'danger');
            updateActionButtonsState(false); 
        }
    }
    async function fetchContent(url) {
        const PROXIES = [ 
            `https://throbbing-dew-da3c.amr-omar304.workers.dev/?url={url}`, 
            `https://api.allorigins.win/raw?url={url}` 
        ];
        for (const proxyTemplate of PROXIES) {
            try {
                const proxyUrl = proxyTemplate.replace('{url}', encodeURIComponent(url));
                const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
                if (response.ok) return await response.text();
            } catch (error) { 
                console.warn(`Proxy failed: ${proxyTemplate.split('?')[0]}. Trying next...`, error); 
            }
        }
        throw new Error(`فشل في جلب المحتوى. تأكد من اتصالك بالإنترنت أو أن البروكسي يعمل.`);
    }

    DOM.analyzeBtn.addEventListener('click', handleAnalysis);
    
    DOM.copyBtn.addEventListener('click', () => {
        if (!DOM.copyBtn.disabled && DOM.generatedCode.value) {
            navigator.clipboard.writeText(DOM.generatedCode.value)
                .then(() => {
                    updateActionButtonsState(true, `<i class="bi bi-check-lg me-1"></i> تم النسخ!`);
                    setTimeout(() => updateActionButtonsState(true), 2000);
                })
                .catch(err => { 
                    console.error('Failed to copy text: ', err); 
                    showToast('فشل النسخ إلى الحافظة.', 'danger'); 
                });
        }
    });

    DOM.downloadBtn.addEventListener('click', () => {
        if (!DOM.downloadBtn.disabled && DOM.generatedCode.value) {
            const blob = new Blob([DOM.generatedCode.value], { type: 'application/ld+json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'schema.jsonld';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

    DOM.validateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!DOM.validateBtn.disabled && DOM.generatedCode.value) {
            navigator.clipboard.writeText(DOM.generatedCode.value)
                .then(() => {
                    window.open('https://search.google.com/test/rich-results', '_blank');
                })
                .catch(err => {
                    console.error('Could not copy code: ', err);
                    showToast('فشل نسخ الكود إلى الحافظة. يرجى نسخه يدويًا.', 'danger');
                });
        }
    });

    DOM.copyEnhancedPromptBtn.addEventListener('click', () => {
        if (DOM.copyEnhancedPromptBtn.disabled || !selectedPrimaryType) {
            return;
        }

        if (typeof DynamicPromptGenerator !== 'undefined') {
            const promptToCopy = DynamicPromptGenerator.generate(selectedPrimaryType);

            if (promptToCopy) {
                navigator.clipboard.writeText(promptToCopy)
                    .then(() => {
                        DOM.copyEnhancedPromptBtn.innerHTML = '<i class="bi bi-check-lg ms-2"></i> تم النسخ بنجاح!';
                        DOM.copyEnhancedPromptBtn.classList.remove('btn-warning');
                        DOM.copyEnhancedPromptBtn.classList.add('btn-success');
                        
                        setTimeout(() => {
                            DOM.copyEnhancedPromptBtn.innerHTML = '<i class="bi bi-robot ms-2"></i> نسخ برومبت التحسين الكامل';
                            DOM.copyEnhancedPromptBtn.classList.remove('btn-success');
                            DOM.copyEnhancedPromptBtn.classList.add('btn-warning');
                        }, 2500);
                    })
                    .catch(err => {
                        console.error('فشل في نسخ البرومبت: ', err);
                        showToast('عذرًا، فشلت عملية النسخ.', 'danger');
                    });
            }
        } else {
            console.error('خطأ: وحدة `DynamicPromptGenerator` غير معرفة.');
            showToast('حدث خطأ في تحميل مكونات الصفحة.', 'danger');
        }
    });

    if (typeof initializeProjectHub !== 'undefined') initializeProjectHub();
    if (typeof initializeEmp !== 'undefined') initializeEmp();

})();
