<?php
/**
 * Router for /services/:slug pages
 * This file handles requests to /services/:slug and routes them to API
 * Called by .htaccess for Apache, or can be called directly
 */

// Clear any output buffers
while (ob_get_level()) {
    ob_end_clean();
}

// Get the slug from URL
$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);

error_log('services.php - REQUEST_URI: ' . $requestUri);
error_log('services.php - Path: ' . $path);

// Extract slug from /services/:slug
if (preg_match('#^/services/([^/]+)$#', $path, $matches)) {
    $slug = $matches[1];
    error_log('services.php - Extracted slug: ' . $slug);
    
    // Simulate the request as if it came to /api/services/:slug
    $_SERVER['REQUEST_URI'] = '/api/services/' . $slug;
    error_log('services.php - Setting REQUEST_URI to: ' . $_SERVER['REQUEST_URI']);
    
    // Set content type
    if (!headers_sent()) {
        header('Content-Type: text/html; charset=utf-8');
    }
    
    // Include the service page renderer
    require_once __DIR__ . '/api/routes/servicePage.php';
    // servicePage.php will exit, but just in case:
    exit;
} else {
    // If no slug, show 404
    error_log('services.php - No slug found in path: ' . $path);
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title></head><body>';
    echo '<h1>Service not found</h1>';
    echo '<p>Path: ' . htmlspecialchars($path) . '</p>';
    echo '</body></html>';
    exit;
}

