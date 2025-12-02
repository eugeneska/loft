<?php
/**
 * Extras Prices API routes
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
            // Get extra price by ID
            $price = $db->fetchOne("
                SELECT ep.*, 
                       e.code as extra_code, e.name as extra_name, e.pricing_type,
                       ps.code as price_set_code, ps.name as price_set_name
                FROM extras_prices ep
                JOIN extras e ON ep.extra_id = e.id
                JOIN price_sets ps ON ep.price_set_id = ps.id
                WHERE ep.id = ?
            ", [$id]);
            
            if (!$price) {
                http_response_code(404);
                echo json_encode(['error' => 'Extra price not found']);
                exit;
            }
            
            echo json_encode($price, JSON_UNESCAPED_UNICODE);
        } else {
            // Get all extra prices with optional filters
            $extraId = $_GET['extra_id'] ?? null;
            $priceSetId = $_GET['price_set_id'] ?? null;
            
            $query = "
                SELECT ep.*, 
                       e.code as extra_code, e.name as extra_name, e.pricing_type,
                       ps.code as price_set_code, ps.name as price_set_name
                FROM extras_prices ep
                JOIN extras e ON ep.extra_id = e.id
                JOIN price_sets ps ON ep.price_set_id = ps.id
                WHERE 1=1
            ";
            $params = [];
            
            if ($extraId) {
                $query .= " AND ep.extra_id = ?";
                $params[] = $extraId;
            }
            
            if ($priceSetId) {
                $query .= " AND ep.price_set_id = ?";
                $params[] = $priceSetId;
            }
            
            $query .= " ORDER BY e.name, ps.code";
            
            $prices = $db->fetchAll($query, $params);
            echo json_encode($prices, JSON_UNESCAPED_UNICODE);
        }
        break;
        
    case 'POST':
        // Create new extra price
        $data = json_decode(file_get_contents('php://input'), true);
        
        $extraId = $data['extra_id'] ?? null;
        $priceSetId = $data['price_set_id'] ?? null;
        $basePrice = $data['base_price'] ?? null;
        $additionalUnitPrice = $data['additional_unit_price'] ?? null;
        $unitDescription = $data['unit_description'] ?? null;
        
        if (!$extraId || !$priceSetId) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        try {
            $db->execute("
                INSERT INTO extras_prices (extra_id, price_set_id, base_price, additional_unit_price, unit_description)
                VALUES (?, ?, ?, ?, ?)
            ", [$extraId, $priceSetId, $basePrice, $additionalUnitPrice, $unitDescription]);
            
            $priceId = $db->lastInsertId();
            $price = $db->fetchOne("
                SELECT ep.*, 
                       e.code as extra_code, e.name as extra_name, e.pricing_type,
                       ps.code as price_set_code, ps.name as price_set_name
                FROM extras_prices ep
                JOIN extras e ON ep.extra_id = e.id
                JOIN price_sets ps ON ep.price_set_id = ps.id
                WHERE ep.id = ?
            ", [$priceId]);
            
            http_response_code(201);
            echo json_encode($price, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) { // SQLITE_CONSTRAINT_UNIQUE
                http_response_code(409);
                echo json_encode(['error' => 'Price for this extra and price set already exists']);
            } else {
                http_response_code(500);
                error_log('Error creating extra price: ' . $e->getMessage());
                echo json_encode(['error' => 'Failed to create extra price']);
            }
        }
        break;
        
    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Extra price ID required']);
            exit;
        }
        
        // Update extra price
        $data = json_decode(file_get_contents('php://input'), true);
        
        $basePrice = $data['base_price'] ?? null;
        $additionalUnitPrice = $data['additional_unit_price'] ?? null;
        $unitDescription = $data['unit_description'] ?? null;
        
        try {
            $db->execute("
                UPDATE extras_prices 
                SET base_price = ?,
                    additional_unit_price = ?,
                    unit_description = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ", [
                $basePrice !== null ? $basePrice : null,
                $additionalUnitPrice !== null ? $additionalUnitPrice : null,
                $unitDescription !== null ? $unitDescription : null,
                $id
            ]);
            
            $price = $db->fetchOne("
                SELECT ep.*, 
                       e.code as extra_code, e.name as extra_name, e.pricing_type,
                       ps.code as price_set_code, ps.name as price_set_name
                FROM extras_prices ep
                JOIN extras e ON ep.extra_id = e.id
                JOIN price_sets ps ON ep.price_set_id = ps.id
                WHERE ep.id = ?
            ", [$id]);
            
            if (!$price) {
                http_response_code(404);
                echo json_encode(['error' => 'Extra price not found']);
                exit;
            }
            
            echo json_encode($price, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error updating extra price: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to update extra price']);
        }
        break;
        
    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Extra price ID required']);
            exit;
        }
        
        // Delete extra price
        try {
            $rows = $db->execute("DELETE FROM extras_prices WHERE id = ?", [$id]);
            
            if ($rows === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Extra price not found']);
            } else {
                echo json_encode(['message' => 'Extra price deleted successfully']);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error deleting extra price: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to delete extra price']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

