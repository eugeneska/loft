<?php
/**
 * Season Rules API routes
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
            // Get season rule by ID
            $rule = $db->fetchOne("
                SELECT sr.*, 
                       ps.code as price_set_code, ps.name as price_set_name
                FROM season_rules sr
                JOIN price_sets ps ON sr.price_set_id = ps.id
                WHERE sr.id = ?
            ", [$id]);
            
            if (!$rule) {
                http_response_code(404);
                echo json_encode(['error' => 'Season rule not found']);
                exit;
            }
            
            echo json_encode($rule, JSON_UNESCAPED_UNICODE);
        } else {
            // Get all season rules
            $rules = $db->fetchAll("
                SELECT sr.*, 
                       ps.code as price_set_code, ps.name as price_set_name
                FROM season_rules sr
                JOIN price_sets ps ON sr.price_set_id = ps.id
                ORDER BY sr.priority DESC, sr.start_date
            ");
            
            echo json_encode($rules, JSON_UNESCAPED_UNICODE);
        }
        break;
        
    case 'POST':
        // Create new season rule
        $data = json_decode(file_get_contents('php://input'), true);
        
        $priceSetId = $data['price_set_id'] ?? null;
        $startDate = $data['start_date'] ?? null;
        $endDate = $data['end_date'] ?? null;
        $daysOfWeekMask = $data['days_of_week_mask'] ?? null;
        $priority = $data['priority'] ?? 1;
        $description = $data['description'] ?? null;
        
        if (!$priceSetId || !$startDate || !$endDate || !$daysOfWeekMask) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        if (strtotime($startDate) > strtotime($endDate)) {
            http_response_code(400);
            echo json_encode(['error' => 'Start date must be before or equal to end date']);
            exit;
        }
        
        try {
            $db->execute("
                INSERT INTO season_rules (price_set_id, start_date, end_date, days_of_week_mask, priority, description)
                VALUES (?, ?, ?, ?, ?, ?)
            ", [$priceSetId, $startDate, $endDate, $daysOfWeekMask, $priority, $description]);
            
            $ruleId = $db->lastInsertId();
            $rule = $db->fetchOne("
                SELECT sr.*, 
                       ps.code as price_set_code, ps.name as price_set_name
                FROM season_rules sr
                JOIN price_sets ps ON sr.price_set_id = ps.id
                WHERE sr.id = ?
            ", [$ruleId]);
            
            http_response_code(201);
            echo json_encode($rule, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error creating season rule: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to create season rule']);
        }
        break;
        
    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Season rule ID required']);
            exit;
        }
        
        // Update season rule
        $data = json_decode(file_get_contents('php://input'), true);
        
        $priceSetId = $data['price_set_id'] ?? null;
        $startDate = $data['start_date'] ?? null;
        $endDate = $data['end_date'] ?? null;
        $daysOfWeekMask = $data['days_of_week_mask'] ?? null;
        $priority = $data['priority'] ?? null;
        $description = $data['description'] ?? null;
        
        if ($startDate && $endDate && strtotime($startDate) > strtotime($endDate)) {
            http_response_code(400);
            echo json_encode(['error' => 'Start date must be before or equal to end date']);
            exit;
        }
        
        try {
            $db->execute("
                UPDATE season_rules 
                SET price_set_id = COALESCE(?, price_set_id),
                    start_date = COALESCE(?, start_date),
                    end_date = COALESCE(?, end_date),
                    days_of_week_mask = COALESCE(?, days_of_week_mask),
                    priority = COALESCE(?, priority),
                    description = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ", [
                $priceSetId, $startDate, $endDate, $daysOfWeekMask, $priority,
                $description !== null ? $description : null,
                $id
            ]);
            
            $rule = $db->fetchOne("
                SELECT sr.*, 
                       ps.code as price_set_code, ps.name as price_set_name
                FROM season_rules sr
                JOIN price_sets ps ON sr.price_set_id = ps.id
                WHERE sr.id = ?
            ", [$id]);
            
            if (!$rule) {
                http_response_code(404);
                echo json_encode(['error' => 'Season rule not found']);
                exit;
            }
            
            echo json_encode($rule, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error updating season rule: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to update season rule']);
        }
        break;
        
    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Season rule ID required']);
            exit;
        }
        
        // Delete season rule
        try {
            $rows = $db->execute("DELETE FROM season_rules WHERE id = ?", [$id]);
            
            if ($rows === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Season rule not found']);
            } else {
                echo json_encode(['message' => 'Season rule deleted successfully']);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error deleting season rule: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to delete season rule']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

