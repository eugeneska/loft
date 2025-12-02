<?php
/**
 * Halls API routes
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
            // Get hall by ID
            $hall = $db->fetchOne("SELECT * FROM halls WHERE id = ?", [$id]);
            
            if (!$hall) {
                http_response_code(404);
                echo json_encode(['error' => 'Hall not found']);
                exit;
            }
            
            $hall['is_active'] = (bool)$hall['is_active'];
            echo json_encode($hall, JSON_UNESCAPED_UNICODE);
        } else {
            // Get all halls
            $halls = $db->fetchAll("
                SELECT * FROM halls 
                ORDER BY sort_order, name
            ");
            
            foreach ($halls as &$hall) {
                $hall['is_active'] = (bool)$hall['is_active'];
            }
            
            echo json_encode($halls, JSON_UNESCAPED_UNICODE);
        }
        break;
        
    case 'POST':
        // Create new hall
        $data = json_decode(file_get_contents('php://input'), true);
        
        $code = $data['code'] ?? null;
        $name = $data['name'] ?? null;
        $capacity = $data['capacity'] ?? null;
        $isActive = isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1;
        $sortOrder = $data['sort_order'] ?? 0;
        
        if (!$code || !$name || !$capacity) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        try {
            $db->execute("
                INSERT INTO halls (code, name, capacity, is_active, sort_order)
                VALUES (?, ?, ?, ?, ?)
            ", [$code, $name, $capacity, $isActive, $sortOrder]);
            
            $hallId = $db->lastInsertId();
            $hall = $db->fetchOne("SELECT * FROM halls WHERE id = ?", [$hallId]);
            $hall['is_active'] = (bool)$hall['is_active'];
            
            http_response_code(201);
            echo json_encode($hall, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) { // SQLITE_CONSTRAINT_UNIQUE
                http_response_code(409);
                echo json_encode(['error' => 'Hall with this code already exists']);
            } else {
                http_response_code(500);
                error_log('Error creating hall: ' . $e->getMessage());
                echo json_encode(['error' => 'Failed to create hall']);
            }
        }
        break;
        
    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Hall ID required']);
            exit;
        }
        
        // Update hall
        $data = json_decode(file_get_contents('php://input'), true);
        
        $name = $data['name'] ?? null;
        $capacity = $data['capacity'] ?? null;
        $isActive = isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : null;
        $sortOrder = $data['sort_order'] ?? null;
        
        try {
            $db->execute("
                UPDATE halls 
                SET name = COALESCE(?, name),
                    capacity = COALESCE(?, capacity),
                    is_active = COALESCE(?, is_active),
                    sort_order = COALESCE(?, sort_order),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ", [$name, $capacity, $isActive, $sortOrder, $id]);
            
            $hall = $db->fetchOne("SELECT * FROM halls WHERE id = ?", [$id]);
            if (!$hall) {
                http_response_code(404);
                echo json_encode(['error' => 'Hall not found']);
                exit;
            }
            
            $hall['is_active'] = (bool)$hall['is_active'];
            echo json_encode($hall, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error updating hall: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to update hall']);
        }
        break;
        
    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Hall ID required']);
            exit;
        }
        
        // Delete hall
        try {
            $rows = $db->execute("DELETE FROM halls WHERE id = ?", [$id]);
            
            if ($rows === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Hall not found']);
            } else {
                echo json_encode(['message' => 'Hall deleted successfully']);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error deleting hall: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to delete hall']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

