<?php
/**
 * Settings API routes
 * Handles application settings (payment module, Telegram, etc.)
 */

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();
header('Content-Type: application/json; charset=utf-8');

/**
 * Миграция: добавляет недостающие колонки в таблицу settings
 */
function migrateSettingsTable($db) {
    try {
        // Получаем информацию о колонках таблицы settings
        $columns = $db->fetchAll("PRAGMA table_info(settings)");
        $columnNames = array_column($columns, 'name');
        
        // Проверяем и добавляем payment_percent, если его нет
        if (!in_array('payment_percent', $columnNames)) {
            $db->execute("ALTER TABLE settings ADD COLUMN payment_percent REAL DEFAULT 50");
        }
        
        // Проверяем и добавляем payment_terms_text, если его нет
        if (!in_array('payment_terms_text', $columnNames)) {
            $db->execute("ALTER TABLE settings ADD COLUMN payment_terms_text TEXT");
        }
    } catch (PDOException $e) {
        error_log('Migration error: ' . $e->getMessage());
        // Не прерываем выполнение, просто логируем ошибку
    }
}

// Выполняем миграцию перед обработкой запросов
migrateSettingsTable($db);

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        // Get all settings
        try {
            // Сначала получаем базовые настройки
            $settings = $db->fetchOne("
                SELECT 
                    telegram_bot_token,
                    telegram_chat_id,
                    use_payment_module,
                    created_at,
                    updated_at
                FROM settings 
                ORDER BY id DESC 
                LIMIT 1
            ");
            
            // Пытаемся получить новые поля, если они существуют
            try {
                $extendedSettings = $db->fetchOne("
                    SELECT 
                        payment_percent,
                        payment_terms_text
                    FROM settings 
                    ORDER BY id DESC 
                    LIMIT 1
                ");
                if ($extendedSettings) {
                    $settings = array_merge($settings ?: [], $extendedSettings);
                }
            } catch (PDOException $e) {
                // Если колонок еще нет, используем значения по умолчанию
                if ($settings) {
                    $settings['payment_percent'] = 50;
                    $settings['payment_terms_text'] = null;
                }
            }
            
            if (!$settings) {
                // Create default settings if none exist
                try {
                    $db->execute("
                        INSERT INTO settings (use_payment_module, payment_percent, created_at, updated_at)
                        VALUES (1, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ");
                } catch (PDOException $e) {
                    // Если payment_percent еще не существует, создаем без него
                    $db->execute("
                        INSERT INTO settings (use_payment_module, created_at, updated_at)
                        VALUES (1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ");
                }
                $settings = [
                    'telegram_bot_token' => null,
                    'telegram_chat_id' => null,
                    'use_payment_module' => 1,
                    'payment_percent' => 50,
                    'payment_terms_text' => null,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ];
            }
            
            // Convert SQLite integer (0/1) to boolean
            $usePaymentModule = isset($settings['use_payment_module']) 
                ? (bool)(int)$settings['use_payment_module'] 
                : true;
            
            // Default payment percent is 50 if not set
            $paymentPercent = isset($settings['payment_percent']) && $settings['payment_percent'] !== null
                ? (float)$settings['payment_percent']
                : 50;
            
            // Telegram bot is hardcoded, so always return true for has_telegram_config
            echo json_encode([
                'use_payment_module' => $usePaymentModule,
                'payment_percent' => $paymentPercent,
                'payment_terms_text' => $settings['payment_terms_text'] ?? null,
                'has_telegram_config' => true,
                'created_at' => $settings['created_at'] ?? null,
                'updated_at' => $settings['updated_at'] ?? null
            ], JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error fetching settings: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to fetch settings']);
        }
        break;
        
    case 'PUT':
    case 'POST':
        // Update settings
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid request data']);
            exit;
        }
        
        try {
            // Check if settings exist
            $existing = $db->fetchOne("SELECT id FROM settings ORDER BY id DESC LIMIT 1");
            
            if ($existing) {
                // Update existing settings
                $updates = [];
                $params = [];
                
                if (isset($data['use_payment_module'])) {
                    $updates[] = 'use_payment_module = ?';
                    $params[] = $data['use_payment_module'] ? 1 : 0;
                }
                
                if (isset($data['payment_percent'])) {
                    $updates[] = 'payment_percent = ?';
                    $params[] = (float)$data['payment_percent'];
                }
                
                if (isset($data['payment_terms_text'])) {
                    $updates[] = 'payment_terms_text = ?';
                    $params[] = $data['payment_terms_text'];
                }
                
                if (isset($data['telegram_bot_token'])) {
                    $updates[] = 'telegram_bot_token = ?';
                    $params[] = $data['telegram_bot_token'];
                }
                
                if (isset($data['telegram_chat_id'])) {
                    $updates[] = 'telegram_chat_id = ?';
                    $params[] = $data['telegram_chat_id'];
                }
                
                if (empty($updates)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'No valid fields to update']);
                    exit;
                }
                
                $updates[] = 'updated_at = CURRENT_TIMESTAMP';
                $params[] = $existing['id'];
                
                $db->execute("
                    UPDATE settings 
                    SET " . implode(', ', $updates) . "
                    WHERE id = ?
                ", $params);
            } else {
                // Create new settings
                $db->execute("
                    INSERT INTO settings (
                        use_payment_module, 
                        payment_percent,
                        payment_terms_text,
                        telegram_bot_token,
                        telegram_chat_id,
                        created_at, 
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ", [
                    isset($data['use_payment_module']) ? ($data['use_payment_module'] ? 1 : 0) : 1,
                    isset($data['payment_percent']) ? (float)$data['payment_percent'] : 50,
                    $data['payment_terms_text'] ?? null,
                    $data['telegram_bot_token'] ?? null,
                    $data['telegram_chat_id'] ?? null
                ]);
            }
            
            echo json_encode(['success' => true, 'message' => 'Settings updated successfully'], JSON_UNESCAPED_UNICODE);
        } catch (PDOException $e) {
            http_response_code(500);
            error_log('Error updating settings: ' . $e->getMessage());
            echo json_encode(['error' => 'Failed to update settings']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

