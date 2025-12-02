const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getDatabase } = require('../database');

/**
 * Экранирование HTML для безопасности
 */
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * GET /services/:slug
 * Render service page
 */
router.get('/:slug', (req, res) => {
    try {
        const db = getDatabase();
        const service = db.prepare(`
            SELECT * FROM services 
            WHERE slug = ? AND is_active = 1 AND deleted_at IS NULL
        `).get(req.params.slug);
        
        if (!service) {
            return res.status(404).send('Service not found');
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
        
        // Читаем шаблон service.html
        const templatePath = path.join(__dirname, '..', '..', 'service.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // Заменяем title
        html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(service.meta_title || service.hero_title || 'Услуга')}</title>`);
        
        // Meta tags
        if (service.meta_description) {
            html = html.replace(/<meta name="viewport"/, `<meta name="description" content="${escapeHtml(service.meta_description)}">\n    <meta name="viewport"`);
        }
        if (service.meta_keywords) {
            html = html.replace(/<meta name="description"/, `<meta name="keywords" content="${escapeHtml(service.meta_keywords)}">\n    <meta name="description"`);
        }
        
        // Hero section
        if (service.hero_background_image) {
            html = html.replace(/url\('photos\/armaloft\/armaloft2\.jpg'\)/, `url('${service.hero_background_image}')`);
        }
        
        // Hero section - заменяем весь контент hero
        let heroContent = `<h1 class="hero-title">${escapeHtml(service.hero_title || '')}</h1>`;
        
        // Hero subtitle
        if (service.hero_subtitle) {
            heroContent += `\n            <p class="hero-subtitle" style="font-size: 1.5rem; color: #FFFFF0; margin-bottom: 30px;">${escapeHtml(service.hero_subtitle)}</p>`;
        }
        
        // Hero button
        if (service.hero_button_text && service.hero_button_link) {
            heroContent += `\n            <a href="${escapeHtml(service.hero_button_link)}" class="hero-button">${escapeHtml(service.hero_button_text)}</a>`;
        }
        
        // Заменяем весь контент hero-content (от h1 до комментария)
        const heroPattern = /<h1 class="hero-title">[\s\S]*?<!-- SERVICE_HERO_CONTENT -->/;
        if (heroPattern.test(html)) {
            html = html.replace(heroPattern, heroContent);
        } else {
            // Fallback: заменяем только заголовок и удаляем старую кнопку
            html = html.replace(/<h1 class="hero-title">.*?<\/h1>/, heroContent);
            html = html.replace(/<a href="#levels-section" class="hero-button">.*?<\/a>/, '');
            html = html.replace(/<a href="[^"]*" class="hero-button">.*?<\/a>/, '');
        }
        
        // Intro Section (показываем только если есть данные)
        let introSection = '';
        if (service.intro_title || service.intro_text) {
            introSection = `
    <!-- Studio Overview -->
    <section class="studio-overview">
        <div class="overview-container">
            ${service.intro_title ? `<h2 class="section-title">${escapeHtml(service.intro_title)}</h2>` : ''}
            ${service.intro_image ? `<div style="text-align: center; margin-bottom: 40px;"><img src="${service.intro_image}" alt="${escapeHtml(service.intro_title || '')}" style="max-width: 100%; height: auto; border-radius: 15px;"></div>` : ''}
            ${service.intro_text ? `<div class="studio-description">${service.intro_text}</div>` : ''}
        </div>
    </section>`;
        }
        html = html.replace(/<!-- SERVICE_INTRO_SECTION -->/, introSection);
        
        // Advantages Section (показываем только если есть преимущества)
        let advantagesSection = '';
        if (advantages && advantages.length > 0) {
            const advantagesHTML = advantages.map(adv => `
                <div class="service-item">
                    ${adv.icon ? `<div class="service-icon">${adv.icon}</div>` : ''}
                    ${adv.image ? `<img src="${adv.image}" alt="${escapeHtml(adv.title)}" style="width: 60px; height: 60px; margin: 0 auto 20px; display: block; border-radius: 50%;">` : ''}
                    <h4>${escapeHtml(adv.title)}</h4>
                    ${adv.text ? `<p>${escapeHtml(adv.text)}</p>` : ''}
                </div>
            `).join('');
            
            advantagesSection = `
    <!-- Equipment Section -->
    <section class="equipment-section">
        <div class="equipment-container">
            <div class="additional-services" id="equipment-list">
                ${advantagesHTML}
            </div>
        </div>
    </section>`;
        }
        html = html.replace(/<!-- SERVICE_ADVANTAGES_SECTION -->/, advantagesSection);
        
        // Photos Gallery (показываем только если есть фотографии)
        let photosSection = '';
        if (photos && photos.length > 0) {
            const photosHTML = photos.map(photo => `
                <div class="level-image">
                    <img src="${photo.image}" alt="${escapeHtml(photo.caption || '')}">
                    ${photo.caption ? `<div style="padding: 10px; text-align: center; color: #FFFFF0; font-size: 0.9rem;">${escapeHtml(photo.caption)}</div>` : ''}
                </div>
            `).join('');
            
            photosSection = `
    <!-- Photos Gallery -->
    <section class="levels-section">
        <div class="levels-container">
            <div class="level-images" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                ${photosHTML}
            </div>
        </div>
    </section>`;
        }
        html = html.replace(/<!-- SERVICE_PHOTOS_SECTION -->/, photosSection);
        
        // CTA Section (показываем только если есть данные)
        let ctaSection = '';
        if (service.bottom_cta_title || service.bottom_cta_text || (service.bottom_cta_button_text && service.bottom_cta_button_link)) {
            ctaSection = `
    <!-- CTA Section -->
    <section class="cta">
        <div class="equipment-container">
            ${service.bottom_cta_title ? `<h2 class="cta-title">${escapeHtml(service.bottom_cta_title)}</h2>` : ''}
            ${service.bottom_cta_text ? `<p class="cta-description">${escapeHtml(service.bottom_cta_text)}</p>` : ''}
            ${service.bottom_cta_button_text && service.bottom_cta_button_link ? `<a href="${escapeHtml(service.bottom_cta_button_link)}" class="cta-button">${escapeHtml(service.bottom_cta_button_text)}</a>` : ''}
        </div>
    </section>`;
        }
        html = html.replace(/<!-- SERVICE_CTA_SECTION -->/, ctaSection);
        
        // Добавляем скрипт для динамического меню услуг перед закрывающим тегом body
        // Удаляем старый скрипт, если есть
        html = html.replace(/<script[^>]*services-menu\.js[^>]*><\/script>\s*/gi, '');
        
        // Добавляем скрипт перед закрывающим тегом body
        if (!html.includes('services-menu.js')) {
            html = html.replace(/<\/body>/, '    <script src="/js/services-menu.js"></script>\n</body>');
        }
        
        res.send(html);
    } catch (error) {
        console.error('Error rendering service page:', error);
        res.status(500).send('Error loading service page');
    }
});

module.exports = router;
