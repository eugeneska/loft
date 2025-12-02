<?php
/**
 * Services API routes
 */

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();

// Parse the path correctly (router already removed /api)
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Remove /api if present
if (strpos($path, '/api') === 0) {
    $path = substr($path, 4);
}

// Remove leading slash
$path = ltrim($path, '/');

// Split into segments
$segments = explode('/', $path);

// Find 'services' in the path and get what comes after
$servicesIndex = array_search('services', $segments);
if ($servicesIndex !== false && isset($segments[$servicesIndex + 1])) {
    $nextSegment = $segments[$servicesIndex + 1];
} else {
    $nextSegment = null;
}

// Helper function to generate slug
function generateSlug($text) {
    $text = mb_strtolower(trim($text));
    $text = preg_replace('/[^\w\s-]/u', '', $text);
    $text = preg_replace('/[\s_-]+/', '-', $text);
    $text = trim($text, '-');
    return $text;
}

// Helper function to handle file upload
function handleFileUpload($fieldName, $uploadDir) {
    if (!isset($_FILES[$fieldName]) || $_FILES[$fieldName]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }
    
    $file = $_FILES[$fieldName];
    
    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowedTypes)) {
        return null;
    }
    
    // Validate extension
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array($ext, $allowedExts)) {
        return null;
    }
    
    // Create upload directory if it doesn't exist
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Generate unique filename
    $filename = 'service-' . time() . '-' . mt_rand(100000000, 999999999) . '.' . $ext;
    $filepath = $uploadDir . '/' . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $filepath)) {
        return '/uploads/services/' . $filename;
    }
    
    return null;
}

// Determine route
$subRoute = null;
$id = null;
$slug = null;

if ($nextSegment) {
    if ($nextSegment === 'public') {
        $subRoute = 'public';
    } elseif ($nextSegment === 'admin' && isset($segments[$servicesIndex + 2])) {
        $subRoute = 'admin';
        $id = (int)$segments[$servicesIndex + 2];
    } elseif (is_numeric($nextSegment)) {
        $id = (int)$nextSegment;
    } else {
        $slug = $nextSegment;
    }
}

// Handle _method override for PUT requests sent as POST (to work around PHP multipart/form-data limitation)
$requestMethod = $_SERVER['REQUEST_METHOD'];
if ($requestMethod === 'POST' && isset($_POST['_method']) && $_POST['_method'] === 'PUT') {
    $requestMethod = 'PUT';
    unset($_POST['_method']); // Remove _method from data
}

switch ($requestMethod) {
    case 'GET':
        if ($subRoute === 'public') {
            // Get active services for public menu
            $services = $db->fetchAll("
                SELECT id, slug, hero_title, menu_sort
                FROM services
                WHERE is_active = 1 AND show_in_menu = 1 AND deleted_at IS NULL
                ORDER BY menu_sort, id
            ");
            echo json_encode($services, JSON_UNESCAPED_UNICODE);
        } elseif ($subRoute === 'admin' && $id) {
            // Get service by ID (for admin)
            $service = $db->fetchOne("SELECT * FROM services WHERE id = ? AND deleted_at IS NULL", [$id]);
            
            if (!$service) {
                http_response_code(404);
                echo json_encode(['error' => 'Service not found']);
                exit;
            }
            
            $advantages = $db->fetchAll("
                SELECT * FROM service_advantages
                WHERE service_id = ?
                ORDER BY sort_order, id
            ", [$id]);
            
            $photos = $db->fetchAll("
                SELECT * FROM service_photos
                WHERE service_id = ?
                ORDER BY sort_order, id
            ", [$id]);
            
            $service['is_active'] = (bool)$service['is_active'];
            $service['show_in_menu'] = (bool)$service['show_in_menu'];
            $service['advantages'] = $advantages;
            $service['photos'] = $photos;
            
            echo json_encode($service, JSON_UNESCAPED_UNICODE);
        } elseif ($slug) {
            // Get service by slug (public)
            $service = $db->fetchOne("
                SELECT * FROM services 
                WHERE slug = ? AND is_active = 1 AND deleted_at IS NULL
            ", [$slug]);
            
            if (!$service) {
                http_response_code(404);
                echo json_encode(['error' => 'Service not found']);
                exit;
            }
            
            $advantages = $db->fetchAll("
                SELECT * FROM service_advantages
                WHERE service_id = ?
                ORDER BY sort_order, id
            ", [$service['id']]);
            
            $photos = $db->fetchAll("
                SELECT * FROM service_photos
                WHERE service_id = ?
                ORDER BY sort_order, id
            ", [$service['id']]);
            
            $service['is_active'] = (bool)$service['is_active'];
            $service['show_in_menu'] = (bool)$service['show_in_menu'];
            $service['advantages'] = $advantages;
            $service['photos'] = $photos;
            
            echo json_encode($service, JSON_UNESCAPED_UNICODE);
        } else {
            // Get all services (for admin)
            $isActive = $_GET['is_active'] ?? null;
            $search = $_GET['search'] ?? null;
            
            $query = "SELECT * FROM services WHERE deleted_at IS NULL";
            $params = [];
            
            if ($isActive !== null) {
                $query .= " AND is_active = ?";
                $params[] = $isActive === 'true' ? 1 : 0;
            }
            
            if ($search) {
                $query .= " AND (hero_title LIKE ? OR slug LIKE ?)";
                $searchTerm = "%{$search}%";
                $params[] = $searchTerm;
                $params[] = $searchTerm;
            }
            
            $query .= " ORDER BY menu_sort, id";
            
            $services = $db->fetchAll($query, $params);
            
            foreach ($services as &$service) {
                $service['is_active'] = (bool)$service['is_active'];
                $service['show_in_menu'] = (bool)$service['show_in_menu'];
            }
            
            echo json_encode($services, JSON_UNESCAPED_UNICODE);
        }
        break;
        
    case 'POST':
        // Create new service
        $uploadDir = __DIR__ . '/../../uploads/services';
        
        // Handle file uploads
        $heroBackgroundImage = handleFileUpload('hero_background_image', $uploadDir);
        $introImage = handleFileUpload('intro_image', $uploadDir);
        
        // Get form data (can be JSON or form-data)
        if ($_SERVER['CONTENT_TYPE'] && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) {
            $data = json_decode(file_get_contents('php://input'), true);
        } else {
            // Form data
            $data = $_POST;
            if (isset($data['advantages'])) {
                $data['advantages'] = is_string($data['advantages']) ? json_decode($data['advantages'], true) : $data['advantages'];
            }
            if (isset($data['photos'])) {
                $data['photos'] = is_string($data['photos']) ? json_decode($data['photos'], true) : $data['photos'];
            }
        }
        
        $slug = $data['slug'] ?? null;
        $heroTitle = $data['hero_title'] ?? null;
        $isActive = isset($data['is_active']) ? 
            ($data['is_active'] === '1' || $data['is_active'] === 1 || $data['is_active'] === true || $data['is_active'] === 'true') : 
            false;
        $showInMenu = isset($data['show_in_menu']) ? 
            ($data['show_in_menu'] === '1' || $data['show_in_menu'] === 1 || $data['show_in_menu'] === true || $data['show_in_menu'] === 'true') : 
            false;
        $menuSort = $data['menu_sort'] ?? 500;
        
        // Generate slug if not provided
        if (!$slug && $heroTitle) {
            $slug = generateSlug($heroTitle);
        }
        
        if (!$slug) {
            http_response_code(400);
            echo json_encode(['error' => 'Slug or hero_title required']);
            exit;
        }
        
        // Check uniqueness
        $existing = $db->fetchOne("SELECT id FROM services WHERE slug = ? AND deleted_at IS NULL", [$slug]);
        if ($existing) {
            http_response_code(409);
            echo json_encode(['error' => 'Service with this slug already exists']);
            exit;
        }
        
        try {
            $db->execute("
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
            ", [
                $slug, $isActive ? 1 : 0, $showInMenu ? 1 : 0, $menuSort,
                $data['meta_title'] ?? null,
                $data['meta_description'] ?? null,
                $data['meta_keywords'] ?? null,
                $heroBackgroundImage,
                $heroTitle,
                $data['hero_subtitle'] ?? null,
                $data['hero_button_text'] ?? null,
                $data['hero_button_link'] ?? null,
                $data['intro_title'] ?? null,
                $data['intro_text'] ?? null,
                $introImage,
                $data['bottom_cta_title'] ?? null,
                $data['bottom_cta_text'] ?? null,
                $data['bottom_cta_button_text'] ?? null,
                $data['bottom_cta_button_link'] ?? null
            ]);
            
            $serviceId = $db->lastInsertId();
            
            // Save advantages
            if (isset($data['advantages']) && is_array($data['advantages'])) {
                foreach ($data['advantages'] as $index => $adv) {
                    $db->execute("
                        INSERT INTO service_advantages (service_id, title, text, icon, image, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ", [
                        $serviceId,
                        $adv['title'] ?? '',
                        $adv['text'] ?? null,
                        $adv['icon'] ?? null,
                        $adv['image'] ?? null,
                        $adv['sort_order'] ?? $index
                    ]);
                }
            }
            
            // Save photos
            if (isset($data['photos']) && is_array($data['photos'])) {
                foreach ($data['photos'] as $index => $photo) {
                    $db->execute("
                        INSERT INTO service_photos (service_id, image, caption, sort_order)
                        VALUES (?, ?, ?, ?)
                    ", [
                        $serviceId,
                        $photo['image'] ?? '',
                        $photo['caption'] ?? null,
                        $photo['sort_order'] ?? $index
                    ]);
                }
            }
            
            $service = $db->fetchOne("SELECT * FROM services WHERE id = ?", [$serviceId]);
            $service['is_active'] = (bool)$service['is_active'];
            $service['show_in_menu'] = (bool)$service['show_in_menu'];
            
            http_response_code(201);
            echo json_encode($service, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error creating service: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to create service']);
        }
        break;
        
    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Service ID required']);
            exit;
        }
        
        // Update service
        $existing = $db->fetchOne("SELECT * FROM services WHERE id = ? AND deleted_at IS NULL", [$id]);
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Service not found']);
            exit;
        }
        
        $uploadDir = __DIR__ . '/../../uploads/services';
        
        // Handle file uploads
        $heroBackgroundImage = $existing['hero_background_image'];
        if (isset($_FILES['hero_background_image'])) {
            $newImage = handleFileUpload('hero_background_image', $uploadDir);
            if ($newImage) {
                // Delete old image
                if ($heroBackgroundImage && file_exists(__DIR__ . '/../..' . $heroBackgroundImage)) {
                    unlink(__DIR__ . '/../..' . $heroBackgroundImage);
                }
                $heroBackgroundImage = $newImage;
            }
        }
        
        $introImage = $existing['intro_image'];
        if (isset($_FILES['intro_image'])) {
            $newImage = handleFileUpload('intro_image', $uploadDir);
            if ($newImage) {
                // Delete old image
                if ($introImage && file_exists(__DIR__ . '/../..' . $introImage)) {
                    unlink(__DIR__ . '/../..' . $introImage);
                }
                $introImage = $newImage;
            }
        }
        
        // Get form data - now using POST, so $_POST should be populated
        $data = [];
        
        if ($_SERVER['CONTENT_TYPE'] && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) {
            $data = json_decode(file_get_contents('php://input'), true);
        } else {
            // FormData sends as multipart/form-data, $_POST should be populated for POST requests
            $data = $_POST;
            
            // Debug logging
            error_log('PUT Service (via POST) - Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'NOT SET'));
            error_log('PUT Service (via POST) - $_POST: ' . print_r($_POST, true));
            error_log('PUT Service (via POST) - is_active: ' . (isset($_POST['is_active']) ? $_POST['is_active'] : 'NOT SET'));
            error_log('PUT Service (via POST) - show_in_menu: ' . (isset($_POST['show_in_menu']) ? $_POST['show_in_menu'] : 'NOT SET'));
            
            if (isset($data['advantages'])) {
                $data['advantages'] = is_string($data['advantages']) ? json_decode($data['advantages'], true) : $data['advantages'];
            }
            if (isset($data['photos'])) {
                $data['photos'] = is_string($data['photos']) ? json_decode($data['photos'], true) : $data['photos'];
            }
        }
        
        $slug = $data['slug'] ?? null;
        
        // Debug logging for checkbox values
        error_log('PUT Service - Processing checkboxes:');
        error_log('  is_active in data: ' . (isset($data['is_active']) ? var_export($data['is_active'], true) : 'NOT SET'));
        error_log('  show_in_menu in data: ' . (isset($data['show_in_menu']) ? var_export($data['show_in_menu'], true) : 'NOT SET'));
        
        // Always process checkboxes - if not set, default to false
        $isActive = isset($data['is_active']) ? 
            ($data['is_active'] === '1' || $data['is_active'] === 1 || $data['is_active'] === true || $data['is_active'] === 'true') : 
            false;
        $showInMenu = isset($data['show_in_menu']) ? 
            ($data['show_in_menu'] === '1' || $data['show_in_menu'] === 1 || $data['show_in_menu'] === true || $data['show_in_menu'] === 'true') : 
            false;
        
        error_log('PUT Service - Final values: is_active=' . ($isActive ? '1' : '0') . ', show_in_menu=' . ($showInMenu ? '1' : '0'));
        
        // Check slug uniqueness if changed
        if ($slug && $slug !== $existing['slug']) {
            $slugExists = $db->fetchOne("SELECT id FROM services WHERE slug = ? AND id != ? AND deleted_at IS NULL", [$slug, $id]);
            if ($slugExists) {
                http_response_code(409);
                echo json_encode(['error' => 'Service with this slug already exists']);
                exit;
            }
        }
        
        try {
            $db->execute("
                UPDATE services 
                SET slug = COALESCE(?, slug),
                    hero_title = COALESCE(?, hero_title),
                    is_active = ?,
                    show_in_menu = ?,
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
            ", [
                $slug, $data['hero_title'] ?? null,
                $isActive ? 1 : 0,
                $showInMenu ? 1 : 0,
                $data['menu_sort'] ?? null,
                $data['meta_title'] ?? null,
                $data['meta_description'] ?? null,
                $data['meta_keywords'] ?? null,
                $heroBackgroundImage !== $existing['hero_background_image'] ? $heroBackgroundImage : null,
                $data['hero_subtitle'] ?? null,
                $data['hero_button_text'] ?? null,
                $data['hero_button_link'] ?? null,
                $data['intro_title'] ?? null,
                $data['intro_text'] ?? null,
                $introImage !== $existing['intro_image'] ? $introImage : null,
                $data['bottom_cta_title'] ?? null,
                $data['bottom_cta_text'] ?? null,
                $data['bottom_cta_button_text'] ?? null,
                $data['bottom_cta_button_link'] ?? null,
                $id
            ]);
            
            // Update advantages
            if (isset($data['advantages']) && is_array($data['advantages'])) {
                $db->execute("DELETE FROM service_advantages WHERE service_id = ?", [$id]);
                foreach ($data['advantages'] as $index => $adv) {
                    $db->execute("
                        INSERT INTO service_advantages (service_id, title, text, icon, image, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ", [
                        $id, $adv['title'] ?? '', $adv['text'] ?? null,
                        $adv['icon'] ?? null, $adv['image'] ?? null,
                        $adv['sort_order'] ?? $index
                    ]);
                }
            }
            
            // Update photos
            if (isset($data['photos']) && is_array($data['photos'])) {
                $db->execute("DELETE FROM service_photos WHERE service_id = ?", [$id]);
                foreach ($data['photos'] as $index => $photo) {
                    $db->execute("
                        INSERT INTO service_photos (service_id, image, caption, sort_order)
                        VALUES (?, ?, ?, ?)
                    ", [
                        $id, $photo['image'] ?? '', $photo['caption'] ?? null,
                        $photo['sort_order'] ?? $index
                    ]);
                }
            }
            
            $service = $db->fetchOne("SELECT * FROM services WHERE id = ?", [$id]);
            $service['is_active'] = (bool)$service['is_active'];
            $service['show_in_menu'] = (bool)$service['show_in_menu'];
            
            echo json_encode($service, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error updating service: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to update service']);
        }
        break;
        
    case 'DELETE':
        if (!$id) {
            $id = isset($segments[1]) && is_numeric($segments[1]) ? (int)$segments[1] : null;
        }
        
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Service ID required']);
            exit;
        }
        
        // Soft delete
        try {
            $service = $db->fetchOne("SELECT * FROM services WHERE id = ? AND deleted_at IS NULL", [$id]);
            if (!$service) {
                http_response_code(404);
                echo json_encode(['error' => 'Service not found']);
                exit;
            }
            
            $db->execute("UPDATE services SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [$id]);
            echo json_encode(['message' => 'Service deleted successfully']);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error deleting service: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to delete service']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

