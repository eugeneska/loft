<?php
/**
 * Service Page Renderer
 * Полностью переписанный код для рендеринга страниц услуг
 */

// Подключаем базу данных
require_once __DIR__ . '/../config/database.php';

// Функция для экранирования HTML
function e($text) {
    return htmlspecialchars($text ?? '', ENT_QUOTES, 'UTF-8');
}

// Функция для исправления путей (относительные -> абсолютные)
function fixPath($path) {
    if (!$path) return '';
    if (strpos($path, '/') === 0 || strpos($path, 'http') === 0) {
        return $path; // Уже абсолютный
    }
    return '/' . $path;
}

try {
    // Получаем slug из URL
    $requestUri = $_SERVER['REQUEST_URI'] ?? '';
    $path = parse_url($requestUri, PHP_URL_PATH);
    
    // Логирование для отладки
    error_log('ServicePage - REQUEST_URI: ' . $requestUri);
    error_log('ServicePage - Parsed path: ' . $path);
    
    // Убираем /api если есть
    if (strpos($path, '/api') === 0) {
        $path = substr($path, 4);
        error_log('ServicePage - After removing /api: ' . $path);
    }
    
    // Извлекаем slug: /services/dwg -> dwg
    $slug = null;
    if (preg_match('#/services/([^/]+)$#', $path, $matches)) {
        $slug = $matches[1];
        error_log('ServicePage - Extracted slug: ' . $slug);
    } else {
        error_log('ServicePage - Failed to extract slug from path: ' . $path);
    }
    
    if (!$slug) {
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ошибка</title></head><body>';
        echo '<h1>404 - Страница не найдена</h1>';
        echo '<p>Не удалось определить slug услуги из URL: ' . e($path) . '</p>';
        echo '<p>REQUEST_URI: ' . e($requestUri) . '</p>';
        echo '</body></html>';
        exit;
    }
    
    // Подключаемся к БД
    $db = Database::getInstance();
    
    // Загружаем услугу
    error_log('ServicePage - Looking for service with slug: ' . $slug);
    $service = $db->fetchOne("
        SELECT * FROM services 
        WHERE slug = ? AND is_active = 1 AND deleted_at IS NULL
    ", [$slug]);
    
    if (!$service) {
        // Проверяем, существует ли услуга, но неактивна
        $inactiveService = $db->fetchOne("
            SELECT * FROM services 
            WHERE slug = ? AND deleted_at IS NULL
        ", [$slug]);
        
        error_log('ServicePage - Service not found or inactive. Slug: ' . $slug);
        if ($inactiveService) {
            error_log('ServicePage - Service exists but is_active = ' . ($inactiveService['is_active'] ?? 'NULL'));
        }
        
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ошибка</title></head><body>';
        echo '<h1>404 - Страница не найдена</h1>';
        echo '<p>Услуга с slug "' . e($slug) . '" не найдена или неактивна.</p>';
        if ($inactiveService) {
            echo '<p>Услуга существует, но is_active = ' . ($inactiveService['is_active'] ?? 'NULL') . '</p>';
        }
        echo '</body></html>';
        exit;
    }
    
    error_log('ServicePage - Service found: ' . ($service['hero_title'] ?? 'NO TITLE') . ' (ID: ' . ($service['id'] ?? 'NO ID') . ')');
    
    // Загружаем преимущества
    $advantages = $db->fetchAll("
        SELECT * FROM service_advantages
        WHERE service_id = ?
        ORDER BY sort_order, id
    ", [$service['id']]);
    
    // Загружаем фотографии
    $photos = $db->fetchAll("
        SELECT * FROM service_photos
        WHERE service_id = ?
        ORDER BY sort_order, id
    ", [$service['id']]);
    
    // Загружаем шаблон
    $templatePath = __DIR__ . '/../../service.html';
    if (!file_exists($templatePath)) {
        http_response_code(500);
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ошибка</title></head><body>';
        echo '<h1>500 - Ошибка сервера</h1>';
        echo '<p>Шаблон service.html не найден.</p>';
        echo '</body></html>';
        exit;
    }
    
    $html = file_get_contents($templatePath);
    
    // ========== ЗАМЕНА МЕТА-ТЕГОВ ==========
    $title = e($service['meta_title'] ?? $service['hero_title'] ?? 'Услуга');
    $html = preg_replace('/<title>.*?<\/title>/', "<title>{$title}</title>", $html);
    
    // Meta description
    if ($service['meta_description']) {
        $metaDesc = e($service['meta_description']);
        if (strpos($html, '<meta name="description"') === false) {
            $html = str_replace('<meta name="viewport"', "<meta name=\"description\" content=\"{$metaDesc}\">\n    <meta name=\"viewport\"", $html);
        } else {
            $html = preg_replace('/<meta name="description"[^>]*>/', "<meta name=\"description\" content=\"{$metaDesc}\">", $html);
        }
    }
    
    // Meta keywords
    if ($service['meta_keywords']) {
        $metaKeywords = e($service['meta_keywords']);
        if (strpos($html, '<meta name="keywords"') === false) {
            $html = str_replace('<meta name="description"', "<meta name=\"keywords\" content=\"{$metaKeywords}\">\n    <meta name=\"description\"", $html);
        } else {
            $html = preg_replace('/<meta name="keywords"[^>]*>/', "<meta name=\"keywords\" content=\"{$metaKeywords}\">", $html);
        }
    }
    
    // ========== ЗАМЕНА HERO СЕКЦИИ ==========
    // Фон hero секции
    if ($service['hero_background_image']) {
        $bgImage = fixPath($service['hero_background_image']);
        // Заменяем все упоминания armaloft2.jpg на наше изображение
        $html = preg_replace(
            '/url\(["\']?[^"\']*armaloft2\.jpg["\']?\)/i',
            "url('{$bgImage}')",
            $html
        );
        $html = preg_replace(
            '/background-image:\s*url\([^)]*armaloft2\.jpg[^)]*\)/i',
            "background-image: url('{$bgImage}')",
            $html
        );
    }
    
    // Контент hero секции
    $heroContent = '<h1 class="hero-title">' . e($service['hero_title']) . '</h1>';
    
    if ($service['hero_subtitle']) {
        $heroContent .= "\n            <p class=\"hero-subtitle\" style=\"font-size: 1.5rem; color: #FFFFF0; margin-bottom: 30px;\">" . e($service['hero_subtitle']) . "</p>";
    }
    
    if ($service['hero_button_text'] && $service['hero_button_link']) {
        $heroContent .= "\n            <a href=\"" . e($service['hero_button_link']) . "\" class=\"hero-button\">" . e($service['hero_button_text']) . "</a>";
    }
    
    // Заменяем hero контент
    $html = preg_replace(
        '/<h1 class="hero-title">[\s\S]*?<!-- SERVICE_HERO_CONTENT -->/',
        $heroContent . "\n            <!-- SERVICE_HERO_CONTENT -->",
        $html
    );
    
    // ========== INTRO СЕКЦИЯ ==========
    $introSection = '';
    if ($service['intro_title'] || $service['intro_text'] || $service['intro_image']) {
        $introSection = "\n    <!-- Studio Overview -->\n    <section class=\"studio-overview\">\n        <div class=\"overview-container\">";
        
        if ($service['intro_title']) {
            $introSection .= "\n            <h2 class=\"section-title\">" . e($service['intro_title']) . "</h2>";
        }
        
        if ($service['intro_image']) {
            $introImg = fixPath($service['intro_image']);
            $introSection .= "\n            <div style=\"text-align: center; margin-bottom: 40px;\"><img src=\"" . e($introImg) . "\" alt=\"" . e($service['intro_title'] ?? '') . "\" style=\"max-width: 100%; height: auto; border-radius: 15px;\"></div>";
        }
        
        if ($service['intro_text']) {
            $introSection .= "\n            <div class=\"studio-description\">" . $service['intro_text'] . "</div>";
        }
        
        $introSection .= "\n        </div>\n    </section>";
    }
    $html = str_replace('<!-- SERVICE_INTRO_SECTION -->', $introSection, $html);
    
    // ========== ADVANTAGES СЕКЦИЯ ==========
    $advantagesSection = '';
    if (!empty($advantages)) {
        $advantagesHTML = '';
        foreach ($advantages as $adv) {
            $advantagesHTML .= "\n                <div class=\"service-item\">";
            
            if ($adv['icon']) {
                $advantagesHTML .= "\n                    <div class=\"service-icon\">" . $adv['icon'] . "</div>";
            }
            
            if ($adv['image']) {
                $advImg = fixPath($adv['image']);
                $advantagesHTML .= "\n                    <img src=\"" . e($advImg) . "\" alt=\"" . e($adv['title']) . "\" style=\"width: 60px; height: 60px; margin: 0 auto 20px; display: block; border-radius: 50%;\">";
            }
            
            $advantagesHTML .= "\n                    <h4>" . e($adv['title']) . "</h4>";
            
            if ($adv['text']) {
                $advantagesHTML .= "\n                    <p>" . e($adv['text']) . "</p>";
            }
            
            $advantagesHTML .= "\n                </div>";
        }
        
        $advantagesSection = "\n    <!-- Equipment Section -->\n    <section class=\"equipment-section\">\n        <div class=\"equipment-container\">\n            <div class=\"additional-services\" id=\"equipment-list\">" . $advantagesHTML . "\n            </div>\n        </div>\n    </section>";
    }
    $html = str_replace('<!-- SERVICE_ADVANTAGES_SECTION -->', $advantagesSection, $html);
    
    // ========== PHOTOS GALLERY ==========
    $photosSection = '';
    if (!empty($photos)) {
        $photosHTML = '';
        foreach ($photos as $photo) {
            $photoImg = fixPath($photo['image']);
            $photosHTML .= "\n                <div class=\"level-image\">\n                    <img src=\"" . e($photoImg) . "\" alt=\"" . e($photo['caption'] ?? '') . "\">";
            
            if ($photo['caption']) {
                $photosHTML .= "\n                    <div style=\"padding: 10px; text-align: center; color: #FFFFF0; font-size: 0.9rem;\">" . e($photo['caption']) . "</div>";
            }
            
            $photosHTML .= "\n                </div>";
        }
        
        $photosSection = "\n    <!-- Photos Gallery -->\n    <section class=\"levels-section\">\n        <div class=\"levels-container\">\n            <div class=\"level-images\" style=\"grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;\">" . $photosHTML . "\n            </div>\n        </div>\n    </section>";
    }
    $html = str_replace('<!-- SERVICE_PHOTOS_SECTION -->', $photosSection, $html);
    
    // ========== CTA СЕКЦИЯ ==========
    $ctaSection = '';
    if ($service['bottom_cta_title'] || $service['bottom_cta_text'] || 
        ($service['bottom_cta_button_text'] && $service['bottom_cta_button_link'])) {
        $ctaSection = "\n    <!-- CTA Section -->\n    <section class=\"cta\">\n        <div class=\"equipment-container\">";
        
        if ($service['bottom_cta_title']) {
            $ctaSection .= "\n            <h2 class=\"cta-title\">" . e($service['bottom_cta_title']) . "</h2>";
        }
        
        if ($service['bottom_cta_text']) {
            $ctaSection .= "\n            <p class=\"cta-description\">" . e($service['bottom_cta_text']) . "</p>";
        }
        
        if ($service['bottom_cta_button_text'] && $service['bottom_cta_button_link']) {
            $ctaSection .= "\n            <a href=\"" . e($service['bottom_cta_button_link']) . "\" class=\"cta-button\">" . e($service['bottom_cta_button_text']) . "</a>";
        }
        
        $ctaSection .= "\n        </div>\n    </section>";
    }
    $html = str_replace('<!-- SERVICE_CTA_SECTION -->', $ctaSection, $html);
    
    // ========== ИСПРАВЛЕНИЕ ПУТЕЙ ==========
    // Добавляем base tag для правильной работы относительных путей
    if (strpos($html, '<base') === false) {
        $html = str_replace('<head>', "<head>\n    <base href=\"/\">", $html);
    }
    
    // Исправляем все относительные пути на абсолютные
    // JS файлы
    $html = preg_replace('/(src|href)=["\'](js\/|css\/|images\/|img\/|video\/|uploads\/|photos\/)/', '$1="/$2', $html);
    
    // Script теги
    $html = preg_replace('/<script([^>]*)\ssrc=["\'](?!\/|http|https|data:)([^"\']+)["\']/i', '<script$1 src="/$3"', $html);
    
    // Link теги
    $html = preg_replace('/<link([^>]*)\shref=["\'](?!\/|http|https|data:)([^"\']+)["\']/i', '<link$1 href="/$3"', $html);
    
    // Img теги
    $html = preg_replace('/<img([^>]*)\ssrc=["\'](?!\/|http|https|data:)([^"\']+)["\']/i', '<img$1 src="/$3"', $html);
    
    // Остальные относительные пути
    $html = preg_replace('/(src|href)=["\'](?!\/|http|https|#|mailto:|data:)([^"\']+)/', '$1="/$3"', $html);
    
    // Убеждаемся, что services-menu.js подключен с абсолютным путем
    // Удаляем все вхождения services-menu.js (могут быть относительные)
    $html = preg_replace('/<script[^>]*src=["\']?[^"\']*services-menu\.js["\']?[^>]*><\/script>\s*/i', '', $html);
    // Добавляем с абсолютным путем перед </body>
    if (strpos($html, 'services-menu.js') === false) {
        $html = str_replace('</body>', "    <script src=\"/js/services-menu.js\"></script>\n</body>", $html);
    }
    
    // ========== ВЫВОД HTML ==========
    // Очищаем все буферы вывода ПЕРЕД установкой заголовков
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    // Устанавливаем заголовки ПЕРЕД выводом
    if (!headers_sent()) {
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
    }
    
    // Выводим HTML
    echo $html;
    
    // Принудительно очищаем все буферы
    if (ob_get_level()) {
        ob_end_flush();
    }
    
    // КРИТИЧЕСКИ ВАЖНО: Завершаем выполнение немедленно
    // Это предотвращает дальнейшую обработку роутером
    // Используем exit(0) для гарантированного завершения
    exit(0);
    
} catch (Exception $e) {
    // Обработка ошибок
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ошибка</title></head><body>';
    echo '<h1>500 - Ошибка сервера</h1>';
    echo '<p>' . e($e->getMessage()) . '</p>';
    if (isset($slug)) {
        echo '<p>Slug: ' . e($slug) . '</p>';
    }
    echo '</body></html>';
    exit(1);
}
