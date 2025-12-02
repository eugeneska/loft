<?php
/**
 * Price Sets API routes
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
            // Get price set by ID
            $priceSet = $db->fetchOne("SELECT * FROM price_sets WHERE id = ?", [$id]);
            
            if (!$priceSet) {
                http_response_code(404);
                echo json_encode(['error' => 'Price set not found']);
                exit;
            }
            
            echo json_encode($priceSet, JSON_UNESCAPED_UNICODE);
        } else {
            // Get all price sets
            $priceSets = $db->fetchAll("SELECT * FROM price_sets ORDER BY code");
            echo json_encode($priceSets, JSON_UNESCAPED_UNICODE);
        }
        break;
        
    case 'POST':
        // Create new price set
        $data = json_decode(file_get_contents('php://input'), true);
        
        $code = $data['code'] ?? null;
        $name = $data['name'] ?? null;
        $description = $data['description'] ?? null;
        
        if (!$code || !$name) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        try {
            $db->execute("
                INSERT INTO price_sets (code, name, description)
                VALUES (?, ?, ?)
            ", [$code, $name, $description]);
            
            $priceSetId = $db->lastInsertId();
            $priceSet = $db->fetchOne("SELECT * FROM price_sets WHERE id = ?", [$priceSetId]);
            
            http_response_code(201);
            echo json_encode($priceSet, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) { // SQLITE_CONSTRAINT_UNIQUE
                http_response_code(409);
                echo json_encode(['error' => 'Price set with this code already exists']);
            } else {
                http_response_code(500);
                error_log('Error creating price set: ' . $e->getMessage());
                echo json_encode(['error' => 'Failed to create price set']);
            }
        }
        break;
        
    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Price set ID required']);
            exit;
        }
        
        // Update price set
        $data = json_decode(file_get_contents('php://input'), true);
        
        $name = $data['name'] ?? null;
        $description = $data['description'] ?? null;
        
        try {
            $db->execute("
                UPDATE price_sets 
                SET name = COALESCE(?, name),
                    description = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ", [$name, $description !== null ? $description : null, $id]);
            
            $priceSet = $db->fetchOne("SELECT * FROM price_sets WHERE id = ?", [$id]);
            if (!$priceSet) {
                http_response_code(404);
                echo json_encode(['error' => 'Price set not found']);
                exit;
            }
            
            echo json_encode($priceSet, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error updating price set: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to update price set']);
        }
        break;
        
    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Price set ID required']);
            exit;
        }
        
        // Delete price set
        try {
            $rows = $db->execute("DELETE FROM price_sets WHERE id = ?", [$id]);
            
            if ($rows === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Price set not found']);
            } else {
                echo json_encode(['message' => 'Price set deleted successfully']);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error deleting price set: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to delete price set']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

