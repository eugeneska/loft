<?php
/**
 * Router for PHP built-in server
 * Use: php -S localhost:8000 router.php
 * 
 * This router handles:
 * - /services/:slug -> service pages
 * - /api/* -> API requests
 * - /admin/* -> admin panel
 * - Static files -> serve directly
 * - Everything else -> index.html
 */

$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);

// Remove query string for routing
$pathWithoutQuery = $path;

// Debug logging
error_log('=== Router START ===');
error_log('Router - Request URI: ' . $requestUri);
error_log('Router - Path: ' . $pathWithoutQuery);

// Handle /api/* requests FIRST (before static files)
if (strpos($pathWithoutQuery, '/api') === 0) {
    require_once __DIR__ . '/api/index.php';
    exit;
}

// Handle /admin/* requests - let PHP serve admin files normally
if (strpos($pathWithoutQuery, '/admin') === 0) {
    return false;
}

// Handle /services/:slug - service pages (BEFORE static files check!)
if (preg_match('#^/services/([^/]+)$#', $pathWithoutQuery, $matches)) {
    $slug = $matches[1];
    error_log('Router - Matched /services/:slug, slug: ' . $slug);
    
    // Clear any previous output buffers
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    // Simulate request to /api/services/:slug
    $_SERVER['REQUEST_URI'] = '/api/services/' . $slug;
    error_log('Router - Setting REQUEST_URI to: ' . $_SERVER['REQUEST_URI']);
    
    // Set headers before including
    if (!headers_sent()) {
        header('Content-Type: text/html; charset=utf-8');
    }
    
    // Include servicePage.php - it will handle everything and exit
    require_once __DIR__ . '/api/routes/servicePage.php';
    
    // If we get here, something went wrong (servicePage.php should exit)
    error_log('Router - ERROR: servicePage.php did not exit! This should never happen.');
    http_response_code(500);
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ошибка</title></head><body>';
    echo '<h1>Ошибка сервера</h1>';
    echo '<p>servicePage.php не завершил выполнение правильно.</p>';
    echo '</body></html>';
    exit(1);
}

// Handle static files (images, CSS, JS, etc.) - AFTER routing checks
$filePath = __DIR__ . $pathWithoutQuery;
if (file_exists($filePath) && is_file($filePath)) {
    // Check if it's a static file extension
    $ext = strtolower(pathinfo($pathWithoutQuery, PATHINFO_EXTENSION));
    $staticExtensions = ['js', 'css', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'mp4', 'webm', 'pdf', 'zip'];
    if (in_array($ext, $staticExtensions)) {
        // Set appropriate content type
        $contentTypes = [
            'js' => 'application/javascript',
            'css' => 'text/css',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'ico' => 'image/x-icon',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf' => 'font/ttf',
            'eot' => 'application/vnd.ms-fontobject',
            'mp4' => 'video/mp4',
            'webm' => 'video/webm',
            'pdf' => 'application/pdf',
            'zip' => 'application/zip'
        ];
        if (isset($contentTypes[$ext])) {
            header('Content-Type: ' . $contentTypes[$ext]);
        }
        // Let PHP built-in server serve the file
        return false;
    }
}

// For root path, serve index.html (BEFORE checking for files)
if ($pathWithoutQuery === '/' || $pathWithoutQuery === '') {
    error_log('Router - Serving root path, returning index.html');
    if (file_exists(__DIR__ . '/index.html')) {
        readfile(__DIR__ . '/index.html');
        exit;
    }
}

// Handle PHP files directly
if (file_exists(__DIR__ . $pathWithoutQuery . '.php')) {
    return false; // Let PHP serve the file
}

// For HTML files, serve them directly
if (preg_match('/\.html$/', $pathWithoutQuery)) {
    if (file_exists(__DIR__ . $pathWithoutQuery)) {
        return false; // Let PHP serve the file
    }
}

// For unknown paths that are not files, show 404
// This prevents redirecting /services/:slug to index.html
if (!file_exists(__DIR__ . $pathWithoutQuery)) {
    error_log('Router - Path not found: ' . $pathWithoutQuery);
    error_log('Router - File does not exist: ' . __DIR__ . $pathWithoutQuery);
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title></head><body>';
    echo '<h1>404 - Page not found</h1>';
    echo '<p>Path: ' . htmlspecialchars($pathWithoutQuery) . '</p>';
    echo '<p>If you expected a service page, check that the service exists and is active.</p>';
    echo '<p>Router debug: This path was not matched by any route handler.</p>';
    echo '</body></html>';
    exit;
}

error_log('Router - Falling through to default handler for: ' . $pathWithoutQuery);
error_log('=== Router END ===');
return false;

