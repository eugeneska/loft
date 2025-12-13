<?php
/**
 * Booking API routes
 * Handles booking creation, payment, and Telegram notifications
 */

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();
header('Content-Type: application/json; charset=utf-8');

/**
 * Вычисление длительности бронирования в минутах
 */
function calculateDuration($timeFrom, $timeTo) {
    $fromParts = explode(':', $timeFrom);
    $toParts = explode(':', $timeTo);
    
    $fromMinutes = (int)$fromParts[0] * 60 + (int)($fromParts[1] ?? 0);
    $toMinutes = (int)$toParts[0] * 60 + (int)($toParts[1] ?? 0);
    
    return $toMinutes - $fromMinutes;
}

/**
 * Валидация минимального количества часов бронирования
 * 
 * @param string $hall Код зала (например, 'armaloft', 'merkuri')
 * @param string $bookingDate Дата бронирования (формат: YYYY-MM-DD)
 * @param string $timeFrom Время начала (формат: HH:MM)
 * @param string $timeTo Время окончания (формат: HH:MM)
 * @param object $db Экземпляр базы данных
 * @return array ['valid' => bool, 'error' => string|null, 'minHours' => int]
 */
function validateBookingDuration($hall, $bookingDate, $timeFrom, $timeTo, $db) {
    // Получаем настройки зала из БД
    $hallSettings = $db->fetchOne("
        SELECT min_hours, min_hours_saturday 
        FROM hall_prices 
        WHERE hall_id = (
            SELECT id FROM halls WHERE name = ? OR code = ? LIMIT 1
        )
        ORDER BY id DESC 
        LIMIT 1
    ", [$hall, $hall]);
    
    // Если настройки не найдены, пробуем найти по названию зала
    if (!$hallSettings) {
        // Пробуем найти зал по различным вариантам названия
        $hallNameVariants = [
            $hall,
            strtolower($hall),
            ucfirst($hall),
            strtoupper($hall)
        ];
        
        foreach ($hallNameVariants as $variant) {
            $hallSettings = $db->fetchOne("
                SELECT min_hours, min_hours_saturday 
                FROM hall_prices 
                WHERE hall_id = (
                    SELECT id FROM halls WHERE name LIKE ? OR code LIKE ? LIMIT 1
                )
                ORDER BY id DESC 
                LIMIT 1
            ", ["%{$variant}%", "%{$variant}%"]);
            
            if ($hallSettings) break;
        }
    }
    
    // Вычисляем длительность бронирования в часах
    $duration = calculateDuration($timeFrom, $timeTo);
    $durationHours = round($duration / 60); // Длительность в часах
    
    // Определяем день недели (0 = воскресенье, 6 = суббота)
    $dateObj = DateTime::createFromFormat('Y-m-d', $bookingDate);
    if (!$dateObj) {
        return ['valid' => false, 'error' => 'Invalid date format', 'minHours' => 2];
    }
    
    $dayOfWeek = (int)$dateObj->format('w'); // 0-6, где 0 = воскресенье
    $isSaturday = ($dayOfWeek === 6);
    
    // Получаем минимальное количество часов
    $minHoursRequired = 2; // По умолчанию 2 часа
    if ($hallSettings) {
        if ($isSaturday && isset($hallSettings['min_hours_saturday']) && $hallSettings['min_hours_saturday'] !== null) {
            $minHoursRequired = (int)$hallSettings['min_hours_saturday'];
        } elseif (isset($hallSettings['min_hours']) && $hallSettings['min_hours'] !== null) {
            $minHoursRequired = (int)$hallSettings['min_hours'];
        }
    }
    
    // Проверяем, что длительность >= минимального количества часов
    if ($durationHours < $minHoursRequired) {
        $hoursWord = $minHoursRequired === 1 ? 'час' : ($minHoursRequired < 5 ? 'часа' : 'часов');
        $errorMessage = "Минимальная аренда {$minHoursRequired} {$hoursWord}. Выбрано: {$durationHours} " . ($durationHours === 1 ? 'час' : ($durationHours < 5 ? 'часа' : 'часов'));
        error_log("❌ Booking duration validation failed. Hall: {$hall}, Required: {$minHoursRequired} hours, Got: {$durationHours} hours");
        return ['valid' => false, 'error' => $errorMessage, 'minHours' => $minHoursRequired];
    }
    
    error_log("✅ Booking duration validated. Hall: {$hall}, Required: {$minHoursRequired} hours, Got: {$durationHours} hours");
    return ['valid' => true, 'error' => null, 'minHours' => $minHoursRequired];
}

/**
 * Создание записи в YClients через API
 * 
 * @param array $bookingData Данные бронирования
 * @return array Результат создания записи
 */
function createYClientsBooking($bookingData) {
    // ТЕСТОВЫЙ РЕЖИМ: установите в true для тестирования без реального создания бронирований
    $YClients_TEST_MODE = false; // Измените на false для реальных бронирований
    
    // Настройка логирования в файл
    $logFile = __DIR__ . '/../../logs/yclients-booking.log';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    
    // Функция для записи в файл логов И в терминал
    $logToFile = function($message) use ($logFile) {
        $timestamp = date('Y-m-d H:i:s');
        $logMessage = "[{$timestamp}] {$message}\n";
        
        // Записываем в файл
        @file_put_contents($logFile, $logMessage, FILE_APPEND);
        
        // Выводим в терминал (stderr для логов) - только если доступен (CLI режим)
        if (defined('STDERR') && is_resource(STDERR)) {
            @fwrite(STDERR, $logMessage);
        }
        
        // Также логируем в стандартный error_log
        error_log($message);
    };
    
    // Переопределяем error_log для вывода в терминал
    $originalErrorLog = function_exists('error_log') ? null : null;
    $log = function($message) use ($logToFile) {
        // Используем нашу функцию, которая выводит и в файл, и в терминал
        $logToFile($message);
    };
    
    // Логируем начало обработки заявки (для удобства поиска в логах)
    $log("");
    $log("═══════════════════════════════════════════════════════");
    $log("🚀 НАЧАЛО ОБРАБОТКИ БРОНИРОВАНИЯ " . ($YClients_TEST_MODE ? "(ТЕСТОВЫЙ РЕЖИМ)" : "(РЕАЛЬНЫЙ РЕЖИМ)"));
    $log("═══════════════════════════════════════════════════════");
    $log("📋 Входные данные: " . json_encode($bookingData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    $log("═══════════════════════════════════════════════════════");
    
    // Конфигурация YClients API
    $yclientsBearerToken = 'nux5dyunjmauan8zar4r';
    $yclientsUserToken = '905010bc6e633654624061a480566ba9';
    $yclientsCompanyId = '115469';
    // YClients API v2 использует другой базовый URL
    // Попробуем оба варианта: v1 и v2
    $yclientsApiBase = "https://api.yclients.com/api/v1/company/{$yclientsCompanyId}";
    // Альтернативный вариант для v2 (если v1 не работает):
    // $yclientsApiBase = "https://api.yclients.com/api/v2/company/{$yclientsCompanyId}";
    
    // Маппинг залов на staff_id в YClients
    $hallYClientsMapping = [
        'armaloft' => '267195',
        'mercury' => '3414531',
        'merkuri' => '3414531',
        'airplane' => '3610778',
        'samolet' => '3610778',
        'rufer' => '3295198',
        'pulka' => '3295199'
    ];
    
    // Маппинг залов на service_id в YClients (ID услуги для бронирования)
    // Если услуга не указана для зала, используется дефолтная
    $hallServiceMapping = [
        'armaloft' => '25829928', // ID услуги для бронирования зала
        'mercury' => '25829928',
        'merkuri' => '25829928',
        'airplane' => '25829928',
        'samolet' => '25829928',
        'rufer' => '25829928',
        'pulka' => '25829928'
    ];
    
    // Дефолтный service_id, если не найден в маппинге
    $defaultServiceId = '25829928'; // ID услуги для бронирования зала
    
    // Маппинг количества часов на service_id в YClients (ID услуги для бронирования)
    $hoursServiceMapping = [
        1 => '1456577',   // 1 час
        2 => '1647652',   // 2 часа
        3 => '1647658',   // 3 часа
        4 => '1647663',   // 4 часа
        5 => '1647666',   // 5 часов
        6 => '1647678',   // 6 часов
        7 => '1647702',   // 7 часов
        8 => '1647710',   // 8 часов
        9 => '1647714',   // 9 часов
        10 => '25869594', // 10 часов
        11 => '25869618', // 11 часов
        12 => '25869672'  // 12 часов
    ];
    
    $hall = $bookingData['hall'] ?? '';
    $hallLower = strtolower(trim($hall));
    
    // Логируем исходное значение зала для отладки
    $log("YClients: Processing hall '{$hall}' (lowercase: '{$hallLower}')");
    
    // Получаем staff_id для зала
    $staffId = null;
    $matchedKey = null;
    foreach ($hallYClientsMapping as $hallKey => $staffIdValue) {
        if (strpos($hallLower, $hallKey) !== false) {
            $staffId = $staffIdValue;
            $matchedKey = $hallKey;
            break;
        }
    }
    
    if (!$staffId) {
        $log("❌ YClients: Hall '{$hall}' (lowercase: '{$hallLower}') not found in mapping");
        $log("📝 Available hall keys: " . implode(', ', array_keys($hallYClientsMapping)));
        $log("📝 Full booking data: " . json_encode($bookingData, JSON_UNESCAPED_UNICODE));
        return ['success' => false, 'error' => "Hall '{$hall}' not found in mapping. Available: " . implode(', ', array_keys($hallYClientsMapping))];
    }
    
    $log("✅ YClients: Hall '{$hall}' matched to key '{$matchedKey}' → staff_id: {$staffId}");
    
    // Парсим дату и время
    $bookingDate = $bookingData['date'] ?? '';
    $timeFrom = $bookingData['timeFrom'] ?? '';
    $timeTo = $bookingData['timeTo'] ?? '';
    
    if (!$bookingDate || !$timeFrom || !$timeTo) {
        $log("YClients: Missing required fields (date, timeFrom, timeTo)");
        return ['success' => false, 'error' => 'Missing required fields'];
    }
    
    // ВАЛИДАЦИЯ: Проверяем минимальное количество часов бронирования
    global $db;
    $validation = validateBookingDuration($matchedKey, $bookingDate, $timeFrom, $timeTo, $db);
    
    if (!$validation['valid']) {
        $log("❌ YClients: Booking duration validation failed: " . $validation['error']);
        return ['success' => false, 'error' => $validation['error']];
    }
    
    // Вычисляем количество часов бронирования (с учетом перехода через полночь)
    $duration = calculateDuration($timeFrom, $timeTo);
    $durationMinutes = $duration;
    
    // Если время окончания меньше времени начала, считаем что это следующий день
    if ($durationMinutes < 0) {
        $durationMinutes += 24 * 60; // Добавляем 24 часа
    }
    
    $durationHours = round($durationMinutes / 60);
    
    // Логируем вычисленную длительность для отладки
    $log("🔍 YClients: Time calculation - From: {$timeFrom}, To: {$timeTo}, Duration: {$durationMinutes} minutes = {$durationHours} hours");
    
    // ВАЛИДАЦИЯ: Проверяем максимальную длительность бронирования (12 часов)
    $maxDurationHours = 12;
    if ($durationHours > $maxDurationHours) {
        $errorMessage = "Максимальная длительность бронирования через сайт составляет {$maxDurationHours} часов. Для бронирования на {$durationHours} часов пожалуйста, обратитесь к менеджеру";
        $log("❌ YClients: Booking duration exceeds maximum: {$durationHours} hours > {$maxDurationHours} hours");
        return ['success' => false, 'error' => $errorMessage];
    }
    
    // ВАЛИДАЦИЯ: Проверяем что длительность не нулевая и положительная
    if ($durationHours <= 0) {
        $log("❌ YClients: Invalid booking duration: {$durationHours} hours (calculated from {$timeFrom} to {$timeTo})");
        return ['success' => false, 'error' => 'Некорректная длительность бронирования. Пожалуйста, проверьте выбранное время.'];
    }
    
    // Получаем service_id на основе количества часов
    $serviceId = $hoursServiceMapping[$durationHours] ?? $defaultServiceId;
    
    // Детальное логирование для отладки
    if (isset($hoursServiceMapping[$durationHours])) {
        $log("✅ YClients: Duration: {$durationHours} hours → Service ID: {$serviceId} (found in mapping)");
    } else {
        $log("⚠️ YClients: Duration: {$durationHours} hours → Service ID: {$serviceId} (NOT in mapping, using default)");
        $log("📋 Available mappings: " . implode(', ', array_keys($hoursServiceMapping)) . " hours");
    }
    
    // Форматируем дату и время для YClients API
    // YClients ожидает формат: YYYY-MM-DD HH:MM:SS
    // Нормализуем время: убираем секунды если есть, оставляем формат HH:MM
    $timeFromClean = trim($timeFrom);
    $timeToClean = trim($timeTo);
    
    // Если время в формате HH:MM:SS, убираем секунды
    if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $timeFromClean)) {
        $timeFromClean = substr($timeFromClean, 0, 5); // Берем только HH:MM
    }
    if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $timeToClean)) {
        $timeToClean = substr($timeToClean, 0, 5); // Берем только HH:MM
    }
    
    // Проверяем, что время в формате HH:MM
    if (!preg_match('/^\d{2}:\d{2}$/', $timeFromClean) || !preg_match('/^\d{2}:\d{2}$/', $timeToClean)) {
        $log("YClients: Invalid time format. timeFrom: '{$timeFrom}' (cleaned: '{$timeFromClean}'), timeTo: '{$timeTo}' (cleaned: '{$timeToClean}')");
        return ['success' => false, 'error' => "Invalid time format. Expected HH:MM, got timeFrom: '{$timeFrom}', timeTo: '{$timeTo}'"];
    }
    
    $dateTimeFrom = $bookingDate . ' ' . $timeFromClean . ':00';
    
    // Получаем имя, телефон и email клиента
    $clientName = trim($bookingData['name'] ?? 'Клиент');
    $clientPhone = preg_replace('/[^0-9]/', '', $bookingData['phone'] ?? '');
    $clientEmail = trim($bookingData['email'] ?? '');
    
    // Валидация обязательных полей клиента
    if (empty($clientName) || strlen($clientName) < 2) {
        $log("YClients: Invalid client name: '{$clientName}'");
        return ['success' => false, 'error' => 'Invalid client name'];
    }
    
    if (empty($clientPhone) || strlen($clientPhone) < 10) {
        $log("YClients: Invalid client phone: '{$clientPhone}'");
        return ['success' => false, 'error' => 'Invalid client phone'];
    }
    
    // Email обязателен для YClients API
    // Если email не предоставлен, используем тестовый email
    if (empty($clientEmail) || !filter_var($clientEmail, FILTER_VALIDATE_EMAIL)) {
        // Используем тестовый email для YClients API
        $clientEmail = "d@yclients.com";
        $log("⚠️ YClients: Email not provided or invalid, using test email: {$clientEmail}");
    }
    
    // Формируем запрос к YClients API для создания записи
    // Правильный endpoint: https://api.yclients.com/api/v1/book_record/{company_id}
    $yclientsUrl = "https://api.yclients.com/api/v1/book_record/{$yclientsCompanyId}";
    
    // Используем уже вычисленную длительность (в минутах) и пересчитываем в секунды
    // $durationMinutes уже вычислено выше с учетом перехода через полночь
    $durationSeconds = $durationMinutes * 60; // Длительность в секундах для seance_length
    
    // Создаем одну запись на весь период бронирования
    $appointments = [
        [
            'id' => 1, // ОБЯЗАТЕЛЬНО! Уникальный ID для записи
            'services' => [(int)$serviceId], // Массив ID услуг - ОБЯЗАТЕЛЬНО должен содержать хотя бы одну услугу
            'staff_id' => (int)$staffId,
            'datetime' => $dateTimeFrom, // Формат: YYYY-MM-DD HH:MM:SS - время начала бронирования
            'seance_length' => (int)$durationSeconds, // Длительность записи в секундах
            'custom_fields' => [] // Кастомные поля записи (пустой объект)
        ]
    ];
    
    // Формируем данные для YClients API согласно правильному формату
    $orderId = $bookingData['orderId'] ?? 'N/A';
    $orderComment = "Бронирование зала {$hall}. Заказ: {$orderId}. Длительность: {$durationHours} ч.";
    
    $yclientsData = [
        'phone' => $clientPhone,
        'fullname' => $clientName,
        'email' => $clientEmail, // ОБЯЗАТЕЛЬНОЕ поле для YClients API
        'comment' => $orderComment,
        'type' => 'mobile', // Тип записи
        'notify_by_sms' => 0, // Уведомления по SMS (0 = отключено)
        'notify_by_email' => 0, // Уведомления по email (0 = отключено)
        'api_id' => $orderId, // ID заказа для отслеживания
        'custom_fields' => [], // Кастомные поля клиента (пустой объект)
        'appointments' => $appointments // Массив записей (одна запись на весь период бронирования)
    ];
    
    // Добавляем комментарий, если API поддерживает (может быть в другом месте или не поддерживаться)
    // Комментарий можно добавить в отдельное поле, если API это поддерживает
    // Пока оставляем без комментария, так как в примере его нет
    
    // Добавляем комментарий с информацией о заказе (опциональное поле)
    $orderComment = "Бронирование зала {$hall}. Заказ: " . ($bookingData['orderId'] ?? 'N/A');
    if (!empty($orderComment)) {
        $yclientsData['comment'] = $orderComment;
    }
    
    $log("✅ YClients: Using service_id: {$serviceId} for booking");
    $log("✅ YClients: Client email: {$clientEmail}");
    
    // Если API вернет ошибку, попробуем альтернативный формат (для совместимости)
    // Но сначала пробуем стандартный формат
    
    // Детальное логирование запроса
    $log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    $log("📤 YCLIENTS: Отправка запроса на создание бронирования");
    $log("📍 URL: {$yclientsUrl}");
    $log("🏢 Зал: '{$hall}' → staff_id: {$staffId}");
    $log("🎯 Service ID: {$serviceId} (обязательная услуга)");
    $log("📅 Дата: {$bookingDate}");
    $log("⏰ Время: {$timeFromClean} - {$timeToClean}");
    $log("📆 Дата/время начала: {$dateTimeFrom}");
    $log("⏱️  Длительность: {$durationMinutes} минут ({$durationHours} часов) = {$durationSeconds} секунд");
    $log("👤 Клиент: {$clientName}");
    $log("📞 Телефон: {$clientPhone}");
    $log("📧 Email: {$clientEmail}");
    $log("🆔 Order ID: " . ($bookingData['orderId'] ?? 'N/A'));
    $log("📦 Данные запроса (JSON):");
    $log(json_encode($yclientsData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    $log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // ТЕСТОВЫЙ РЕЖИМ: только логируем, не отправляем реальный запрос
    if ($YClients_TEST_MODE) {
        $log("");
        $log("═══════════════════════════════════════════════════════");
        $log("🧪 YCLIENTS ТЕСТОВЫЙ РЕЖИМ (запрос НЕ отправлен)");
        $log("═══════════════════════════════════════════════════════");
        $log("📍 URL: {$yclientsUrl}");
        $log("🏢 Зал: '{$hall}' → staff_id: {$staffId}");
        $log("🎯 Service ID: {$serviceId} (обязательная услуга)");
        $log("📅 Дата: {$bookingDate}");
        $log("⏰ Время: {$timeFrom} - {$timeTo}");
        $log("📆 Дата/время для API: {$dateTimeFrom}");
        $log("⏱️  Длительность: {$durationMinutes} минут ({$durationHours} часов)");
        $log("👤 Клиент: {$clientName}");
        $log("📞 Телефон: {$clientPhone}");
        $log("🆔 Order ID: " . ($bookingData['orderId'] ?? 'N/A'));
        $log("");
        $log("📦 Данные запроса (JSON):");
        $log(json_encode($yclientsData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        $log("");
        $log("✅ В реальном режиме эти данные были бы отправлены в YClients");
        $log("═══════════════════════════════════════════════════════");
        $log("📁 Логи также сохранены в файл: {$logFile}");
        $log("💡 Для просмотра логов выполните: tail -f {$logFile}");
        $log("═══════════════════════════════════════════════════════");
        $log("");
        
        // Возвращаем успешный результат для тестирования
        return [
            'success' => true, 
            'test_mode' => true,
            'message' => 'Тестовый режим: запрос не отправлен в YClients',
            'data' => [
                'url' => $yclientsUrl,
                'request_data' => $yclientsData,
                'staff_id' => $staffId,
                'hall' => $hall
            ]
        ];
    }
    
    // РЕАЛЬНЫЙ РЕЖИМ: отправляем запрос в YClients
    // Пробуем разные варианты формата запроса, если первый не сработает
    
    // Вариант 1: Стандартный формат API v2
    $requestBody = json_encode($yclientsData, JSON_UNESCAPED_UNICODE);
    
    $ch = curl_init($yclientsUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $requestBody);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/vnd.api.v2+json',
        "Authorization: Bearer {$yclientsBearerToken}, User {$yclientsUserToken}"
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_VERBOSE, false); // Отключаем verbose для продакшена
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $curlInfo = curl_getinfo($ch);
    curl_close($ch);
    
    if ($curlError) {
        $log("YClients API cURL error: {$curlError}");
        return ['success' => false, 'error' => "YClients API connection error: {$curlError}"];
    }
    
    $responseData = json_decode($response, true);
    
    // Детальное логирование ответа
    $log("YClients API response (HTTP {$httpCode}): " . substr($response, 0, 1000));
    $log("YClients API request URL: {$curlInfo['url']}");
    
    // Если получили 404, пробуем альтернативный формат данных
    if ($httpCode === 404) {
        $log("⚠️ YClients API returned 404, trying alternative data format...");
        
        // Альтернативный формат: возможно, нужно передавать client_id вместо объекта client
        // Или использовать другой endpoint
        // Пока логируем для отладки
        $log("📝 Original request data: " . $requestBody);
        $log("📝 Response: " . $response);
        
        // Возможно, проблема в том, что staff_id не существует или формат данных неправильный
        // Проверяем, что staff_id валидный
        if (!is_numeric($staffId) || $staffId <= 0) {
            $log("❌ Invalid staff_id: {$staffId}");
            return ['success' => false, 'error' => "Invalid staff_id: {$staffId}", 'response' => $responseData, 'http_code' => $httpCode];
        }
    }
    
    if ($httpCode === 200 || $httpCode === 201) {
        // Проверяем структуру ответа YClients
        if (isset($responseData['data']) || isset($responseData['id']) || (isset($responseData['success']) && $responseData['success'] === true)) {
            $log("✅ YClients booking created successfully. Response: " . json_encode($responseData, JSON_UNESCAPED_UNICODE));
        return ['success' => true, 'data' => $responseData];
    } else {
            // Ответ 200/201, но структура неожиданная - возможно ошибка в данных
            $log("⚠️ YClients API returned {$httpCode} but unexpected response structure: " . json_encode($responseData, JSON_UNESCAPED_UNICODE));
            return ['success' => false, 'error' => 'Unexpected response structure', 'response' => $responseData];
    }
    } else {
        // Детальная обработка ошибок
        $errorMessage = "YClients API error: HTTP {$httpCode}";
        if (isset($responseData['meta']['message'])) {
            $errorMessage .= " - " . $responseData['meta']['message'];
        } elseif (isset($responseData['message'])) {
            $errorMessage .= " - " . $responseData['message'];
        } elseif (isset($responseData['error'])) {
            $errorMessage .= " - " . (is_string($responseData['error']) ? $responseData['error'] : json_encode($responseData['error']));
        }
        
        // Дополнительная диагностика для 404
        if ($httpCode === 404) {
            $errorMessage .= " (Возможные причины: неправильный endpoint, неверный staff_id, или формат данных не соответствует API)";
            error_log("🔍 Диагностика 404:");
            error_log("   - URL: {$yclientsUrl}");
            error_log("   - Staff ID: {$staffId}");
            error_log("   - Company ID: {$yclientsCompanyId}");
            error_log("   - Request body: " . substr($requestBody, 0, 500));
        }
        
        error_log("❌ {$errorMessage}");
        error_log("📝 Full response: " . json_encode($responseData, JSON_UNESCAPED_UNICODE));
        
        return ['success' => false, 'error' => $errorMessage, 'response' => $responseData, 'http_code' => $httpCode];
    }
}

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
            
            // ВАЛИДАЦИЯ: Проверяем минимальное количество часов бронирования
            if (isset($booking['hall']) && isset($booking['date']) && isset($booking['timeFrom']) && isset($booking['timeTo'])) {
                $validation = validateBookingDuration(
                    $booking['hall'],
                    $booking['date'],
                    $booking['timeFrom'],
                    $booking['timeTo'],
                    $db
                );
                
                if (!$validation['valid']) {
                    http_response_code(400);
                    echo json_encode(['error' => $validation['error']], JSON_UNESCAPED_UNICODE);
                    exit;
                }
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
                // Получаем процент предоплаты из настроек
                $settings = $db->fetchOne("SELECT payment_percent FROM settings ORDER BY id DESC LIMIT 1");
                $paymentPercent = isset($settings['payment_percent']) && $settings['payment_percent'] !== null
                    ? (float)$settings['payment_percent'] / 100
                    : 0.5; // По умолчанию 50%
                $paymentAmount = $pricing['totalPrice'] * $paymentPercent;
                echo json_encode([
                    'success' => true,
                    'orderId' => $orderId,
                    'amount' => $paymentAmount * 100, // в копейках
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

            // Telegram bot configuration (from settings or fallback to hardcoded)
            $settings = $db->fetchOne("SELECT telegram_bot_token, telegram_chat_id FROM settings ORDER BY id DESC LIMIT 1");
            $telegramBotToken = $settings['telegram_bot_token'] ?? '8410055486:AAGtyvO9L5rXAdpx-UFZ9D8Wxfwb1DTHGII';
            $telegramChatId = $settings['telegram_chat_id'] ?? '7913987008';

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
            $totalPrice = $pricing['totalPrice'] ?? 0;
            // Получаем процент предоплаты из настроек
            $settings = $db->fetchOne("SELECT payment_percent FROM settings ORDER BY id DESC LIMIT 1");
            $paymentPercent = isset($settings['payment_percent']) && $settings['payment_percent'] !== null
                ? (float)$settings['payment_percent']
                : 50; // По умолчанию 50%
            $paymentAmount = $totalPrice * ($paymentPercent / 100);
            $message .= "Полная сумма: *" . number_format($totalPrice, 0, ',', ' ') . " ₽*\n";
            $message .= "К оплате ({$paymentPercent}%): *" . number_format($paymentAmount, 0, ',', ' ') . " ₽*\n";
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

            // Обновляем статус бронирования независимо от результата Telegram
            if (!empty($orderId) && $orderId !== 'N/A') {
                try {
                    // Определяем статус: если оплата отключена или успешна - 'paid', иначе 'pending'
                    $paymentDisabled = $data['paymentDisabled'] ?? false;
                    $finalStatus = ($paymentStatus === 'success' || $paymentStatus === 'no_payment' || $paymentDisabled) ? 'paid' : 'pending';
                    
                    $db->execute("
                        UPDATE bookings 
                        SET status = ?, telegram_sent = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE order_id = ?
                    ", [
                        $finalStatus,
                        $httpCode === 200 ? 1 : 0,
                        $orderId
                    ]);
                } catch (PDOException $e) {
                    error_log('Error updating booking status: ' . $e->getMessage());
                }
            }
            
            // Создаем запись в YClients независимо от результата Telegram
            // Вызываем только если:
            // 1. Оплата успешна (success) - после успешной оплаты
            // НЕ создаем при:
            // - pending (ожидание оплаты)
            // - no_payment или paymentDisabled (оплата отключена) - это только заявка, не бронирование
            $paymentDisabled = $data['paymentDisabled'] ?? false;
            $shouldCreateBooking = ($paymentStatus === 'success');
            
            if ($shouldCreateBooking) {
                error_log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                error_log("🔄 YCLIENTS: Начинаем создание бронирования");
                error_log("📋 Order ID: {$orderId}");
                error_log("💰 Статус оплаты: {$paymentStatus}");
                error_log("💳 Оплата отключена: " . ($paymentDisabled ? 'да' : 'нет'));
                
                try {
                    $yclientsResult = createYClientsBooking(array_merge($booking, [
                        'orderId' => $orderId
                    ]));
                    
                    if ($yclientsResult['success']) {
                        if (isset($yclientsResult['test_mode']) && $yclientsResult['test_mode']) {
                            error_log("✅ YCLIENTS: Тестовый режим - запрос НЕ отправлен (это нормально!)");
                            error_log("📝 Проверьте логи выше для деталей запроса");
                        } else {
                            error_log("✅ YCLIENTS: Бронирование успешно создано в YClients");
                            error_log("📝 Order ID: {$orderId}");
                            if (isset($yclientsResult['data'])) {
                                error_log("📝 YClients Response Data: " . json_encode($yclientsResult['data'], JSON_UNESCAPED_UNICODE));
                            }
                        }
                    } else {
                        error_log("❌ YCLIENTS: Ошибка создания бронирования");
                        error_log("📝 Order ID: {$orderId}");
                        error_log("📝 Ошибка: " . ($yclientsResult['error'] ?? 'Unknown'));
                        if (isset($yclientsResult['http_code'])) {
                            error_log("📝 HTTP Code: " . $yclientsResult['http_code']);
                        }
                        if (isset($yclientsResult['response'])) {
                            error_log("📝 YClients Response: " . json_encode($yclientsResult['response'], JSON_UNESCAPED_UNICODE));
                        }
                    }
                } catch (Exception $e) {
                    error_log("❌ YCLIENTS: Исключение при создании бронирования");
                    error_log("📝 Order ID: {$orderId}");
                    error_log("📝 Ошибка: " . $e->getMessage());
                    // Не блокируем процесс из-за ошибки YClients
                }
                error_log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            } else {
                error_log("⏭️  YCLIENTS: Пропущено (статус оплаты: {$paymentStatus})");
            }

            if ($httpCode === 200) {
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
        } elseif ($action === 'test-yclients') {
            // Тестирование интеграции с YClients без создания реального бронирования
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!$data || !isset($data['booking'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid request data. booking field is required']);
                exit;
            }
            
            $booking = $data['booking'];
            
            // Вызываем функцию в тестовом режиме
            $result = createYClientsBooking(array_merge($booking, [
                'orderId' => 'TEST_' . time()
            ]));
            
            echo json_encode([
                'success' => true,
                'test_mode' => true,
                'message' => 'Тестовый запрос выполнен. Проверьте логи сервера для деталей.',
                'result' => $result
            ], JSON_UNESCAPED_UNICODE);
        } elseif ($action === 'test-telegram') {
            // Test Telegram notification
            $data = json_decode(file_get_contents('php://input'), true);
            $testMessage = $data['message'] ?? 'Тестовое сообщение';
            
            // Telegram bot configuration (from settings or fallback to hardcoded)
            $settings = $db->fetchOne("SELECT telegram_bot_token, telegram_chat_id FROM settings ORDER BY id DESC LIMIT 1");
            $telegramBotToken = $settings['telegram_bot_token'] ?? '8410055486:AAGtyvO9L5rXAdpx-UFZ9D8Wxfwb1DTHGII';
            $telegramChatId = $settings['telegram_chat_id'] ?? '7913987008';

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
        } elseif ($action === 'tbank-callback') {
            // Обработка callback от Tbank при успешной оплате
            $callbackData = json_decode(file_get_contents('php://input'), true);
            
            if (!$callbackData) {
                // Пробуем получить данные из POST
                $callbackData = $_POST;
            }
            
            error_log('Tbank callback received: ' . json_encode($callbackData, JSON_UNESCAPED_UNICODE));
            
            // Проверяем статус оплаты
            $status = $callbackData['Status'] ?? $callbackData['status'] ?? null;
            $orderId = $callbackData['OrderId'] ?? $callbackData['orderId'] ?? null;
            
            if ($status === 'CONFIRMED' || $status === 'confirmed') {
                // Оплата успешна
                if ($orderId) {
                    try {
                        // Получаем данные бронирования из БД
                        $booking = $db->fetchOne("
                            SELECT * FROM bookings WHERE order_id = ?
                        ", [$orderId]);
                        
                        if ($booking) {
                            // Обновляем статус на 'paid'
                            $db->execute("
                                UPDATE bookings 
                                SET status = 'paid', updated_at = CURRENT_TIMESTAMP
                                WHERE order_id = ?
                            ", [$orderId]);
                            
                             error_log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                             error_log("🔄 YCLIENTS: Callback от Tbank - создание бронирования");
                             error_log("📋 Order ID: {$orderId}");
                             error_log("💰 Статус: CONFIRMED (оплата успешна)");
                             
                             // Создаем запись в YClients
                             try {
                                 $yclientsResult = createYClientsBooking([
                                     'hall' => $booking['hall'],
                                     'date' => $booking['booking_date'],
                                     'timeFrom' => $booking['time_from'],
                                     'timeTo' => $booking['time_to'],
                                     'name' => $booking['client_name'],
                                     'phone' => $booking['client_phone'],
                                     'orderId' => $orderId
                                 ]);
                                 
                                 if ($yclientsResult['success']) {
                                     if (isset($yclientsResult['test_mode']) && $yclientsResult['test_mode']) {
                                         error_log("✅ YCLIENTS: Тестовый режим - запрос НЕ отправлен (это нормально!)");
                                     } else {
                                         error_log("✅ YCLIENTS: Бронирование успешно создано в YClients из callback");
                                         error_log("📝 Order ID: {$orderId}");
                                         if (isset($yclientsResult['data'])) {
                                             error_log("📝 YClients Response Data: " . json_encode($yclientsResult['data'], JSON_UNESCAPED_UNICODE));
                                         }
                                     }
                                 } else {
                                     error_log("❌ YCLIENTS: Ошибка создания бронирования из callback");
                                     error_log("📝 Order ID: {$orderId}");
                                     error_log("📝 Ошибка: " . ($yclientsResult['error'] ?? 'Unknown'));
                                     if (isset($yclientsResult['http_code'])) {
                                         error_log("📝 HTTP Code: " . $yclientsResult['http_code']);
                                     }
                                     if (isset($yclientsResult['response'])) {
                                         error_log("📝 YClients Response: " . json_encode($yclientsResult['response'], JSON_UNESCAPED_UNICODE));
                                     }
                                 }
                             } catch (Exception $e) {
                                 error_log("❌ YCLIENTS: Исключение при создании бронирования из callback");
                                 error_log("📝 Order ID: {$orderId}");
                                 error_log("📝 Ошибка: " . $e->getMessage());
                                 error_log("📝 Stack trace: " . $e->getTraceAsString());
                             }
                             error_log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                            
                            // Отправляем уведомление в Telegram
                            try {
                                // Telegram bot configuration (from settings or fallback to hardcoded)
                                $telegramSettings = $db->fetchOne("SELECT telegram_bot_token, telegram_chat_id FROM settings ORDER BY id DESC LIMIT 1");
                                $telegramBotToken = $telegramSettings['telegram_bot_token'] ?? '8410055486:AAGtyvO9L5rXAdpx-UFZ9D8Wxfwb1DTHGII';
                                $telegramChatId = $telegramSettings['telegram_chat_id'] ?? '7913987008';
                                
                                $message = "✅ *Оплата подтверждена*\n\n";
                                $message .= "Номер заказа: *{$orderId}*\n";
                                $message .= "Зал: *{$booking['hall']}*\n";
                                $message .= "Дата: *{$booking['booking_date']}*\n";
                                $message .= "Время: *{$booking['time_from']} - {$booking['time_to']}*\n";
                                $message .= "Клиент: *{$booking['client_name']}*\n";
                                $message .= "Телефон: *{$booking['client_phone']}*\n";
                                
                                $telegramUrl = "https://api.telegram.org/bot{$telegramBotToken}/sendMessage";
                                $telegramData = [
                                    'chat_id' => is_numeric($telegramChatId) ? (int)$telegramChatId : $telegramChatId,
                                    'text' => $message,
                                    'parse_mode' => 'Markdown'
                                ];
                                
                                $ch = curl_init($telegramUrl);
                                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                                curl_setopt($ch, CURLOPT_POST, true);
                                curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($telegramData));
                                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                                curl_exec($ch);
                                curl_close($ch);
                            } catch (Exception $e) {
                                error_log("Error sending Telegram notification from callback: " . $e->getMessage());
                            }
                        }
                    } catch (PDOException $e) {
                        error_log('Error processing Tbank callback: ' . $e->getMessage());
                    }
                }
            }
            
            // Всегда возвращаем успех для Tbank (чтобы они не повторяли запрос)
            http_response_code(200);
            echo 'OK';
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Action not found']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

