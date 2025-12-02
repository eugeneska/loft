<?php
/**
 * Тестовый скрипт для проверки роутера
 * Откройте: http://localhost:8000/test-router.php
 */

echo "<h2>Тест роутера</h2>";

// Симулируем разные запросы
$testUrls = [
    '/services/dag',
    '/api/services/dag',
    '/api/services/public',
    '/api/pricing/halls-pricing',
    '/admin',
    '/index.html'
];

echo "<h3>Проверка парсинга URL:</h3>";
echo "<ul>";

foreach ($testUrls as $url) {
    $_SERVER['REQUEST_URI'] = $url;
    $path = parse_url($url, PHP_URL_PATH);
    
    // Проверка для /services/:slug
    if (preg_match('#^/services/([^/]+)$#', $path, $matches)) {
        $slug = $matches[1];
        echo "<li style='color: green;'>✅ $url → slug: $slug</li>";
    } else {
        echo "<li>$url → не соответствует паттерну /services/:slug</li>";
    }
}

echo "</ul>";

echo "<hr>";
echo "<h3>Проверка работы router.php:</h3>";
echo "<p>Для проверки запустите сервер с роутером:</p>";
echo "<code>php -S localhost:8000 router.php</code>";
echo "<p>Затем откройте: <a href='/services/dag' target='_blank'>/services/dag</a></p>";

