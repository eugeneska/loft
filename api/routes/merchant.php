<?php
/**
 * Merchant Settings API routes
 */

header('Content-Type: application/json; charset=utf-8');

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

// Check if this is a request for T-Bank config
// Path will be like /api/merchant/config
$isConfigRequest = false;
foreach ($segments as $i => $segment) {
    if ($segment === 'merchant' && isset($segments[$i + 1]) && $segments[$i + 1] === 'config') {
        $isConfigRequest = true;
        break;
    }
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        if ($isConfigRequest) {
            // Get T-Bank payment configuration
            $merchant = $db->fetchOne("
                SELECT terminal_key, merchant_id, terminal_id, sbp_merchant_id 
                FROM merchant_settings 
                WHERE terminal_key IS NOT NULL AND terminal_key != ''
                ORDER BY id DESC 
                LIMIT 1
            ");
            
            if (!$merchant || !$merchant['terminal_key']) {
                http_response_code(404);
                echo json_encode(['error' => 'Merchant configuration not found']);
                exit;
            }
            
            // Return T-Bank configuration format
            $features = new stdClass();
            $features->payment = new stdClass();
            $features->iframe = new stdClass();
            $features->addcardIframe = new stdClass();
            
            $config = [
                'terminalKey' => $merchant['terminal_key'],
                'product' => 'eacq',
                'features' => $features
            ];
            
            echo json_encode($config, JSON_UNESCAPED_UNICODE);
        } elseif ($id) {
            // Get merchant setting by ID
            $merchant = $db->fetchOne("SELECT * FROM merchant_settings WHERE id = ?", [$id]);
            
            if (!$merchant) {
                http_response_code(404);
                echo json_encode(['error' => 'Merchant setting not found']);
                exit;
            }
            
            echo json_encode($merchant, JSON_UNESCAPED_UNICODE);
        } else {
            // Get all merchant settings (usually just one)
            $merchants = $db->fetchAll("
                SELECT * FROM merchant_settings 
                ORDER BY id
            ");
            
            echo json_encode($merchants, JSON_UNESCAPED_UNICODE);
        }
        break;
        
    case 'POST':
        // Create new merchant setting
        $data = json_decode(file_get_contents('php://input'), true);
        
        $merchantName = $data['merchant_name'] ?? null;
        $merchantId = $data['merchant_id'] ?? null;
        $terminalId = $data['terminal_id'] ?? null;
        $sbpMerchantId = $data['sbp_merchant_id'] ?? null;
        $terminalKey = $data['terminal_key'] ?? null;
        
        if (!$merchantName || !$merchantId || !$terminalId || !$sbpMerchantId || !$terminalKey) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        try {
            $db->execute("
                INSERT INTO merchant_settings (merchant_name, merchant_id, terminal_id, sbp_merchant_id, terminal_key)
                VALUES (?, ?, ?, ?, ?)
            ", [$merchantName, $merchantId, $terminalId, $sbpMerchantId, $terminalKey]);
            
            $merchantId = $db->lastInsertId();
            $merchant = $db->fetchOne("SELECT * FROM merchant_settings WHERE id = ?", [$merchantId]);
            
            http_response_code(201);
            echo json_encode($merchant, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error creating merchant setting: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to create merchant setting']);
        }
        break;
        
    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Merchant setting ID required']);
            exit;
        }
        
        // Update merchant setting
        $data = json_decode(file_get_contents('php://input'), true);
        
        $merchantName = $data['merchant_name'] ?? null;
        $merchantId = $data['merchant_id'] ?? null;
        $terminalId = $data['terminal_id'] ?? null;
        $sbpMerchantId = $data['sbp_merchant_id'] ?? null;
        $terminalKey = $data['terminal_key'] ?? null;
        
        try {
            $db->execute("
                UPDATE merchant_settings 
                SET merchant_name = COALESCE(?, merchant_name),
                    merchant_id = COALESCE(?, merchant_id),
                    terminal_id = COALESCE(?, terminal_id),
                    sbp_merchant_id = COALESCE(?, sbp_merchant_id),
                    terminal_key = COALESCE(?, terminal_key),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ", [$merchantName, $merchantId, $terminalId, $sbpMerchantId, $terminalKey, $id]);
            
            $merchant = $db->fetchOne("SELECT * FROM merchant_settings WHERE id = ?", [$id]);
            if (!$merchant) {
                http_response_code(404);
                echo json_encode(['error' => 'Merchant setting not found']);
                exit;
            }
            
            echo json_encode($merchant, JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error updating merchant setting: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to update merchant setting']);
        }
        break;
        
    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Merchant setting ID required']);
            exit;
        }
        
        // Delete merchant setting
        try {
            $rows = $db->execute("DELETE FROM merchant_settings WHERE id = ?", [$id]);
            
            if ($rows === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Merchant setting not found']);
            } else {
                echo json_encode(['message' => 'Merchant setting deleted successfully']);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error deleting merchant setting: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to delete merchant setting']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

