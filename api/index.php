<?php
/**
 * Main API router
 * Handles all API requests
 */

require_once __DIR__ . '/config/database.php';

// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
// Content-Type will be set per route (JSON for API, HTML for pages)

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get request URI and method
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Remove query string
$path = parse_url($requestUri, PHP_URL_PATH);

// Remove base path if needed (adjust if your API is in subdirectory)
$basePath = '/api';
if (strpos($path, $basePath) === 0) {
    $path = substr($path, strlen($basePath));
}

// Remove leading slash
$path = ltrim($path, '/');

// Split path into segments
$segments = explode('/', $path);

// Route to appropriate handler
try {
    if (empty($segments[0])) {
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
        exit;
    }

    $route = $segments[0];
    $id = $segments[1] ?? null;
    $subRoute = $segments[1] ?? null;
    
    // Route mapping
    switch ($route) {
        case 'pricing':
            require_once __DIR__ . '/routes/pricingApi.php';
            break;
            
        case 'halls':
            require_once __DIR__ . '/routes/halls.php';
            break;
            
        case 'price-sets':
            require_once __DIR__ . '/routes/priceSets.php';
            break;
            
        case 'hall-prices':
            require_once __DIR__ . '/routes/hallPrices.php';
            break;
            
        case 'extras':
            require_once __DIR__ . '/routes/extras.php';
            break;
            
        case 'extras-prices':
            require_once __DIR__ . '/routes/extrasPrices.php';
            break;
            
        case 'season-rules':
            require_once __DIR__ . '/routes/seasonRules.php';
            break;
            
        case 'auth':
            require_once __DIR__ . '/routes/auth.php';
            break;
            
        case 'merchant':
            require_once __DIR__ . '/routes/merchant.php';
            break;
            
        case 'booking':
            require_once __DIR__ . '/routes/booking.php';
            break;
            
        case 'settings':
            require_once __DIR__ . '/routes/settings.php';
            break;
            
        case 'services':
            // Check if this is a page request (not API)
            // If subRoute is not 'public', 'admin', or numeric, it's likely a slug (page request)
            if ($subRoute && $subRoute !== 'public' && $subRoute !== 'admin' && !is_numeric($subRoute)) {
                // This is a service page request, render HTML
                // Clear any output buffers
                while (ob_get_level()) {
                    ob_end_clean();
                }
                // Set HTML content type
                if (!headers_sent()) {
                    header('Content-Type: text/html; charset=utf-8');
                }
                require_once __DIR__ . '/routes/servicePage.php';
                // servicePage.php will exit, but just in case:
                exit;
            } else {
                // This is an API request
                if (!headers_sent()) {
                    header('Content-Type: application/json; charset=utf-8');
                }
                require_once __DIR__ . '/routes/services.php';
            }
            break;
            
        case 'health':
            echo json_encode(['status' => 'ok', 'timestamp' => date('c')]);
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Route not found']);
    }
} catch (Exception $e) {
    http_response_code(500);
    error_log('API Error: ' . $e->getMessage());
    echo json_encode(['error' => 'Internal server error']);
}

