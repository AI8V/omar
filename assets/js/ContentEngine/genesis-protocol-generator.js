'use strict';

/**
 * @file genesis-protocol-generator.js
 * @description وحدة مستقلة لتوليد برومبت "Genesis Protocol" ديناميكيًا.
 * @version 2.0.0
 */
const GenesisProtocolGenerator = (function () {

    // 1. القوالب الثابتة (البروتوكولات)
    const MAESTRO_GENESIS_TEMPLATE = `GENESIS PROTOCOL

TO: Large Language Model (LLM) - designated as "The Architect"
FROM: The Maestro (via AI Tech Lead & Chief Strategist)
SUBJECT:  - Architect a definitive HTML <main> component by synthesizing superior UX/UI design patterns with Ai8V Schema Architect compliant class hooks.

🔥 MANDATE 
You will operate as a UX & Schema Architect. Your mission is to execute the blueprints below to construct an HTML section that is simultaneously beautiful and 100% compatible with our internal analysis tool, "Schema Architect".
CRITICAL DIRECTIVE: You will NOT use \`itemscope\`, \`itemtype\`, or \`itemprop\` attributes. The entire semantic layer will be handled by our tool. Your sole responsibility is to build the visual structure and embed the specific CSS class names that our tool is programmed to detect.

📥 [INPUT BLOCK: PROVIDE CONTENT HERE]
INSTRUCTIONS: To execute, copy this entire protocol and fill in the placeholders below.

     [PRIMARY INPUT - THE_SOUL]:
---
{{THE_SOUL}}
---
   
     [SECONDARY INPUT - ASSET_MANIFEST]:
---
{{ASSET_MANIFEST}}
---
   
     [TERTIARY INPUT - THE_ENVIRONMENT]:
---
(Read-only context. Do not change. This informs you that the final page already has Bootstrap loaded.)
- bootstrap.min.css
- bootstrap.min.js
---

[QUINARY INPUT - TEMPLATE_DNA]:
---
{{TEMPLATE_DNA}}
---
   
--- END OF INPUT BLOCK ---

Phase 1: Holistic Analysis & Architectural Planning

**PRIMARY DIRECTIVE: Your goal is to function as a "Faithful Enhancer". You must preserve 100% of the original content from `THE_SOUL` while intelligently enriching it. DO NOT SUMMARIZE OR OMIT ANY ORIGINAL PARAGRAPHS.**

1.  **Foundational Analysis (Internal Thought Process):**
    *   First, fully understand the text in `THE_SOUL`, the available components in `TEMPLATE_DNA`, and the assets in `ASSET_MANIFEST`.
    *   Mentally identify a reasonable number of logical opportunities (typically 2-5, depending on the article's length) to add value, such as expanding a section, adding a practical list, or creating a new relevant subsection.

2.  **Content Synthesis & Structural Mapping:**
    *   **Synthesize the final content:** Begin with the original `THE_SOUL` text as your base and seamlessly integrate your value-add expansions. The final output must be a single, cohesive, and expanded article.
    *   **Content & Asset Integration:** Analyze the final synthesized content and map its chunks to the most effective Bootstrap components from the blueprints. As you do this, place the images from `ASSET_MANIFEST` in the most logical positions within the newly expanded content.

3.  **Interactive Layer Construction:**
    *   **Architect the Interactive Systems:** Based on the final, expanded structure, your next step is to build the interactive layer. This includes:
        a.  **Dynamic Scrollspy System:** Architect the mandatory Bootstrap Scrollspy system and its corresponding navigational hub (`<nav>`), ensuring all sections (original and new) are included.
        b.  **Internal Anchor Text Reinforcement (CRITICAL):**
            i.  **Detect:** Scan the complete, synthesized text to identify between 2 and 4 of the most critical anchor phrases that reference internal sections.
            ii. **Enhance with Precision:** For each detected phrase, you must replace the standard text or links with a fully interactive anchor tag. This tag **MUST** adhere to the following strict specifications:
                -   Include `aria-controls` and `aria-expanded="false"` for accessibility.
                -   Trigger `.show` on collapse targets where applicable.
                -   Use Bootstrap utility classes: `fw-bold`, `text-primary`, and `scroll-link`.
                -   Optionally support `data-scroll-target` for smooth navigation integration.
            iii. **Ensure Functionality:** You must guarantee that all enhanced anchors are fully functional within both the Scrollspy and Collapse components, without causing layout shifts or interaction glitches.

🏗️ Phase 2: Architectural Blueprints (The Art of Construction)
{{BLUEPRINTS}}

🧩 Phase 3: Final Polish & Constraints
{{CONSTRAINTS}}

✅ END PROTOCOL`;
    

    const BLUEPRINTS_BLOCK = `(Blueprint 1: 📦 Article / Product Review Hero
(A versatile component for the main subject of the page.)
<section id="article-hero" class="mb-5">
    <div class="card shadow-sm">
        <!-- START: The Definitive Ai8V Implementation for LCP Image -->
        <figure class="figure mb-0">
          <picture>
            <source 
                type="image/webp"
                srcset="
                    .../hero-image-400.webp 400w,
                    .../hero-image-820.webp 820w,
                    .../hero-image-1200.webp 1200w
                "
                sizes="(max-width: 991px) 100vw, 83vw"
            >
            <img 
                class="card-img-top img-fluid d-block"
                src=".../hero-image-820.jpg" 
                srcset="
                    .../hero-image-400.jpg 400w,
                    .../hero-image-820.jpg 820w,
                    .../hero-image-1200.jpg 1200w
                "
                sizes="(max-width: 991px) 100vw, 83vw"
                width="820"
                height="400"
                loading="eager"
                fetchpriority="high"
                decoding="async"
                alt="..."
            >
          </picture>
          <figcaption class="figure-caption visually-hidden">...</figcaption>
        </figure>
        <div class="card-body p-4">
            <article aria-labelledby="main-heading">
                <!-- Our tool finds H1 for the name -->
                <h1 id="main-heading" class="card-title h2 mb-3">... Main Title ...</h1>
                <!-- Our tool finds this class for the author -->
                <p class="author text-muted">... Author and Date ...</p>
                <p>...</p>
                <!-- For Reviews, include this wrapper -->
                <div class="product-compliance-wrapper mt-4 border-top pt-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <!-- Our tool finds this class for the reviewed item's name -->
                        <div class="reviewed-item-name fw-bold">... Reviewed Item Name ...</div>
                        <!-- Our tool finds this class for the rating value -->
                        <div class="rating-value text-warning">... Stars ...</div>
                    </div>
                </div>
            </article>
        </div>
    </div>
</section>
   
Blueprint 2: 🍞 Breadcrumb Navigation
(A standalone component for navigation.)
<nav aria-label="breadcrumb" class="mb-4">
    <!-- Our tool finds ".breadcrumb li" for items -->
    <ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="#">... Level 1 ...</a></li>
        <li class="breadcrumb-item"><a href="#">... Level 2 ...</a></li>
        <li class="breadcrumb-item active" aria-current="page">... Current Page ...</li>
    </ol>
</nav>
   
Blueprint 3: 🛠️ How-To Guide
(For step-by-step instructions.)
<section id="howto-guide" class="mb-5 howto-guide">
    <div class="card shadow-sm">
        <div class="card-header text-white bg-info">
            <h2 id="howto-heading" class="mb-0 h4">... How-To Section Title ...</h2>
        </div>
        <div class="card-body">
            <figure class="figure d-table mx-auto">
              <picture>
                <source 
                    type="image/webp"
                    srcset="
                        ... image-400.webp 400w,
                        ... image-785.webp 785w
                    "
                    sizes="(max-width: 991px) 100vw, 83vw"
                >
                <img 
                    class="img-fluid rounded shadow-sm"
                    src="... image-785.jpg" 
                    srcset="
                        ... image-400.jpg 400w,
                        ... image-785.jpg 785w
                    "
                    sizes="(max-width: 991px) 100vw, 83vw"
                    width="785"
                    height="400"
                    loading="lazy"
                    decoding="async"
                    alt="..."
                >
              </picture>
              <figcaption class="figure-caption text-center mt-2">
                ...
              </figcaption>
            </figure>
            <div class="instruction-set">
                <div class="d-flex align-items-start mb-4 howto-step">
                    <span class="step-counter h4 me-3">1</span>
                    <div class="flex-grow-1 ms-3">
                        <h3 class="h5 fw-bold">... Step 1 Title ...</h3>
                        <p class="step-text task-description mb-0">... Step 1 Description ...</p>
                    </div>
                </div>
                <!-- ... Repeat for all steps ... -->
            </div>
        </div>
    </div>
</section>
   
Blueprint 4: 🍳 Recipe Card
(For recipes with ingredients and instructions.)
<section id="recipe-card" class="mb-5 recipe-card">
    <div class="card shadow-sm">
        <div class="card-header text-white bg-success">
            <h2 id="recipe-heading" class="mb-0 h4">... Recipe Title ...</h2>
        </div>
        <div class="card-body">
            <figure class="figure d-table mx-auto">
              <picture>
                <source 
                    type="image/webp"
                    srcset=".../recipe-image-400.webp 400w, .../recipe-image-785.webp 785w"
                    sizes="(max-width: 991px) 100vw, 83vw"
                >
                <img 
                    class="img-fluid rounded shadow-sm"
                    src=".../recipe-image-785.jpg" 
                    srcset=".../recipe-image-400.jpg 400w, .../recipe-image-785.jpg 785w"
                    sizes="(max-width: 991px) 100vw, 83vw"
                    width="785"
                    height="400"
                    loading="lazy"
                    decoding="async"
                    alt="..."
                >
              </picture>
              <figcaption class="figure-caption text-center mt-2">...</figcaption>
            </figure>
            <p>...</p>
            <div class="row text-center mb-4">
                <!-- Our tool finds ".prep-time" and ".cook-time" -->
                <div class="col-md-4">...<span class="badge bg-light text-dark ms-2 prep-time">...</span></div>
                <div class="col-md-4">...<span class="badge bg-light text-dark ms-2 cook-time">...</span></div>
            </div>
            <h3 class="h5">المكونات:</h3>
            <!-- Our tool finds ".ingredients li" -->
            <ul class="list-unstyled ingredients">
                <li>... Ingredient 1 ...</li>
            </ul>
            <h3 class="h5 mt-4">التعليمات:</h3>
            <!-- Our tool finds ".recipe-instructions li" -->
            <ol class="list-group list-group-numbered recipe-instructions">
                 <li class="list-group-item">... Instruction 1 ...</li>
            </ol>
        </div>
    </div>
</section>
   
Blueprint 5: ❓ FAQ Section
(For question and answer formats.)
<section id="faq-section" class="mb-5">
    <div class="card shadow-sm">
        <div class="card-header bg-warning">
            <h2 id="faq-heading" class="mb-0 h4">... FAQ Section Title ...</h2>
        </div>
        <div class="card-body p-0">
            <div class="accordion accordion-flush" id="faqAccordion">
                <!-- Our tool finds ".faq-item" for the container -->
                <div class="accordion-item faq-item">
                    <h3 class="accordion-header">
                        <!-- Our tool finds ".accordion-button" for the question -->
                        <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="...">...</button>
                    </h3>
                    <div class="accordion-collapse collapse show" data-bs-parent="#faqAccordion">
                        <!-- Our tool finds ".accordion-body" for the answer -->
                        <div class="accordion-body">...</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

Blueprint 6: 🗓️ Event Card
(For events with dates, locations, and organizers.)
<section id="event-card" class="mb-5">
    <div class="card shadow-sm">
        <div class="card-header text-white bg-primary">
            <h2 id="event-heading" class="mb-0 h4">... Event Title ...</h2>
        </div>
        <div class="card-body">
            <ul class="list-group list-group-flush">
                <!-- Our tool finds ".event-start-date" -->
                <li class="list-group-item"><strong>Date:</strong> <span class="event-start-date">...</span></li>
                <!-- Our tool finds ".location" -->
                <li class="list-group-item"><strong>Location:</strong> <span class="location">...</span></li>
                <!-- Our tool finds ".organizer" -->
                <li class="list-group-item"><strong>Organizer:</strong> <span class="organizer">...</span></li>
            </ul>
        </div>
    </div>
</section>

Blueprint 7: 🏢 Organization Card
(For displaying organization details.)
<section id="organization-card" class="mb-5">
    <div class="card shadow-sm">
        <div class="card-header">
            <h2 id="org-heading" class="mb-0 h4">... Organization Section Title ...</h2>
        </div>
        <div class="card-body">
            <!-- Our tool finds "img" with "logo" in class or alt -->
            <figure class="figure d-table mx-auto">
              <picture>
                 <source 
                    type="image/webp"
                    srcset=".../logo-150.webp 150w, .../logo-300.webp 300w"
                    sizes="150px"
                >
                <img 
                    class="img-fluid org-logo"
                    src=".../logo-300.png"
                    srcset=".../logo-150.png 150w, .../logo-300.png 300w"
                    sizes="150px"
                    width="250"
                    height="150"
                    loading="lazy"
                    decoding="async"
                    alt="Company Logo"
                >
              </picture>
            </figure>
            <!-- Our tool finds ".address" -->
            <p class="address mt-3">... Full Address ...</p>
            <!-- Our tool finds "a[href^='tel:']" -->
            <p><strong>Phone:</strong> <a href="tel:...">... Phone Number ...</a></p>
        </div>
    </div>
</section>

Blueprint 8: 🎯 Final Call to Action (CTA)
(A non-schema, structural component for concluding the page.)
<section id="final-cta">
    <div class="card border-primary text-center border-2 shadow-sm">
        <div class="card-body p-5">
            <h2 class="card-title h3">... CTA Title ...</h2>
            <p class="lead card-text">... CTA Description ...</p>
            <a class="btn btn-primary btn-lg mt-3" role="button" href="#">... Button Text ...</a>
        </div>
    </div>
</section>)`; 
    const CONSTRAINTS_BLOCK = `(Purity:
 No itemscope, itemtype, or itemprop attributes are permitted. Also, no <link>, <script>, or <style> tags are allowed in the final output.
Compatibility:
 The specified class names (e.g., howto-step, prep-time, faq-item, rating-value, accordion-body) are MANDATORY for compatibility with the Schema Architect tool.
Performance:
All visual content must be embedded inside semantic <figure> wrappers and structured using the <picture> element. This approach provides modern format support (WebP) with a reliable fallback.
The core strategy is to provide the browser with a set of responsive image sources (srcset) and a layout description (sizes), allowing it to intelligently select the most optimal image, rather than using rigid media query rules.
The <picture> block structure must be:
A single <source> element for the WebP format. This source should contain a srcset with 3-4 strategic image sizes and a sizes attribute that describes the image's width relative to the viewport.
A fallback <img> element that serves two purposes: acting as the default image and providing the responsive sources for the JPEG format via its own srcset and sizes attributes.
The <img> element must include:
width, height -- To prevent layout shifts (CLS) by reserving space.
loading="lazy" -- For all below-the-fold assets.
decoding="async" -- For an optimized rendering pipeline.
A meaningful alt text -- For accessibility and SEO.
A responsive utility class like img-fluid.
A srcset attribute for JPEG fallbacks.
A sizes attribute that mirrors the one in the WebP <source>.
For LCP or Hero images, always use:
loading="eager"
fetchpriority="high"
Whenever applicable, include a <figcaption> element to semantically describe the image context and provide assistive clarity.
💡 Best Practice Example (The Definitive Ai8V Implementation):
 <figure class="figure d-table mx-auto">
  <picture>
    <!-- 
      Primary Source: WebP format for modern browsers.
      The browser is given a set of images and a layout description.
      It will intelligently pick the best fit.
    -->
    <source 
        type="image/webp"
        srcset="
            assets/img/image-400.webp 400w,
            assets/img/image-800.webp 800w,
            assets/img/image-1200.webp 1200w,
            assets/img/image-1600.webp 1600w
        "
        sizes="(max-width: 767px) 100vw, 80vw"
    >

    <!-- 
      Fallback Image: For older browsers and as a JPEG source.
      This <img> tag handles everything for JPEG format.
    -->
    <img 
        class="img-fluid"
        src="assets/img/image-1200.jpg" 
        srcset="
            assets/img/image-400.jpg 400w,
            assets/img/image-800.jpg 800w,
            assets/img/image-1200.jpg 1200w,
            assets/img/image-1600.jpg 1600w
        "
        sizes="(max-width: 767px) 100vw, 80vw"
        width="1200"
        height="675"
        loading="lazy"
        decoding="async"
        alt="A detailed, meaningful description of the image content."
    >
  </picture>
  
  <figcaption class="figure-caption text-center mt-2">
    A clear and contextual caption for the image.
  </figcaption>
</figure>


Accessibility:
 All aria-* attributes are mandatory as shown in the blueprints. All interactive elements must be fully keyboard-navigable.
Encapsulation:
 The entire output must be wrapped in a single <main class="container-xxl my-5" dir="rtl"> element. The required layout is a two-column grid with a sticky sidebar navigation.
Uniqueness:
 All id attributes must be unique throughout the document to prevent Scrollspy malfunctions and semantic conflicts.)`;

    /**
     * الدالة الرئيسية التي تقوم بعمل "المايسترو"
     * @param {object} data - كائن يحتوي على بيانات المستخدم
     * @param {string} data.rawContent - النص الخام
     * @param {string} data.assetManifest - قائمة الأصول
     * @param {string[]} data.templateDnaArray - مصفوفة المكونات المختارة
     * @returns {string|null} - البرومبت النهائي أو null في حالة الفشل
     */
    function generate(data) {
        if (!data || !data.rawContent || !data.templateDnaArray || data.templateDnaArray.length === 0) {
            console.error("بيانات الإدخال غير كاملة أو غير صالحة.");
            return null;
        }

        // 1. بناء TEMPLATE_DNA من اختيار المستخدم
        const templateDNA = "- " + data.templateDnaArray.join('\n- ');
        
        // 2. استخدام قائمة الأصول من المدخل مباشرة
        const assetManifest = data.assetManifest.trim() || "None";

        // 3. تجميع البرومبت النهائي
        let finalPrompt = MAESTRO_GENESIS_TEMPLATE;
        finalPrompt = finalPrompt.replace('{{THE_SOUL}}', data.rawContent);
        finalPrompt = finalPrompt.replace('{{ASSET_MANIFEST}}', assetManifest);
        finalPrompt = finalPrompt.replace('{{TEMPLATE_DNA}}', templateDNA);
        finalPrompt = finalPrompt.replace('{{BLUEPRINTS}}', BLUEPRINTS_BLOCK);
        finalPrompt = finalPrompt.replace('{{CONSTRAINTS}}', CONSTRAINTS_BLOCK);

        return finalPrompt;
    }

    // "تصدير" الدالة العامة
    return {
        generate: generate
    };

})();
