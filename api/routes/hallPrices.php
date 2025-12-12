<?php
/**
 * Hall Prices API routes
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
            // Get hall price by ID
            $price = $db->fetchOne("
                SELECT hp.*, 
                       h.code as hall_code, h.name as hall_name,
                       ps.code as price_set_code, ps.name as price_set_name
                FROM hall_prices hp
                JOIN halls h ON hp.hall_id = h.id
                JOIN price_sets ps ON hp.price_set_id = ps.id
                WHERE hp.id = ?
            ", [$id]);
            
            if (!$price) {
                http_response_code(404);
                echo json_encode(['error' => 'Hall price not found']);
                exit;
            }
            
            echo json_encode($price, JSON_UNESCAPED_UNICODE);
        } else {
            // Get all hall prices with optional filters
            $hallId = $_GET['hall_id'] ?? null;
            $priceSetId = $_GET['price_set_id'] ?? null;
            
            $query = "
                SELECT hp.*, 
                       h.code as hall_code, h.name as hall_name,
                       ps.code as price_set_code, ps.name as price_set_name
                FROM hall_prices hp
                JOIN halls h ON hp.hall_id = h.id
                JOIN price_sets ps ON hp.price_set_id = ps.id
                WHERE 1=1
            ";
            $params = [];
            
            if ($hallId) {
                $query .= " AND hp.hall_id = ?";
                $params[] = $hallId;
            }
            
            if ($priceSetId) {
                $query .= " AND hp.price_set_id = ?";
                $params[] = $priceSetId;
            }
            
            $query .= " ORDER BY h.name, ps.code";
            
            $prices = $db->fetchAll($query, $params);
            echo json_encode($prices, JSON_UNESCAPED_UNICODE);
        }
        break;
        
    case 'POST':
        // Create new hall price
        $data = json_decode(file_get_contents('php://input'), true);
        
        $hallId = $data['hall_id'] ?? null;
        $priceSetId = $data['price_set_id'] ?? null;
        $weekday10_22 = $data['weekday_10_22'] ?? $data['weekday_price'] ?? null;
        $weekday22_00 = $data['weekday_22_00'] ?? $data['weekday_price'] ?? null;
        $friSatPrice = $data['fri_sat_price'] ?? null;
        $sunPrice = $data['sun_price'] ?? null;
        $cleaningUpTo30 = $data['cleaning_up_to_30'] ?? null;
        $cleaningOver30 = $data['cleaning_over_30'] ?? null;
        $afterHoursFee = $data['after_hours_fee'] ?? null;
        $minHours = $data['min_hours'] ?? 2;
        $minHoursSaturday = $data['min_hours_saturday'] ?? $minHours;
        $allowFoodAlcoholFromHours = $data['allow_food_alcohol_from_hours'] ?? 2;
        
        if (!$hallId || !$priceSetId || !$weekday10_22 || 
            $friSatPrice === null || $sunPrice === null ||
            $cleaningUpTo30 === null || $cleaningOver30 === null ||
            $afterHoursFee === null) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        try {
            // weekday_price используется как fallback значение, устанавливаем его равным weekday_10_22
            $weekdayPrice = $weekday10_22 ?? $data['weekday_price'] ?? null;
            
            $db->execute("
                INSERT INTO hall_prices (
                    hall_id, price_set_id, weekday_price, weekday_10_22, weekday_22_00, fri_sat_price, sun_price,
                    cleaning_up_to_30, cleaning_over_30, after_hours_fee,
                    min_hours, min_hours_saturday, allow_food_alcohol_from_hours
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ", [
                $hallId, $priceSetId, $weekdayPrice, $weekday10_22, $weekday22_00, $friSatPrice, $sunPrice,
                $cleaningUpTo30, $cleaningOver30, $afterHoursFee,
                $minHours, $minHoursSaturday, $allowFoodAlcoholFromHours
            ]);
            
            $priceId = $db->lastInsertId();
            $price = $db->fetchOne("
                SELECT hp.*, 
                       h.code as hall_code, h.name as hall_name,
                       ps.code as price_set_code, ps.name as price_set_name
                FROM hall_prices hp
                JOIN halls h ON hp.hall_id = h.id
                JOIN price_sets ps ON hp.price_set_id = ps.id
                WHERE hp.id = ?
            ", [$priceId]);
            
            http_response_code(201);
            echo json_encode($price, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) { // SQLITE_CONSTRAINT_UNIQUE
                http_response_code(409);
                echo json_encode(['error' => 'Price for this hall and price set already exists']);
            } else {
                http_response_code(500);
                error_log('Error creating hall price: ' . $e->getMessage());
                echo json_encode(['error' => 'Failed to create hall price']);
            }
        }
        break;
        
    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Hall price ID required']);
            exit;
        }
        
        // Update hall price
        $data = json_decode(file_get_contents('php://input'), true);
        
        $weekday10_22 = $data['weekday_10_22'] ?? ($data['weekday_price'] ?? null);
        $weekday22_00 = $data['weekday_22_00'] ?? ($data['weekday_price'] ?? null);
        $friSatPrice = $data['fri_sat_price'] ?? null;
        $sunPrice = $data['sun_price'] ?? null;
        $cleaningUpTo30 = $data['cleaning_up_to_30'] ?? null;
        $cleaningOver30 = $data['cleaning_over_30'] ?? null;
        $afterHoursFee = $data['after_hours_fee'] ?? null;
        $minHours = $data['min_hours'] ?? null;
        $minHoursSaturday = $data['min_hours_saturday'] ?? null;
        $allowFoodAlcoholFromHours = $data['allow_food_alcohol_from_hours'] ?? null;
        
        // weekday_price используется как fallback значение, обновляем его равным weekday_10_22 если он был изменен
        $weekdayPrice = $weekday10_22 ?? null;
        
        try {
            $db->execute("
                UPDATE hall_prices 
                SET weekday_price = COALESCE(?, weekday_price),
                    weekday_10_22 = COALESCE(?, weekday_10_22, weekday_price),
                    weekday_22_00 = COALESCE(?, weekday_22_00, weekday_price),
                    fri_sat_price = COALESCE(?, fri_sat_price),
                    sun_price = COALESCE(?, sun_price),
                    cleaning_up_to_30 = COALESCE(?, cleaning_up_to_30),
                    cleaning_over_30 = COALESCE(?, cleaning_over_30),
                    after_hours_fee = COALESCE(?, after_hours_fee),
                    min_hours = COALESCE(?, min_hours),
                    min_hours_saturday = COALESCE(?, min_hours_saturday, min_hours),
                    allow_food_alcohol_from_hours = COALESCE(?, allow_food_alcohol_from_hours),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ", [
                $weekdayPrice, $weekday10_22, $weekday22_00, $friSatPrice, $sunPrice,
                $cleaningUpTo30, $cleaningOver30, $afterHoursFee,
                $minHours, $minHoursSaturday, $allowFoodAlcoholFromHours,
                $id
            ]);
            
            $price = $db->fetchOne("
                SELECT hp.*, 
                       h.code as hall_code, h.name as hall_name,
                       ps.code as price_set_code, ps.name as price_set_name
                FROM hall_prices hp
                JOIN halls h ON hp.hall_id = h.id
                JOIN price_sets ps ON hp.price_set_id = ps.id
                WHERE hp.id = ?
            ", [$id]);
            
            if (!$price) {
                http_response_code(404);
                echo json_encode(['error' => 'Hall price not found']);
                exit;
            }
            
            echo json_encode($price, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error updating hall price: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to update hall price']);
        }
        break;
        
    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Hall price ID required']);
            exit;
        }
        
        // Delete hall price
        try {
            $rows = $db->execute("DELETE FROM hall_prices WHERE id = ?", [$id]);
            
            if ($rows === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Hall price not found']);
            } else {
                echo json_encode(['message' => 'Hall price deleted successfully']);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error deleting hall price: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to delete hall price']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

