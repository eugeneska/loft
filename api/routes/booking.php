<?php
/**
 * Booking API routes
 * Handles booking creation, payment, and Telegram notifications
 */

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();
header('Content-Type: application/json; charset=utf-8');

/**
 * Генерация токена для подписи запроса к Tbank API
 * Согласно официальной документации Tbank:
 * 1. Берем только параметры корневого объекта (вложенные объекты DATA, Receipt НЕ участвуют!)
 * 2. Добавляем Password как отдельное поле
 * 3. Сортируем по ключу (алфавитно)
 * 4. Конкатенируем только значения в одну строку
 * 5. Применяем SHA256
 * 
 * @param array $requestData Данные запроса (без Token)
 * @param string $secretKey SecretKey (пароль) мерчанта
 * @return string SHA256 хеш токена
 */
function generateTbankToken($requestData, $secretKey) {
    // Убираем Token из данных, если он есть
    unset($requestData['Token']);
    
    // ВАЖНО: Вложенные объекты (DATA, Receipt) НЕ участвуют в формировании токена!
    // Убираем их из массива для генерации токена
    $tokenData = [];
    foreach ($requestData as $key => $value) {
        // Пропускаем вложенные объекты и массивы
        if ($key === 'DATA' || $key === 'Receipt' || is_array($value)) {
            continue;
        }
        // Добавляем только простые поля корневого объекта
        $tokenData[$key] = (string)$value;
    }
    
    // Добавляем Password как отдельное поле (не в конец строки!)
    $tokenData['Password'] = $secretKey;
    
    // Сортируем по ключу (алфавитно)
    ksort($tokenData);
    
    // Конкатенируем только значения в одну строку БЕЗ разделителей
    $tokenString = implode('', array_values($tokenData));
    
    // Применяем SHA256 хеш (с поддержкой UTF-8)
    $token = hash('sha256', $tokenString);
    
    // Логируем для отладки (убрать в продакшене)
    error_log('Token generation debug:');
    error_log('  Fields in token: ' . implode(', ', array_keys($tokenData)));
    error_log('  Token string: ' . substr($tokenString, 0, 100) . '... (length: ' . strlen($tokenString) . ')');
    error_log('  Token: ' . $token);
    
    return $token;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', trim($path, '/'));

// Find 'booking' in the path and get the next segment (the action)
$action = null;
for ($i = 0; $i < count($segments); $i++) {
    if ($segments[$i] === 'booking' && isset($segments[$i + 1])) {
        $action = $segments[$i + 1];
        break;
    }
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'POST':
        if ($action === 'create-payment') {
            // Create payment for booking
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!$data || !isset($data['booking']) || !isset($data['pricing'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid request data']);
                exit;
            }

            $booking = $data['booking'];
            $pricing = $data['pricing'];

            // Проверяем обязательные поля
            if (empty($booking['name']) || empty($booking['phone'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Имя и телефон обязательны для заполнения']);
                exit;
            }

            // Generate unique order ID
            $orderId = 'ORDER_' . time() . '_' . rand(1000, 9999);

            // Save booking to database
            try {
                $db->execute("
                    INSERT INTO bookings (
                        order_id, hall, booking_date, time_from, time_to, 
                        guests, client_name, client_phone, total_price, 
                        status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
                ", [
                    $orderId,
                    $booking['hall'] ?? '',
                    $booking['date'] ?? '',
                    $booking['timeFrom'] ?? '',
                    $booking['timeTo'] ?? '',
                    $booking['guests'] ?? '',
                    trim($booking['name']),
                    trim($booking['phone']),
                    $pricing['totalPrice'] ?? 0
                ]);

                // Get merchant config for payment (only if payment module is enabled)
                // Note: We don't send Telegram notification here - it will be sent after form submission

                // Return payment data
                // В реальной интеграции здесь должен быть вызов API Т-Банка для создания платежа
                // Пока возвращаем данные для инициализации оплаты
                echo json_encode([
                    'success' => true,
                    'orderId' => $orderId,
                    'amount' => $pricing['totalPrice'] * 100, // в копейках
                    'description' => 'Бронирование зала ' . ($pricing['hall'] ?? ''),
                    'paymentUrl' => null // Будет заполнено при реальной интеграции
                ], JSON_UNESCAPED_UNICODE);

            } catch (PDOException $e) {
                http_response_code(500);
                error_log('Error creating booking: ' . $e->getMessage());
                echo json_encode(['error' => 'Failed to create booking']);
            }
        } elseif ($action === 'init-tbank-payment') {
            // Инициализация платежа через Tbank API
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!$data || !isset($data['orderId']) || !isset($data['amount'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid request data. orderId and amount are required']);
                exit;
            }

            $orderId = $data['orderId'];
            $amount = (int)$data['amount'];
            $description = $data['description'] ?? 'Бронирование зала';
            $name = $data['name'] ?? '';
            $phone = $data['phone'] ?? '';

            // Получаем конфигурацию мерчанта
            $merchant = $db->fetchOne("
                SELECT terminal_key, merchant_id, terminal_id, sbp_merchant_id
                FROM merchant_settings 
                WHERE terminal_key IS NOT NULL AND terminal_key != ''
                ORDER BY id DESC 
                LIMIT 1
            ");

            if (!$merchant || !$merchant['terminal_key']) {
                http_response_code(500);
                echo json_encode(['error' => 'Merchant configuration not found']);
                exit;
            }

            $terminalKey = $merchant['terminal_key'];
            // Пароль для подписи запросов к Tbank API (SecretKey)
            $password = 'NWkYnOK!U2hc58_S';
            
            // ВАЖНО: Убедитесь, что TerminalKey в БД = 1764329094150
            // Если нет, обновите через админку или SQL:
            // UPDATE merchant_settings SET terminal_key = '1764329094150' WHERE id = (SELECT id FROM merchant_settings LIMIT 1);
            
            // Принудительно устанавливаем правильный TerminalKey (если нужно)
            // Раскомментируйте следующую строку, если TerminalKey в БД неправильный:
            // $terminalKey = '1764329094150';
            
            // Получаем базовый URL сайта для callback
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'];
            $baseUrl = $protocol . '://' . $host;

            // Формируем запрос к Tbank API Init
            $tbankRequest = [
                'TerminalKey' => $terminalKey,
                'Amount' => $amount,
                'OrderId' => $orderId,
                'Description' => $description,
                'SuccessURL' => $baseUrl . '/success.html',
                'FailURL' => $baseUrl . '/fail.html',
                'NotificationURL' => $baseUrl . '/api/booking/tbank-callback'
            ];

            // Добавляем данные клиента в поле DATA (если есть)
            // DATA должен участвовать в генерации токена, если присутствует
            if ($name || $phone) {
                $tbankRequest['DATA'] = [
                    'name' => $name,
                    'phone' => $phone
                ];
            }

            // Генерируем токен из всех полей (включая DATA, если есть)
            // Согласно документации Tbank, токен генерируется из ВСЕХ полей запроса (кроме Token)
            $tbankRequest['Token'] = generateTbankToken($tbankRequest, $password);
            
            // Проверяем, что TerminalKey правильный
            if ($terminalKey !== '1764329094150') {
                error_log('WARNING: TerminalKey mismatch! DB has: ' . $terminalKey . ', expected: 1764329094150');
            }
            
            // Логируем запрос для отладки (убрать в продакшене или замаскировать чувствительные данные)
            $requestForLog = $tbankRequest;
            $requestForLog['Token'] = substr($requestForLog['Token'], 0, 10) . '...'; // Показываем только начало токена
            error_log('Tbank API request: ' . json_encode($requestForLog, JSON_UNESCAPED_UNICODE));
            error_log('TerminalKey: ' . $terminalKey . ' (expected: 1764329094150)');
            error_log('Password: ' . substr($password, 0, 5) . '... (length: ' . strlen($password) . ')');
            
            // Отправляем запрос в Tbank API
            $ch = curl_init('https://securepay.tinkoff.ru/v2/Init');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            $requestBody = json_encode($tbankRequest, JSON_UNESCAPED_UNICODE);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $requestBody);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json'
            ]);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($curlError) {
                error_log('Tbank API cURL error: ' . $curlError);
                http_response_code(500);
                echo json_encode(['error' => 'Failed to connect to Tbank API: ' . $curlError]);
                exit;
            }

            if ($httpCode !== 200) {
                error_log('Tbank API HTTP error: ' . $httpCode . ', Response: ' . $response);
                http_response_code(500);
                echo json_encode(['error' => 'Tbank API returned error: ' . $httpCode]);
                exit;
            }

            $tbankResponse = json_decode($response, true);
            
            if (!$tbankResponse || !isset($tbankResponse['PaymentURL'])) {
                error_log('Tbank API invalid response: ' . $response);
                http_response_code(500);
                echo json_encode(['error' => 'Invalid response from Tbank API', 'details' => $tbankResponse]);
                exit;
            }

            // Обновляем статус заказа в БД (если есть колонка payment_id)
            // Пока закомментировано, так как колонки payment_id может не быть в таблице
            /*
            try {
                $db->execute("
                    UPDATE bookings 
                    SET payment_id = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE order_id = ?
                ", [$tbankResponse['PaymentId'] ?? null, $orderId]);
            } catch (PDOException $e) {
                error_log('Error updating booking with payment_id: ' . $e->getMessage());
                // Не блокируем процесс из-за ошибки обновления
            }
            */
            
            // Логируем PaymentId для отладки
            if (isset($tbankResponse['PaymentId'])) {
                error_log('Tbank PaymentId: ' . $tbankResponse['PaymentId'] . ' for order: ' . $orderId);
            }

            // Возвращаем PaymentURL
            echo json_encode([
                'PaymentURL' => $tbankResponse['PaymentURL'],
                'PaymentId' => $tbankResponse['PaymentId'] ?? null,
                'Success' => $tbankResponse['Success'] ?? false
            ], JSON_UNESCAPED_UNICODE);

        } elseif ($action === 'send-telegram') {
            // Send booking notification to Telegram bot
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!$data || !isset($data['booking']) || !isset($data['pricing'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid request data']);
                exit;
            }

            $booking = $data['booking'];
            $pricing = $data['pricing'];
            $orderId = $data['orderId'] ?? 'N/A';
            $paymentStatus = $data['paymentStatus'] ?? 'unknown';

            // Telegram bot configuration (hardcoded)
            $telegramBotToken = '8410055486:AAGtyvO9L5rXAdpx-UFZ9D8Wxfwb1DTHGII';
            $telegramChatId = '7913987008';

            if (empty($telegramBotToken)) {
                // Если нет настроек Telegram, просто сохраняем в БД
                error_log('Telegram bot not configured');
                echo json_encode([
                    'success' => true,
                    'message' => 'Booking saved (Telegram not configured)'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // Format message
            $message = "🎉 *Новая заявка на бронирование*\n\n";
            $message .= "📋 *Детали бронирования:*\n";
            $message .= "Зал: *" . ($pricing['hall'] ?? 'N/A') . "*\n";
            $message .= "Дата: *" . ($booking['date'] ?? 'N/A') . "*\n";
            $message .= "Время: *" . ($booking['timeFrom'] ?? '') . " - " . ($booking['timeTo'] ?? '') . "*\n";
            if (!empty($booking['guests'])) {
                $message .= "Гостей: *" . $booking['guests'] . "*\n";
            }
            $message .= "\n👤 *Контактные данные:*\n";
            $message .= "Имя: *" . ($booking['name'] ?? 'N/A') . "*\n";
            $message .= "Телефон: *" . ($booking['phone'] ?? 'N/A') . "*\n";
            $message .= "\n💰 *Расчет:*\n";
            $message .= "Сумма: *" . number_format($pricing['totalPrice'] ?? 0, 0, ',', ' ') . " ₽*\n";
            $message .= "Номер заказа: *" . $orderId . "*\n";
            $message .= "Статус оплаты: *" . ($paymentStatus === 'success' ? 'Оплачено ✅' : 'Ожидает оплаты') . "*\n";

            // Send to Telegram
            // Convert chat_id to integer (Telegram API requires numeric chat_id)
            $chatId = is_numeric($telegramChatId) ? (int)$telegramChatId : $telegramChatId;
            
            if (empty($chatId)) {
                error_log('Telegram chat_id not found');
                echo json_encode([
                    'success' => true,
                    'message' => 'Booking saved (Telegram chat_id not found)'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            
            error_log("Sending Telegram message to chat_id: {$chatId}");
            
            $telegramUrl = "https://api.telegram.org/bot{$telegramBotToken}/sendMessage";
            $telegramData = [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => 'Markdown'
            ];

            $ch = curl_init($telegramUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($telegramData));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            
            if ($curlError) {
                error_log("Telegram cURL error: {$curlError}");
            }
            
            // If chat not found, try to get chat_id from getUpdates
            if ($httpCode !== 200) {
                $responseData = json_decode($response, true);
                error_log("Telegram API response: " . json_encode($responseData, JSON_UNESCAPED_UNICODE));
                
                if (isset($responseData['error_code']) && $responseData['error_code'] === 400 && 
                    strpos($responseData['description'], 'chat not found') !== false) {
                    error_log("Chat not found, trying to get chat_id from getUpdates");
                    
                    $updatesUrl = "https://api.telegram.org/bot{$telegramBotToken}/getUpdates";
                    $ch = curl_init($updatesUrl);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                    $updatesResponse = curl_exec($ch);
                    $updatesHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);
                    
                    error_log("getUpdates HTTP code: {$updatesHttpCode}");
                    error_log("getUpdates response: " . substr($updatesResponse, 0, 500));
                    
                    $updates = json_decode($updatesResponse, true);
                    if (isset($updates['ok']) && $updates['ok'] && isset($updates['result']) && is_array($updates['result'])) {
                        error_log("getUpdates returned " . count($updates['result']) . " updates");
                        
                        if (count($updates['result']) > 0) {
                            // Get the latest chat_id from updates
                            foreach (array_reverse($updates['result']) as $update) {
                                if (isset($update['message']['chat']['id'])) {
                                    $newChatId = (int)$update['message']['chat']['id'];
                                    error_log("Got chat_id from getUpdates: {$newChatId}, retrying send");
                                    
                                    // Retry sending with new chat_id
                                    $telegramData['chat_id'] = $newChatId;
                                    $ch = curl_init($telegramUrl);
                                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                                    curl_setopt($ch, CURLOPT_POST, true);
                                    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($telegramData));
                                    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                                    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                                    $response = curl_exec($ch);
                                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                                    curl_close($ch);
                                    
                                    error_log("Retry send HTTP code: {$httpCode}");
                                    if ($httpCode !== 200) {
                                        error_log("Retry send response: " . substr($response, 0, 500));
                                    }
                                    break;
                                }
                            }
                        } else {
                            error_log("getUpdates returned empty result. Bot may not have received any messages yet.");
                            error_log("Please send a message to the bot first, or check if the bot is active.");
                        }
                    } else {
                        error_log("getUpdates failed or returned invalid response");
                        if (isset($updates['description'])) {
                            error_log("getUpdates error: " . $updates['description']);
                        }
                    }
                }
            }

            if ($httpCode === 200) {
                // Update booking status
                if (!empty($orderId) && $orderId !== 'N/A') {
                    try {
                        $db->execute("
                            UPDATE bookings 
                            SET status = ?, telegram_sent = 1, updated_at = CURRENT_TIMESTAMP
                            WHERE order_id = ?
                        ", [$paymentStatus === 'success' ? 'paid' : 'pending', $orderId]);
                    } catch (PDOException $e) {
                        error_log('Error updating booking status: ' . $e->getMessage());
                    }
                }

                echo json_encode([
                    'success' => true,
                    'message' => 'Notification sent to Telegram'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                $errorData = json_decode($response, true);
                $errorMessage = 'Failed to send Telegram notification';
                
                if (isset($errorData['description'])) {
                    $errorMessage = $errorData['description'];
                }
                
                error_log('Telegram API error: ' . $response);
                
                // Не возвращаем ошибку 500, так как бронирование уже создано
                // Просто логируем и возвращаем успех с предупреждением
                echo json_encode([
                    'success' => true,
                    'message' => 'Booking saved, but Telegram notification failed',
                    'error' => $errorMessage,
                    'warning' => true
                ], JSON_UNESCAPED_UNICODE);
            }
        } elseif ($action === 'test-telegram') {
            // Test Telegram notification
            $data = json_decode(file_get_contents('php://input'), true);
            $testMessage = $data['message'] ?? 'Тестовое сообщение';
            
            // Telegram bot configuration (hardcoded)
            $telegramBotToken = '8410055486:AAGtyvO9L5rXAdpx-UFZ9D8Wxfwb1DTHGII';
            $telegramChatId = '7913987008';

            if (empty($telegramBotToken)) {
                http_response_code(400);
                echo json_encode(['error' => 'Telegram bot not configured']);
                exit;
            }

            $message = "🧪 *Тестовое сообщение*\n\n" . $testMessage;
            
            // Convert chat_id to integer
            $chatId = is_numeric($telegramChatId) ? (int)$telegramChatId : $telegramChatId;
            
            // If no chat_id or chat not found, try to get it from getUpdates
            if (empty($chatId)) {
                $updatesUrl = "https://api.telegram.org/bot{$telegramBotToken}/getUpdates";
                $ch = curl_init($updatesUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                $updatesResponse = curl_exec($ch);
                curl_close($ch);
                
                $updates = json_decode($updatesResponse, true);
                if (isset($updates['result'][0]['message']['chat']['id'])) {
                    $chatId = (int)$updates['result'][0]['message']['chat']['id'];
                    error_log("Got chat_id from getUpdates: {$chatId}");
                } else {
                    http_response_code(400);
                    echo json_encode(['error' => 'Chat ID not found. Send a message to your bot first.']);
                    exit;
                }
            }
            
            $telegramUrl = "https://api.telegram.org/bot{$telegramBotToken}/sendMessage";
            $telegramData = [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => 'Markdown'
            ];
            
            error_log("Sending test Telegram message to chat_id: {$chatId}");

            $ch = curl_init($telegramUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($telegramData));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            
            if ($curlError) {
                error_log("Telegram test cURL error: {$curlError}");
            }

            if ($httpCode === 200) {
                echo json_encode(['success' => true, 'message' => 'Test message sent']);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to send test message', 'details' => $response]);
            }
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Action not found']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

