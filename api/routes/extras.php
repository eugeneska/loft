<?php
/**
 * Extras API routes
 */

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', trim($path, '/'));
$id = null;

// Get ID from URL if present
if (isset($segments[1]) && is_numeric($segments[1])) {
    $id = (int)$segments[1];
} elseif (isset($segments[2]) && is_numeric($segments[2])) {
    $id = (int)$segments[2];
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        if ($id) {
            // Get extra by ID
            $extra = $db->fetchOne("SELECT * FROM extras WHERE id = ?", [$id]);
            
            if (!$extra) {
                http_response_code(404);
                echo json_encode(['error' => 'Extra not found']);
                exit;
            }
            
            $extra['is_active'] = (bool)$extra['is_active'];
            echo json_encode($extra, JSON_UNESCAPED_UNICODE);
        } else {
            // Get all extras
            $extras = $db->fetchAll("SELECT * FROM extras ORDER BY sort_order, name");
            
            foreach ($extras as &$extra) {
                $extra['is_active'] = (bool)$extra['is_active'];
            }
            
            echo json_encode($extras, JSON_UNESCAPED_UNICODE);
        }
        break;
        
    case 'POST':
        // Create new extra
        $data = json_decode(file_get_contents('php://input'), true);
        
        $code = $data['code'] ?? null;
        $name = $data['name'] ?? null;
        $description = $data['description'] ?? null;
        $pricingType = $data['pricing_type'] ?? null;
        $isActive = isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1;
        $sortOrder = $data['sort_order'] ?? 0;
        
        if (!$code || !$name || !$pricingType) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        if (!in_array($pricingType, ['fixed', 'per_unit', 'complex'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid pricing_type']);
            exit;
        }
        
        try {
            $db->execute("
                INSERT INTO extras (code, name, description, pricing_type, is_active, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)
            ", [$code, $name, $description, $pricingType, $isActive, $sortOrder]);
            
            $extraId = $db->lastInsertId();
            $extra = $db->fetchOne("SELECT * FROM extras WHERE id = ?", [$extraId]);
            $extra['is_active'] = (bool)$extra['is_active'];
            
            http_response_code(201);
            echo json_encode($extra, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) { // SQLITE_CONSTRAINT_UNIQUE
                http_response_code(409);
                echo json_encode(['error' => 'Extra with this code already exists']);
            } else {
                http_response_code(500);
                error_log('Error creating extra: ' . $e->getMessage());
                echo json_encode(['error' => 'Failed to create extra']);
            }
        }
        break;
        
    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Extra ID required']);
            exit;
        }
        
        // Update extra
        $data = json_decode(file_get_contents('php://input'), true);
        
        $name = $data['name'] ?? null;
        $description = $data['description'] ?? null;
        $pricingType = $data['pricing_type'] ?? null;
        $isActive = isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : null;
        $sortOrder = $data['sort_order'] ?? null;
        
        try {
            $db->execute("
                UPDATE extras 
                SET name = COALESCE(?, name),
                    description = ?,
                    pricing_type = COALESCE(?, pricing_type),
                    is_active = COALESCE(?, is_active),
                    sort_order = COALESCE(?, sort_order),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ", [$name, $description !== null ? $description : null, $pricingType, $isActive, $sortOrder, $id]);
            
            $extra = $db->fetchOne("SELECT * FROM extras WHERE id = ?", [$id]);
            if (!$extra) {
                http_response_code(404);
                echo json_encode(['error' => 'Extra not found']);
                exit;
            }
            
            $extra['is_active'] = (bool)$extra['is_active'];
            echo json_encode($extra, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error updating extra: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to update extra']);
        }
        break;
        
    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Extra ID required']);
            exit;
        }
        
        // Delete extra
        try {
            $rows = $db->execute("DELETE FROM extras WHERE id = ?", [$id]);
            
            if ($rows === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Extra not found']);
            } else {
                echo json_encode(['message' => 'Extra deleted successfully']);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error deleting extra: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to delete extra']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

