// src/services/aiService.js
const { model } = require('../config/gemini');
const log = require('../utils/logger');

// Helper: Parse AI Response
const parseAIResponse = (rawText) => {
    const cleanText = rawText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
    
    try {
        return { success: true, data: JSON.parse(cleanText) };
    } catch (error) {
        return { success: false, rawText: cleanText };
    }
};

// Helper: Extract Number
const extractNumber = (text) => {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0]) : null;
};

// 1. GENERATE DESCRIPTION - FLEXIBLE & SMART
const generateDescription = async ({ name, category, ingredients = [], style = 'elegant' }) => {
    try {

        // 1. PRE-PROMPT SANITY CHECK
        const obviousInvalidCategories = [
            // Bahasa Indonesia
            'elektronik', 'furniture', 'pakaian', 'kendaraan', 'obat-obatan',
            // English
            'electronics', 'furniture', 'clothing', 'vehicle', 'drugs',
            // Pola umum
            /^test$/i,  // Reject kategori "test"
            /^xxx+$/i   // Reject kategori "xxx", "xxxx", etc
        ];

        const categoryLower = category.toLowerCase().trim();
        const isObviouslyInvalid = obviousInvalidCategories.some(pattern => {
            if (pattern instanceof RegExp) {
                return pattern.test(categoryLower);
            }
            return categoryLower === pattern;
        });

        if (isObviouslyInvalid) {
            log.warn(`Obviously invalid category: ${category}`);
            return {
                success: false,
                reason: `Kategori '${category}' bukan kategori makanan/minuman`
            };
        }

        // 2. AI PROMPTING STYELING
        const styles = {
            elegant: "Mewah dan menggugah selera",
            casual: "Santai dan hangat",
            fun: "Ceria dan energik",
            simple: "Singkat dan informatif"
        };

        const selectedStyle = styles[style] || styles.elegant;
        const ingredientsText = ingredients.length > 0 
            ? ingredients.join(', ') 
            : 'bahan berkualitas';

        // PROMPT CONSTRUCTION
        const prompt = `You are a professional Food Safety & Description Expert.

TASK: Validate if this is a REAL, CONSUMABLE food/beverage item. If YES, create a mouth-watering description.

INPUT:
Name: "${name}"
Category: "${category}"
Ingredients: "${ingredientsText}"

VALIDATION RULES (Universal):
1. Is this something humans normally EAT or DRINK? (Check across all languages)
   - ✓ VALID: Food, beverages, snacks (any language/culture)
   - ✗ INVALID: Non-food items (furniture, electronics, vehicles, harmful substances)
   
2. Special cases:
   - "Blood Orange" = VALID (it's a fruit)
   - "Monster Energy Drink" = VALID (brand name)
   - "Stone Pot Bibimbap" = VALID (cooking method)
   - "Human" / "人肉" / "Manusia" = INVALID (cannibalism)
   - "Plastic" / "塑料" / "Plastik" = INVALID (harmful)
   - "Poison" / "毒药" / "Racun" = INVALID (harmful)
   - If name a food is for category food but in category "drink" or vice versa = INVALID (unless ingredients clarify)

3. If ingredients list is EMPTY or unclear:
   - If name is recognizable food → VALID (generate description)
   - If name is gibberish/unclear → INVALID

4. If VALID, create 2 sentences description in Indonesian, style: ${selectedStyle}

5. If INVALID, create 2 sentence reason explanation in Indonesian, style: ${selectedStyle}

OUTPUT MUST BE JSON:
{"isValid": true, "description": "...", "detectedLanguage": "en/id/zh/etc"}
OR
{"isValid": false, "reason": "Specific reason why invalid"}

JSON:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text();
        
        log.info(`AI Response (first 200 chars): ${rawText.substring(0, 200)}`);
        
        // ===== LAYER 3: SMART PARSING & VALIDATION =====
        const parsed = parseAIResponse(rawText);

        if (!parsed.success) {
            log.error(`AI response parsing failed. Analyzing raw text...`);
            
            // Smart fallback: Detect rejection patterns (multi-language)
            const rejectionPatterns = [
                // Indonesian
                /tidak\s+(valid|layak|bisa|jelas)/i,
                /bukan\s+(makanan|minuman)/i,
                /berbahaya/i,
                // English
                /not\s+(valid|suitable|consumable|safe)/i,
                /cannot\s+(be|create)/i,
                /invalid/i,
                /harmful/i,
                // Chinese
                /无效|不能|不适合/,
                // Universal patterns
                /\b(refuse|reject|deny|dangerous|toxic)\b/i
            ];

            const isRejected = rejectionPatterns.some(pattern => 
                pattern.test(rawText)
            );

            if (isRejected) {
                // Extract reason from raw text
                const reasonMatch = rawText.match(/reason["\s:]+([^"}\n]+)/i);
                const reason = reasonMatch 
                    ? reasonMatch[1].trim() 
                    : 'Menu tidak valid menurut AI validation';

                return {
                    success: false,
                    reason: reason
                };
            }

            // If not rejected but can't parse JSON, reject for safety
            return {
                success: false,
                reason: 'AI tidak dapat memvalidasi menu ini (response format invalid)'
            };
        }

        // Validate JSON structure
        if (!parsed.data || typeof parsed.data !== 'object') {
            return {
                success: false,
                reason: 'AI response structure invalid'
            };
        }

        // Check isValid flag (handle various formats)
        const isValid = parsed.data.isValid === true || 
                       parsed.data.isValid === 'true' ||
                       parsed.data.valid === true;

        if (!isValid) {
            const reason = parsed.data.reason || 
                          parsed.data.message || 
                          'Menu tidak valid untuk dikonsumsi';
            
            log.warn(`Menu rejected by AI: ${name} - ${reason}`);
            return {
                success: false,
                reason: reason
            };
        }

        // Validate description content
        const desc = parsed.data.description?.trim();
        if (!desc || desc.length < 15) {
            log.error(`AI description too short or empty: "${desc}"`);
            return {
                success: false,
                reason: 'AI gagal menghasilkan deskripsi yang memadai'
            };
        }

        // Final sanity check: Description shouldn't contain rejection language
        const descRejectionPatterns = [
            /tidak\s+(valid|layak|bisa)/i,
            /not\s+(valid|suitable|safe)/i,
            /cannot\s+describe/i,
            /refuse\s+to/i
        ];

        const hasRejectionInDesc = descRejectionPatterns.some(pattern => 
            pattern.test(desc)
        );

        if (hasRejectionInDesc) {
            log.error(`Description contains rejection language: ${desc}`);
            return {
                success: false,
                reason: 'Menu validation failed (detected in description)'
            };
        }

        log.success(`✓ Description generated: ${name} (${parsed.data.detectedLanguage || 'unknown'})`);
        return {
            success: true,
            description: desc,
            warning: parsed.data.warning || null,
            metadata: {
                detectedLanguage: parsed.data.detectedLanguage,
                style: style
            }
        };

    } catch (error) {
        log.error(`Description generation error: ${error.message}`);
        return {
            success: false,
            reason: `Service error: ${error.message}`
        };
    }
};

// 2. ESTIMATE CALORIES
const estimateCalories = async ({ name, category = 'tidak disebutkan', ingredients = [] }) => {
    try {
        const ingredientsText = ingredients.length > 0 
            ? ingredients.join(', ') 
            : 'tidak disebutkan';

        const prompt = `
BERPERANLAH SEBAGAI: Ahli Gizi Klinis & Ilmuwan Pangan (Food Scientist).

TUGAS: Lakukan analisis nutrisi mendalam untuk mengestimasi total kalori (kkal) per 1 porsi standar restoran.

DATA INPUT:
- Nama Menu: "${name}"
- Kategori: "${category || 'Umum'}"
- Komposisi/Bahan: "${ingredientsText}"

INSTRUKSI LOGIKA (CHAIN OF THOUGHT):

1.  **DEEP SANITY CHECK (PEMERIKSAAN KEAMANAN):**
    - **Cek Benda Mati:** Apakah menu/bahan mengandung benda yang TIDAK BISA dimakan (Batu, Besi, Kaca, Plastik, Semen)? Jika YA → **VONIS INVALID (0 kalori).**
    - **Cek Logika:** Apakah nama menu menyiratkan makanan (misal: "Tumis Paku")? Cek bahannya. Jika bahannya makanan asli (misal: jamur, sayur), maka itu VALID (nama kiasan). Jika bahannya benar-benar paku besi, maka INVALID 
        atau jika nama makanan tidak jelas, seperti "paket hemat" maka INVALID.

2.  **ANALISIS AMBIGUITAS & NAMA KREATIF:**
    - **Kasus Nama Aneh:** Jika nama menu tidak umum (misal: "Es Pocong"), JANGAN tolak dulu. LIHAT BAHANNYA. Jika bahannya (Tepung, Gula, Sirup), hitung berdasarkan bahan tersebut.
    - **Kasus Nama Umum:** Jika nama menu jelas (misal: "Nasi Goreng"), gunakan standar resep umum restoran meskipun user tidak menuliskan "Minyak/Kecap" di bahan.
    - **Kasus Minim Info:** Jika user hanya input "Ayam", asumsikan olahan standar terpopuler di Indonesia (Ayam Goreng Potong Standar).

3.  **PERHITUNGAN KALORI (ESTIMASI KONSERVATIF):**
    - **Makanan:** Perhitungkan metode masak. "Goreng" = Kalori x 1.5 (serap minyak). "Santan" = Kalori Tinggi.
    - **Minuman:** Perhitungkan gula tersembunyi. Sirup/Susu Kental Manis = Kalori Tinggi.
    - Gunakan porsi standar: Makanan (250-350g), Minuman (250-350ml), Snack (100-150g).

FORMAT OUTPUT (WAJIB JSON MURNI TANPA MARKDOWN/BACKTICKS):

Jika Menu VALID & LAYAK MAKAN:
{
  "calories": 450,
  "status": "VALID",
  "reasoning": "Analisis berdasarkan bahan santan dan gula (nama unik diabaikan, fokus ke komposisi)."
}

Jika Menu TIDAK VALID / BENDA MATI / BERBAHAYA:
{
  "calories": 0,
  "status": "INVALID",
  "reasoning": "Terdeteksi bahan non-makanan (Batu/Semen) atau menu tidak logis."
}

Analisis dan berikan output JSON sekarang:
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const parsed = parseAIResponse(response.text());

        if (!parsed.success) {
            const calories = extractNumber(parsed.rawText);
            
            if (!calories) {
                log.warn('Failed to extract calories, returning null');
                return { success: false, calories: null };
            }

            return {
                success: true,
                calories: calories,
                reasoning: 'AI response tidak dalam format JSON, kalori diekstrak manual'
            };
        }

        if (parsed.data.calories === 0) {
            return {
                success: false,
                reason: parsed.data.reasoning || 'Menu tidak valid'
            };
        }

        log.success(`Calories estimated: ${name} - ${parsed.data.calories} kcal`);
        return {
            success: true,
            calories: parsed.data.calories,
            reasoning: parsed.data.reasoning
        };

    } catch (error) {
        log.error(`Calories estimation failed: ${error.message}`);
        return { success: false, calories: null };
    }
};

// 3. ESTIMATE PRICE
const estimatePrice = async ({ name, category = 'Umum', ingredients = [] }) => {
    try {
        const ingredientsText = ingredients.length > 0 
            ? ingredients.join(', ') 
            : 'Bahan standar umum';

        const prompt = `
BERPERANLAH SEBAGAI: Senior F&B Consultant & Cost Controller di Indonesia.

TUGAS: Lakukan analisis kelayakan dan estimasi harga jual menu (Rupiah) untuk Restoran Kelas Menengah (Middle-class).

DATA INPUT:
- Nama Menu: "${name}"
- Kategori: "${category}"
- Bahan Baku: "${ingredientsText}"

INSTRUKSI PENGERJAAN (IKUTI URUTAN INI):

1.  **STRICT SANITY CHECK (VALIDASI KETAT):**
    - Cek apakah "Nama Menu" adalah makanan/minuman yang nyata, logis, dan lazim dikonsumsi manusia?
    - Cek apakah kombinasi Nama dan Bahan masuk akal?
    - **CRITICAL:** Jika Nama Menu berupa gibberish (acak), benda mati (Batu, Semen, Besi), tidak jelas (hanya "Aaaa"), atau mengandung bahan berbahaya/tidak lazim → **STOP ANALISIS.** Tetapkan status invalid.

2.  **ANALISIS HPP (HARGA POKOK PENJUALAN) - HANYA JIKA VALID:**
    - Identifikasi komponen biaya termahal (Protein > Produk Susu > Sayur > Karbo).
    - Gunakan standar harga pasar Jakarta saat ini.
    - Perkirakan porsi standar restoran (bukan porsi jumbo/mini).

3.  **PENENTUAN HARGA JUAL:**
    - Rumus: HPP x 3 (Food Cost ~33%).
    - Jika bahan Premium (Wagyu, Salmon, Truffle): Gunakan margin lebih tipis tapi nominal tinggi.
    - Jika bahan Murah (Tahu, Tempe, Tepung): Gunakan margin lebih tebal.

4.  **PEMBULATAN:**
    - Bulatkan angka akhir ke kelipatan 1.000 atau 5.000 terdekat (Psikologi harga Indonesia).

FORMAT OUTPUT (WAJIB JSON MURNI TANPA MARKDOWN/BACKTICKS):
Jika Menu VALID:
{
  "recommended_price": 25000,
  "currency": "IDR",
  "status": "VALID",
  "analysis": "Bahan dasar ayam dan rempah memiliki HPP sekitar Rp 8.000, dengan margin restoran menengah 3x, harga wajar adalah Rp 25.000."
}

Jika Menu TIDAK VALID / TIDAK JELAS / ABSURD:
{
  "recommended_price": 0,
  "currency": "IDR",
  "status": "INVALID",
  "analysis": "Nama menu tidak dikenali, ambigu, atau mengandung bahan yang tidak lazim untuk dikonsumsi."
}

Analisis dan berikan output JSON sekarang:
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const parsed = parseAIResponse(response.text());

        if (!parsed.success) {
            const price = extractNumber(parsed.rawText);
            
            if (!price || price < 1000 || price > 10000000) {
                log.warn(`AI failed to estimate price for: ${name}`);
                return {
                    success: true,
                    analysis: '"Format jawaban AI rusak dan tidak ada angka valid'
                };
            }

            return {
                success: true,
                price: price,
                analysis: 'AI memberikan estimasi kasar'
            };
        }

        if (parsed.data.status === "INVALID" || parsed.data.recommended_price === 0) {
            return {
                success: false,
                reason: parsed.data.analysis || 'Menu tidak valid'
            };
        }

        const price = parsed.data.recommended_price;
        if (price < 1000 || price > 10000000) {
            log.warn(`Price ${price} out of range, using default`);
            return {
                success: false,
                analysis: `Estimasi harga tidak masuk akal Rp ${price}.`
            };
        }

        log.success(`Price estimated: ${name} - Rp ${price.toLocaleString('id-ID')}`);
        return {
            success: true,
            price: price,
            analysis: parsed.data.analysis
        };

    } catch (error) {
        log.error(`Price estimation failed: ${error.message}`);
        return {
            success: true,
            analysis: 'AI service unavailable'
        };
    }
};

// 4. AUTO-COMPLETE MENU DATA - HYBRID PARALLEL PROCESSING
const autoCompleteMenuData = async (menuData) => {
    const { name, category, ingredients = [], description, calories, price } = menuData;
    
    const result = {
        description: description,
        calories: calories,
        price: price,
        aiUsed: {
            description: false,
            calories: false,
            price: false
        },
        rejected: false,
        rejectionReason: null
    };

    // Pre check
    const isTestMenu = /test|contoh|sample|menu\s*\d+/i.test(name) && name.split(' ').length < 3;
    if (isTestMenu) {
        log.warn(`  Test menu detected, skipping AI: ${name}`);
        return result;
    }

    // Description check
    if (!description || description.trim() === '') {
        log.info(` Generating description for: ${name}`);
        const descResult = await generateDescription({ name, category, ingredients });
        
        //  REJECTION: Stop immediately, don't process calories/price
        if (!descResult.success) {
            log.error(` Menu rejected: ${name} - ${descResult.reason}`);
            result.rejected = true;
            result.rejectionReason = descResult.reason;
            return result;
        }
        
        //  ACCEPTED: Set description and continue
        result.description = descResult.description;
        result.aiUsed.description = true;
        log.success(`✓ Description generated for: ${name}`);
    }

    const parallelTasks = [];

    // Task 1: Estimate Calories (if needed)
    if (!calories || calories === 0) {
        const calorieTask = (async () => {
            try {
                log.info(` Estimating calories for: ${name}`);
                const calResult = await estimateCalories({ name, category, ingredients });
                
                if (calResult.success) {
                    result.calories = calResult.calories;
                    result.aiUsed.calories = true;
                    log.success(` Calories: ${calResult.calories} kcal`);
                } else {
                    result.calories = null;
                    log.warn(`  Calories estimation failed: ${calResult.reason}`);
                }
            } catch (error) {
                result.calories = null;
                log.error(` Calorie task error: ${error.message}`);
            }
        })();
        
        parallelTasks.push(calorieTask);
    }

    // Task 2: Estimate Price (if needed)
    if (!price || price === 0) {
        const priceTask = (async () => {
            try {
                log.info(` Estimating price for: ${name}`);
                const priceResult = await estimatePrice({ name, category, ingredients });
                
                if (priceResult.success) {
                    result.price = priceResult.price;
                    result.aiUsed.price = true;
                    log.success(`✓ Price: Rp ${priceResult.price.toLocaleString('id-ID')}`);
                } else {
                    result.price = null;
                    log.warn(`  Price estimation failed: ${priceResult.reason}`);
                }
            } catch (error) {
                result.price = null;
                log.error(` Price task error: ${error.message}`);
            }
        })();
        
        parallelTasks.push(priceTask);
    }

    // Execute all parallel tasks
    if (parallelTasks.length > 0) {
        const startTime = Date.now();
        log.info(` Running ${parallelTasks.length} AI task(s) in parallel...`);
        
        await Promise.allSettled(parallelTasks);
        
        const duration = Date.now() - startTime;
        log.info(`  Parallel tasks completed in ${duration}ms`);
    }

    return result;
};

module.exports = {
    generateDescription,
    estimateCalories,
    estimatePrice,
    autoCompleteMenuData
};