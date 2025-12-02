const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', '..', 'uploads', 'services');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `service-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены!'));
        }
    }
});

/**
 * Вспомогательная функция для генерации slug
 */
function generateSlug(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * GET /api/services
 * Get all services (for admin)
 */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const { is_active, search } = req.query;
        
        let query = 'SELECT * FROM services WHERE deleted_at IS NULL';
        const params = [];
        
        if (is_active !== undefined) {
            query += ' AND is_active = ?';
            params.push(is_active === 'true' ? 1 : 0);
        }
        
        if (search) {
            query += ' AND (hero_title LIKE ? OR slug LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        query += ' ORDER BY menu_sort, id';
        
        const services = db.prepare(query).all(...params);
        
        res.json(services.map(service => ({
            ...service,
            is_active: Boolean(service.is_active),
            show_in_menu: Boolean(service.show_in_menu)
        })));
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

/**
 * GET /api/services/public
 * Get active services for public menu
 */
router.get('/public', (req, res) => {
    try {
        const db = getDatabase();
        const services = db.prepare(`
            SELECT id, slug, hero_title, menu_sort
            FROM services
            WHERE is_active = 1 AND show_in_menu = 1 AND deleted_at IS NULL
            ORDER BY menu_sort, id
        `).all();
        
        res.json(services);
    } catch (error) {
        console.error('Error fetching public services:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

/**
 * GET /api/services/:slug
 * Get service by slug (public)
 */
router.get('/:slug', (req, res) => {
    try {
        const db = getDatabase();
        const service = db.prepare(`
            SELECT * FROM services 
            WHERE slug = ? AND is_active = 1 AND deleted_at IS NULL
        `).get(req.params.slug);
        
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }
        
        // Загружаем преимущества
        const advantages = db.prepare(`
            SELECT * FROM service_advantages
            WHERE service_id = ?
            ORDER BY sort_order, id
        `).all(service.id);
        
        // Загружаем фотографии
        const photos = db.prepare(`
            SELECT * FROM service_photos
            WHERE service_id = ?
            ORDER BY sort_order, id
        `).all(service.id);
        
        res.json({
            ...service,
            is_active: Boolean(service.is_active),
            show_in_menu: Boolean(service.show_in_menu),
            advantages,
            photos
        });
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({ error: 'Failed to fetch service' });
    }
});

/**
 * GET /api/services/admin/:id
 * Get service by ID (for admin)
 */
router.get('/admin/:id', (req, res) => {
    try {
        const db = getDatabase();
        const service = db.prepare('SELECT * FROM services WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
        
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }
        
        // Загружаем преимущества
        const advantages = db.prepare(`
            SELECT * FROM service_advantages
            WHERE service_id = ?
            ORDER BY sort_order, id
        `).all(service.id);
        
        // Загружаем фотографии
        const photos = db.prepare(`
            SELECT * FROM service_photos
            WHERE service_id = ?
            ORDER BY sort_order, id
        `).all(service.id);
        
        res.json({
            ...service,
            is_active: Boolean(service.is_active),
            show_in_menu: Boolean(service.show_in_menu),
            advantages,
            photos
        });
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({ error: 'Failed to fetch service' });
    }
});

/**
 * POST /api/services
 * Create new service
 */
router.post('/', upload.fields([
    { name: 'hero_background_image', maxCount: 1 },
    { name: 'intro_image', maxCount: 1 }
]), (req, res) => {
    try {
        const db = getDatabase();
        const {
            slug,
            hero_title,
            is_active,
            show_in_menu,
            menu_sort = 500,
            meta_title,
            meta_description,
            meta_keywords,
            hero_subtitle,
            hero_button_text,
            hero_button_link,
            intro_title,
            intro_text,
            bottom_cta_title,
            bottom_cta_text,
            bottom_cta_button_text,
            bottom_cta_button_link,
            advantages = '[]',
            photos = '[]'
        } = req.body;
        
        // Правильная обработка булевых значений из FormData (приходят как строки '1' или '0')
        const isActive = is_active === '1' || is_active === 1 || is_active === true || is_active === 'true';
        const showInMenu = show_in_menu === '1' || show_in_menu === 1 || show_in_menu === true || show_in_menu === 'true';
        
        // Логирование для отладки
        console.log('Creating service - raw values:', { 
            is_active, 
            show_in_menu, 
            is_active_type: typeof is_active,
            show_in_menu_type: typeof show_in_menu
        });
        console.log('Creating service - processed:', { isActive, showInMenu });
        
        // Генерируем slug, если не указан
        let finalSlug = slug || generateSlug(hero_title || 'service');
        
        // Проверяем уникальность slug
        const existing = db.prepare('SELECT id FROM services WHERE slug = ? AND deleted_at IS NULL').get(finalSlug);
        if (existing) {
            return res.status(409).json({ error: 'Service with this slug already exists' });
        }
        
        // Обрабатываем загруженные файлы
        const heroBackgroundImage = req.files?.hero_background_image?.[0] 
            ? `/uploads/services/${req.files.hero_background_image[0].filename}` 
            : null;
        const introImage = req.files?.intro_image?.[0] 
            ? `/uploads/services/${req.files.intro_image[0].filename}` 
            : null;
        
        const result = db.prepare(`
            INSERT INTO services (
                slug, is_active, show_in_menu, menu_sort,
                meta_title, meta_description, meta_keywords,
                hero_background_image, hero_title, hero_subtitle,
                hero_button_text, hero_button_link,
                intro_title, intro_text, intro_image,
                bottom_cta_title, bottom_cta_text,
                bottom_cta_button_text, bottom_cta_button_link
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            finalSlug,
            isActive ? 1 : 0,
            showInMenu ? 1 : 0,
            menu_sort,
            meta_title || null,
            meta_description || null,
            meta_keywords || null,
            heroBackgroundImage,
            hero_title,
            hero_subtitle || null,
            hero_button_text || null,
            hero_button_link || null,
            intro_title || null,
            intro_text || null,
            introImage,
            bottom_cta_title || null,
            bottom_cta_text || null,
            bottom_cta_button_text || null,
            bottom_cta_button_link || null
        );
        
        const serviceId = result.lastInsertRowid;
        
        // Сохраняем преимущества
        try {
            const advantagesArray = JSON.parse(advantages);
            const insertAdvantage = db.prepare(`
                INSERT INTO service_advantages (service_id, title, text, icon, image, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            advantagesArray.forEach((adv, index) => {
                insertAdvantage.run(
                    serviceId,
                    adv.title || '',
                    adv.text || null,
                    adv.icon || null,
                    adv.image || null,
                    adv.sort_order !== undefined ? adv.sort_order : index
                );
            });
        } catch (e) {
            console.error('Error saving advantages:', e);
        }
        
        // Сохраняем фотографии
        try {
            const photosArray = JSON.parse(photos);
            const insertPhoto = db.prepare(`
                INSERT INTO service_photos (service_id, image, caption, sort_order)
                VALUES (?, ?, ?, ?)
            `);
            
            photosArray.forEach((photo, index) => {
                insertPhoto.run(
                    serviceId,
                    photo.image || '',
                    photo.caption || null,
                    photo.sort_order !== undefined ? photo.sort_order : index
                );
            });
        } catch (e) {
            console.error('Error saving photos:', e);
        }
        
        const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
        res.status(201).json({
            ...service,
            is_active: Boolean(service.is_active),
            show_in_menu: Boolean(service.show_in_menu)
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Service with this slug already exists' });
        }
        console.error('Error creating service:', error);
        res.status(500).json({ error: 'Failed to create service' });
    }
});

/**
 * PUT /api/services/:id
 * Update service
 */
router.put('/:id', upload.fields([
    { name: 'hero_background_image', maxCount: 1 },
    { name: 'intro_image', maxCount: 1 }
]), (req, res) => {
    try {
        const db = getDatabase();
        const serviceId = req.params.id;
        
        // Проверяем существование услуги
        const existing = db.prepare('SELECT * FROM services WHERE id = ? AND deleted_at IS NULL').get(serviceId);
        if (!existing) {
            return res.status(404).json({ error: 'Service not found' });
        }
        
        const {
            slug,
            hero_title,
            is_active,
            show_in_menu,
            menu_sort,
            meta_title,
            meta_description,
            meta_keywords,
            hero_subtitle,
            hero_button_text,
            hero_button_link,
            intro_title,
            intro_text,
            bottom_cta_title,
            bottom_cta_text,
            bottom_cta_button_text,
            bottom_cta_button_link,
            advantages = '[]',
            photos = '[]'
        } = req.body;
        
        // Правильная обработка булевых значений из FormData (приходят как строки '1' или '0')
        const isActive = is_active !== undefined ? (is_active === '1' || is_active === 1 || is_active === true || is_active === 'true') : null;
        const showInMenu = show_in_menu !== undefined ? (show_in_menu === '1' || show_in_menu === 1 || show_in_menu === true || show_in_menu === 'true') : null;
        
        // Логирование для отладки
        console.log('Updating service:', { is_active, show_in_menu, isActive, showInMenu });
        
        // Проверяем уникальность slug, если он изменился
        if (slug && slug !== existing.slug) {
            const slugExists = db.prepare('SELECT id FROM services WHERE slug = ? AND id != ? AND deleted_at IS NULL').get(slug, serviceId);
            if (slugExists) {
                return res.status(409).json({ error: 'Service with this slug already exists' });
            }
        }
        
        // Обрабатываем загруженные файлы
        let heroBackgroundImage = existing.hero_background_image;
        if (req.files?.hero_background_image?.[0]) {
            // Удаляем старое изображение, если есть
            if (heroBackgroundImage && fs.existsSync(path.join(__dirname, '..', '..', heroBackgroundImage))) {
                fs.unlinkSync(path.join(__dirname, '..', '..', heroBackgroundImage));
            }
            heroBackgroundImage = `/uploads/services/${req.files.hero_background_image[0].filename}`;
        }
        
        let introImage = existing.intro_image;
        if (req.files?.intro_image?.[0]) {
            // Удаляем старое изображение, если есть
            if (introImage && fs.existsSync(path.join(__dirname, '..', '..', introImage))) {
                fs.unlinkSync(path.join(__dirname, '..', '..', introImage));
            }
            introImage = `/uploads/services/${req.files.intro_image[0].filename}`;
        }
        
        // Обновляем основную информацию
        const update = db.prepare(`
            UPDATE services 
            SET slug = COALESCE(?, slug),
                hero_title = COALESCE(?, hero_title),
                is_active = COALESCE(?, is_active),
                show_in_menu = COALESCE(?, show_in_menu),
                menu_sort = COALESCE(?, menu_sort),
                meta_title = ?,
                meta_description = ?,
                meta_keywords = ?,
                hero_background_image = COALESCE(?, hero_background_image),
                hero_subtitle = ?,
                hero_button_text = ?,
                hero_button_link = ?,
                intro_title = ?,
                intro_text = ?,
                intro_image = COALESCE(?, intro_image),
                bottom_cta_title = ?,
                bottom_cta_text = ?,
                bottom_cta_button_text = ?,
                bottom_cta_button_link = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        update.run(
            slug || null,
            hero_title || null,
            isActive !== null ? (isActive ? 1 : 0) : null,
            showInMenu !== null ? (showInMenu ? 1 : 0) : null,
            menu_sort !== undefined ? menu_sort : null,
            meta_title !== undefined ? meta_title : null,
            meta_description !== undefined ? meta_description : null,
            meta_keywords !== undefined ? meta_keywords : null,
            heroBackgroundImage !== existing.hero_background_image ? heroBackgroundImage : null,
            hero_subtitle !== undefined ? hero_subtitle : null,
            hero_button_text !== undefined ? hero_button_text : null,
            hero_button_link !== undefined ? hero_button_link : null,
            intro_title !== undefined ? intro_title : null,
            intro_text !== undefined ? intro_text : null,
            introImage !== existing.intro_image ? introImage : null,
            bottom_cta_title !== undefined ? bottom_cta_title : null,
            bottom_cta_text !== undefined ? bottom_cta_text : null,
            bottom_cta_button_text !== undefined ? bottom_cta_button_text : null,
            bottom_cta_button_link !== undefined ? bottom_cta_button_link : null,
            serviceId
        );
        
        // Обновляем преимущества
        try {
            // Удаляем старые преимущества
            db.prepare('DELETE FROM service_advantages WHERE service_id = ?').run(serviceId);
            
            // Добавляем новые
            const advantagesArray = JSON.parse(advantages);
            const insertAdvantage = db.prepare(`
                INSERT INTO service_advantages (service_id, title, text, icon, image, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            advantagesArray.forEach((adv, index) => {
                insertAdvantage.run(
                    serviceId,
                    adv.title || '',
                    adv.text || null,
                    adv.icon || null,
                    adv.image || null,
                    adv.sort_order !== undefined ? adv.sort_order : index
                );
            });
        } catch (e) {
            console.error('Error updating advantages:', e);
        }
        
        // Обновляем фотографии
        try {
            // Удаляем старые фотографии
            db.prepare('DELETE FROM service_photos WHERE service_id = ?').run(serviceId);
            
            // Добавляем новые
            const photosArray = JSON.parse(photos);
            const insertPhoto = db.prepare(`
                INSERT INTO service_photos (service_id, image, caption, sort_order)
                VALUES (?, ?, ?, ?)
            `);
            
            photosArray.forEach((photo, index) => {
                insertPhoto.run(
                    serviceId,
                    photo.image || '',
                    photo.caption || null,
                    photo.sort_order !== undefined ? photo.sort_order : index
                );
            });
        } catch (e) {
            console.error('Error updating photos:', e);
        }
        
        const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
        res.json({
            ...service,
            is_active: Boolean(service.is_active),
            show_in_menu: Boolean(service.show_in_menu)
        });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ error: 'Failed to update service' });
    }
});

/**
 * DELETE /api/services/:id
 * Delete service (soft delete)
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const service = db.prepare('SELECT * FROM services WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
        
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }
        
        // Soft delete
        db.prepare('UPDATE services SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
        
        res.json({ message: 'Service deleted successfully' });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ error: 'Failed to delete service' });
    }
});

module.exports = router;

