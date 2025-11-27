// File: src/controllers/menuController.js
const supabase = require('../config/supabase') // Ambil data
const aiService = require('../services/aiService'); // Ambil service AI
const log = require('../utils/logger'); 

// sanitize data menu
const sanitizeMenu = (menu) => ({
    ...menu,
    price: menu.price !== null ? menu.price : 0,       // Null -> 0
    calories: menu.calories !== null ? menu.calories : 0, // Null -> 0
    description: menu.description || "",               // Null -> String kosong
    ingredients: menu.ingredients || []                // Null -> Array kosong
});

// 1. Logika GET ALL MENU
exports.getAllMenus = async (req, res) => {  
    try {
        const { 
            q, category, min_price, max_price, max_cal,
            page = 1, per_page = 10, sort = 'created_at:desc'
        } = req.query;

        //  1. BUILD QUERY dengan chaining yang benar
        let query = supabase.from('menus').select('*', { count: 'exact' });

        //  Filter by search (name OR description)
        if (q) {
            query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
        }

        //  Filter by category (syntax yang benar)
        if (category) {
            query = query.eq('category', category);
        }

        //  Filter by price range
        if (min_price) {
            query = query.gte('price', parseFloat(min_price));
        }
        if (max_price) {
            query = query.lte('price', parseFloat(max_price));
        }

        //  Filter by max calories
        if (max_cal) {
            query = query.lte('calories', parseInt(max_cal));
        }

        //  2. SORTING (syntax Supabase)
        if (sort) {
            const [field, order] = sort.split(':');
            const validFields = ['name', 'price', 'calories', 'created_at'];
            const isAsc = order === 'asc';
    
            if (validFields.includes(field)) {
                query = query.order(field, { 
                    ascending: isAsc,
                    nullsFirst: false  
                });
            }
        }

        //  3. PAGINATION (syntax Supabase)
        const pageNum = parseInt(page);
        const perPage = parseInt(per_page);
        const from = (pageNum - 1) * perPage;
        const to = from + perPage - 1;
        
        query = query.range(from, to);

        //  4. EXECUTE QUERY (CRITICAL!)
        const { data, error, count } = await query;

        if (error) {
            throw new Error(error.message);
        }

        // sanitize data
        const cleanData = data.map(item => sanitizeMenu(item));

        //  5. RESPONSE dengan data dari database
        res.status(200).json({
            success: true,
            message: "Berhasil mengambil data menu",
            data: cleanData,
            pagination: {
                total: count,
                page: pageNum,
                per_page: perPage,
                total_pages: Math.ceil(count / perPage)
            },
            filters_applied: {
                search: q || null,
                category: category || null,
                price_range: {
                    min: min_price ? parseFloat(min_price) : null,
                    max: max_price ? parseFloat(max_price) : null
                },
                max_calories: max_cal ? parseInt(max_cal) : null,
                sort: sort
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Gagal mengambil data menu",
            error: error.message
        });
    }
};

// 1a. Logika GET MENU STATS
exports.getMenuStats = async (req, res) => {  
    try {
        //  Query semua menu
        const { data, error } = await supabase
            .from('menus')
            .select('category');

        if (error) throw new Error(error.message);

        //  Hitung menggunakan data dari database
        const categoryCounts = data.reduce((acc, menu) => {
            acc[menu.category] = (acc[menu.category] || 0) + 1;
            return acc;
        }, {});

        res.status(200).json({ success: true, data: categoryCounts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 1b. Logika GET MENU GROUPED (SEMUA DALAM SATU RESPON)
exports.getMenuGrouped = async (req, res) => {  
    try {
        //  Query semua menu
        const { data, error } = await supabase
            .from('menus')
            .select('*')
            .order('category', { ascending: true });

        if (error) throw new Error(error.message);

        //  Group menggunakan data dari database
        const grouped = data.reduce((acc, menu) => {
            if (!acc[menu.category]) {
                acc[menu.category] = [];
            }
            acc[menu.category].push(menu);
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            message: "Berhasil mengelompokkan menu berdasarkan kategori",
            data: grouped
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 1c. Logika SEARCH MENU - FIXED (Handle empty string)
exports.searchMenu = async (req, res) => {  
    try {
        const { q, category, minPrice, maxPrice, page = 1, per_page = 10 } = req.query;
        
        //  Build query Supabase dengan count
        let query = supabase.from('menus').select('*', { count: 'exact' });

        //  Filter by search query (PERBAIKAN: cek jika q ada DAN tidak kosong)
        if (q && q.trim() !== '') {
            query = query.or(`name.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
        }

        //  Filter by category (PERBAIKAN: cek jika tidak kosong)
        if (category && category.trim() !== '') {
            query = query.eq('category', category.trim());
        }

        //  Filter by price range
        if (minPrice) {
            const price = parseFloat(minPrice);
            if (!isNaN(price)) {
                query = query.gte('price', price);
            }
        }
        if (maxPrice) {
            const price = parseFloat(maxPrice);
            if (!isNaN(price)) {
                query = query.lte('price', price);
            }
        }

        // Pagination
        const pageNum = parseInt(page) || 1;
        const perPage = parseInt(per_page) || 10;
        const from = (pageNum - 1) * perPage;
        const to = from + perPage - 1;
        
        query = query.range(from, to);

        //  Execute query
        const { data, error, count } = await query;

        if (error) throw new Error(error.message);

        // Sanitize data
        const cleanData = data.map(item => sanitizeMenu(item));

        res.status(200).json({
            success: true,
            message: q && q.trim() !== '' 
                ? "Berhasil melakukan pencarian" 
                : "Berhasil mengambil semua menu",
            data: cleanData,
            pagination: {
                total: count,
                page: pageNum,
                per_page: perPage,
                total_pages: Math.ceil(count / perPage)
            },
            filters_applied: {
                search: q && q.trim() !== '' ? q.trim() : null,
                category: category && category.trim() !== '' ? category.trim() : null,
                price_range: {
                    min: minPrice ? parseFloat(minPrice) : null,
                    max: maxPrice ? parseFloat(maxPrice) : null
                }
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Gagal melakukan pencarian",
            error: error.message 
        });
    }
};

// 1d. Logika GET MENU BY GROUP - FIXED
exports.getMenuByGroup = async (req, res) => {  
    try {
        const { mode, per_page, per_category } = req.query;

        //  Query semua menu
        const { data, error } = await supabase
            .from('menus')
            .select('*')
            .order('category', { ascending: true });

        if (error) throw new Error(error.message);

        // Sanitize data terlebih dahulu
        const cleanData = data.map(item => sanitizeMenu(item));

        // Mode count
        if (mode === 'count') {
            const counts = cleanData.reduce((acc, menu) => {
                acc[menu.category] = (acc[menu.category] || 0) + 1;
                return acc;
            }, {});
            
            return res.status(200).json({ 
                success: true, 
                message: "Berhasil menghitung menu per kategori",
                data: counts 
            });
        }

        // Mode list (default)
        const grouped = cleanData.reduce((acc, menu) => {
            if (!acc[menu.category]) acc[menu.category] = [];
            acc[menu.category].push(menu);
            return acc;
        }, {});

        // Limit items per category (gunakan per_page ATAU per_category)
        const limitPerCategory = per_category || per_page;
        
        if (limitPerCategory) {
            const limit = parseInt(limitPerCategory);
            if (!isNaN(limit) && limit > 0) {
                Object.keys(grouped).forEach(cat => {
                    grouped[cat] = grouped[cat].slice(0, limit);
                });
            }
        }

        // Hitung total items dan categories
        const totalItems = Object.values(grouped).reduce((sum, items) => sum + items.length, 0);
        const totalCategories = Object.keys(grouped).length;

        res.status(200).json({ 
            success: true,
            message: "Berhasil mengelompokkan menu berdasarkan kategori",
            data: grouped,
            summary: {
                total_categories: totalCategories,
                total_items: totalItems,
                items_per_category: limitPerCategory ? parseInt(limitPerCategory) : "all"
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Gagal mengelompokkan menu",
            error: error.message 
        });
    }
};

// 2. CREATE MENU - SIMPLIFIED WITH AI POWER
exports.createMenu = async (req, res) => {
    try {
        const dataBaru = req.body;

        // ===== STEP 1: BASIC VALIDATION (Required Fields) =====
        if (!dataBaru.name || !dataBaru.category) {
            return res.status(400).json({ 
                success: false, 
                message: "Data tidak lengkap. Harap isi name dan category." 
            });
        }

        // ===== STEP 2: BUSINESS RULES VALIDATION =====
        
        // Rule 1: Nama tidak boleh generic/unclear
        const genericNames = [
            /^test\s*menu$/i,
            /^menu\s*\d*$/i,        // "Menu", "Menu 1", "Menu123"
            /^[a-z]{1,2}$/i,        // "A", "AB"
            /^xxx+$/i,              // "xxx", "xxxx"
            /^[\d\s\-_]+$/,         // "123", "---", "___"
            /^untitled/i,
            /^no\s*name/i,
            /^temp/i,
            /^item\s*\d*$/i         // "Item", "Item 1"
        ];

        const nameTrimmed = dataBaru.name.trim();
        
        const isGenericName = genericNames.some(pattern => 
            pattern.test(nameTrimmed)
        );

        if (isGenericName) {
            return res.status(400).json({
                success: false,
                message: "Nama menu tidak valid",
                reason: `Nama '${dataBaru.name}' terlalu generic atau tidak jelas`,
                hint: "Gunakan nama menu yang spesifik, contoh: 'Nasi Goreng Seafood', 'Es Teh Manis', 'Ayam Bakar Madu'",
                examples: [
                    "Nasi Goreng Spesial",
                    "Es Teh Manis",
                    "Ayam Geprek",
                    "Kopi Susu Gula Aren"
                ]
            });
        }

        // Rule 2: Nama minimal 3 karakter (setelah trim)
        if (nameTrimmed.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Nama menu terlalu pendek",
                reason: "Nama menu harus minimal 3 karakter",
                hint: "Contoh: 'Teh', 'Soto', 'Mie Ayam'"
            });
        }

        // Rule 3: Kategori harus dari whitelist yang valid
        const validCategories = [
            // Bahasa Indonesia
            'makanan', 'minuman', 'snack', 'dessert', 'appetizer', 
            'main course', 'side dish', 'soup', 'salad', 'kue',
            'jajanan', 'camilan', 'hidangan pembuka', 'hidangan utama', 
            'hidangan penutup', 'bakery', 'pastry',
            // English (untuk flexibility)
            'food', 'beverage', 'drink', 'snacks', 'desserts', 
            'appetizers', 'entree', 'main dish', 'side', 'cake',
            'coffee', 'tea', 'juice', 'smoothie', 'bread'
        ];

        const categoryLower = dataBaru.category.toLowerCase().trim();
        const isValidCategory = validCategories.some(valid => 
            categoryLower === valid || categoryLower.includes(valid)
        );

        if (!isValidCategory) {
            return res.status(400).json({
                success: false,
                message: "Kategori menu tidak valid",
                reason: `Kategori '${dataBaru.category}' tidak dikenali`,
                hint: "Gunakan kategori yang sesuai untuk menu makanan/minuman",
                validCategories: [
                    "makanan", "minuman", "snack", "dessert", 
                    "appetizer", "main course", "side dish", 
                    "soup", "salad", "kue", "jajanan", "camilan"
                ]
            });
        }

        // Rule 4: OPTIONAL - Validasi tipe data jika user isi
        if (dataBaru.price !== undefined && dataBaru.price !== null) {
            if (typeof dataBaru.price !== 'number' || dataBaru.price <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Price harus berupa angka positif",
                    hint: "Contoh: 15000, 25000, 50000. Atau kosongkan agar AI yang estimasi."
                });
            }
        }
        
        if (dataBaru.calories !== undefined && dataBaru.calories !== null) {
            if (typeof dataBaru.calories !== 'number' || dataBaru.calories < 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Calories harus berupa angka non-negatif",
                    hint: "Atau kosongkan agar AI yang estimasi."
                });
            }
        }
        
        if (dataBaru.ingredients !== undefined && dataBaru.ingredients !== null) {
            if (!Array.isArray(dataBaru.ingredients)) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Ingredients harus berupa array",
                    hint: "Contoh: [\"nasi\", \"telur\", \"ayam\"] atau kosongkan."
                });
            }

            // Rule 5: Validasi ingredients jika user provide
            if (dataBaru.ingredients.length > 0) {
                const invalidIngredients = dataBaru.ingredients.filter(ing => {
                    const trimmed = ing.trim();
                    // Allow unicode characters (for international ingredients)
                    return trimmed.length < 2 || /^[\d\s\-_]+$/.test(trimmed);
                });

                if (invalidIngredients.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Bahan tidak valid",
                        reason: `Bahan berikut tidak valid: ${invalidIngredients.join(', ')}`,
                        hint: "Bahan harus berupa kata yang valid, minimal 2 karakter"
                    });
                }
            }
        }
        
        // ===== STEP 3: PANGGIL AI SERVICE =====
        log.info(`Creating menu: ${dataBaru.name} (${dataBaru.category})`);
        
        const aiCompletedData = await aiService.autoCompleteMenuData({
            name: dataBaru.name.trim(),
            category: dataBaru.category.trim(),
            ingredients: dataBaru.ingredients || [],
            description: dataBaru.description || null,
            calories: dataBaru.calories || null,
            price: dataBaru.price || null
        });

        // ===== STEP 4: CHECK AI REJECTION =====
        if (aiCompletedData.rejected) {
            log.warn(`Menu rejected by AI: ${dataBaru.name} - ${aiCompletedData.rejectionReason}`);
            return res.status(400).json({
                success: false,
                message: "Menu ditolak oleh sistem validasi AI",
                reason: aiCompletedData.rejectionReason,
                data: {
                    name: dataBaru.name,
                    category: dataBaru.category,
                    ingredients: dataBaru.ingredients || []
                },
                hint: "Pastikan nama menu adalah makanan/minuman yang valid dan lazim dikonsumsi"
            });
        }

        // ===== STEP 5: QUALITY CHECK (AI harus generate sesuatu) =====
        // Description wajib ada (dari user atau AI)
        if (!aiCompletedData.description || aiCompletedData.description.trim() === '') {
            log.error(`AI failed to generate description for: ${dataBaru.name}`);
            return res.status(500).json({
                success: false,
                message: "Gagal membuat deskripsi menu",
                reason: "AI service mengalami kesalahan atau tidak dapat memahami menu ini",
                hint: "Coba tambahkan ingredients atau description manual"
            });
        }

        // ===== STEP 6: INSERT KE DATABASE =====
        const { data, error } = await supabase
            .from('menus')
            .insert([{
                name: dataBaru.name.trim(),
                category: dataBaru.category.trim().toLowerCase(),
                ingredients: dataBaru.ingredients || [],
                description: aiCompletedData.description,
                calories: aiCompletedData.calories,
                price: aiCompletedData.price
            }])
            .select()
            .single();

        if (error) throw new Error(error.message);

        log.success(`✓ Menu created: ${data.name} | AI Used: desc=${aiCompletedData.aiUsed.description}, cal=${aiCompletedData.aiUsed.calories}, price=${aiCompletedData.aiUsed.price}`);

        res.status(201).json({
            success: true,
            message: "Menu berhasil ditambahkan",
            data: data,
            ai_assistance: {
                description_generated: aiCompletedData.aiUsed.description,
                calories_estimated: aiCompletedData.aiUsed.calories,
                price_estimated: aiCompletedData.aiUsed.price,
                note: Object.values(aiCompletedData.aiUsed).some(used => used) 
                    ? "AI membantu melengkapi data yang kosong" 
                    : "Semua data diisi manual oleh user"
            }
        });

    } catch (error) {
        log.error(`Failed to create menu: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            message: "Gagal menambahkan menu", 
            error: error.message 
        });
    }
};

// 3. GET DETAIL MENU (GET /menu/:id)
exports.getMenuById = async (req, res) => {  
    try {
        const id = parseInt(req.params.id);

        //  Query by ID dari Supabase
        const { data, error } = await supabase
            .from('menus')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({ 
                success: false, 
                message: "Menu tidak ditemukan" 
            });
        }

        res.status(200).json({
            success: true,
            message: "Berhasil mengambil detail menu",
            data: data
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// 4. UPDATE MENU (PUT /menu/:id)
exports.updateMenu = async (req, res) => { 
    try {
        const id = parseInt(req.params.id);

        //  Update di Supabase
        const { data, error } = await supabase
            .from('menus')
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ 
                success: false, 
                message: "Menu tidak ditemukan" 
            });
        }

        res.status(200).json({
            success: true,
            message: "Menu berhasil diupdate",
            data: data
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// 5. DELETE MENU (DELETE /menu/:id)
exports.deleteMenu = async (req, res) => {  
    try {
        const id = parseInt(req.params.id);

        //  Get menu name dulu untuk response message
        const { data: menu } = await supabase
            .from('menus')
            .select('name')
            .eq('id', id)
            .single();

        //  Delete dari Supabase
        const { error } = await supabase
            .from('menus')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(404).json({ 
                success: false, 
                message: "Menu tidak ditemukan" 
            });
        }

        res.status(200).json({
            success: true,
            message: menu ? `Menu '${menu.name}' berhasil dihapus` : "Menu berhasil dihapus"
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};


// 3. Logika AI GENERATE DESC
exports.generateDescription = async (req, res) => {
    try {
        const { name, category, ingredients, style } = req.body;

        if (!name || !category) {
            return res.status(400).json({ success: false, message: "Field 'name' dan 'category' wajib diisi" });
        }

        //  CALL AI SERVICE (SATU BARIS!)
        const result = await aiService.generateDescription({
            name,
            category,
            ingredients: ingredients || [],
            style: style || 'elegant'
        });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Menu tidak valid untuk dibuatkan deskripsi",
                reason: result.reason,
                data: { name, category, ingredients: ingredients || [] }
            });
        }

        res.status(200).json({
            success: true,
            message: "Deskripsi berhasil di-generate oleh AI",
            data: {
                name,
                category,
                ingredients: ingredients || [],
                style: style || 'elegant',
                ai_generated_description: result.description,
                warning: result.warning
            }
        });
    } catch (error) {
        log.error(`AI description endpoint failed: ${error.message}`);
        res.status(500).json({ success: false, message: "Gagal generate deskripsi dengan AI", error: error.message });
    }
};

exports.generateCalories = async (req, res) => {
    try {
        const { name, category, ingredients } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: "Name menu harus diisi" });
        }
        //  CALL AI SERVICE
        const result = await aiService.estimateCalories({ name, category, ingredients: ingredients || [] });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Menu tidak valid atau tidak bisa dihitung kalorinya",
                reason: result.reason
            });
        }

        res.status(200).json({
            success: true,
            message: "Kalori berhasil dihitung oleh AI",
            data: {
                name,
                category: category || null,
                ingredients: ingredients || [],
                estimated_calories: result.calories,
                reasoning: result.reasoning,
                note: "Estimasi kalori untuk 1 porsi standar"
            }
        });
    } catch (error) {
        log.error(`AI calories endpoint failed: ${error.message}`);
        res.status(500).json({ success: false, message: "Gagal menghitung kalori dengan AI", error: error.message });
    }
};

exports.generatePrice = async (req, res) => {
    try {
        const { name, category, ingredients } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: "Nama menu harus diisi" });
        }
            // CALL AI SERVICE
            const result = await aiService.estimatePrice({ name, category, ingredients: ingredients || [] });

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: "Menu tidak valid atau tidak lazim untuk dijual",
                    reason: result.reason
                });
            }

            res.status(200).json({
                success: true,
                message: "Berhasil mendapatkan saran harga",
                data: {
                    menu: name,
                    ingredients: ingredients || [],
                    recommended_price: result.price,
                    currency: "IDR",
                    reasoning: result.analysis
                }
            });
        } catch (error) {
            log.error(`AI price endpoint failed: ${error.message}`);
            res.status(500).json({ success: false, message: "Gagal mengestimasi harga", error: error.message });
        }
};
