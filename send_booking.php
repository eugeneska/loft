<?php
/**
 * Отправка заявок на бронирование зала в Telegram
 */

// Настройки Telegram бота
$telegram_bot_token = "8410055486:AAGtyvO9L5rXAdpx-UFZ9D8Wxfwb1DTHGII";
$telegram_chat_id = "7913987008";

// Получение данных из POST запроса
$data = json_decode(file_get_contents('php://input'), true);

// Если данные не пришли как JSON, пробуем получить из POST
if (!$data) {
    $data = $_POST;
}

// Проверка наличия обязательных полей
if (!isset($data['hall_name']) || !isset($data['date']) || !isset($data['time-from']) || !isset($data['time-to']) || !isset($data['guests'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Не все обязательные поля заполнены']);
    exit;
}

// Получение данных
$hallName = htmlspecialchars($data['hall_name'] ?? 'Не указан');
$date = htmlspecialchars($data['date'] ?? '');
$timeFrom = htmlspecialchars($data['time-from'] ?? '');
$timeTo = htmlspecialchars($data['time-to'] ?? '');
$guests = htmlspecialchars($data['guests'] ?? '');
$name = htmlspecialchars($data['name'] ?? 'Не указано');
$phone = htmlspecialchars($data['phone'] ?? 'Не указан');
$price = htmlspecialchars($data['price'] ?? 'Не указана');

// Форматирование даты
$formattedDate = '';
if ($date) {
    $dateObj = DateTime::createFromFormat('Y-m-d', $date);
    if ($dateObj) {
        $formattedDate = $dateObj->format('d.m.Y');
    } else {
        $formattedDate = $date;
    }
}

// Формирование сообщения
$message = "🎯 <b>Новая заявка на бронирование зала</b>\n\n";
$message .= "🏢 <b>Зал:</b> " . $hallName . "\n";
$message .= "📅 <b>Дата:</b> " . $formattedDate . "\n";
$message .= "⏰ <b>Время:</b> " . $timeFrom . " - " . $timeTo . "\n";
$message .= "👥 <b>Количество гостей:</b> " . $guests . "\n";
$message .= "💰 <b>Стоимость:</b> " . $price . "\n\n";
$message .= "👤 <b>Имя:</b> " . $name . "\n";
$message .= "📞 <b>Телефон:</b> " . $phone . "\n";

// Функция отправки сообщения в Telegram
function send_telegram_message($token, $chat_id, $message) {
    $url = "https://api.telegram.org/bot{$token}/sendMessage";
    
    $data = [
        'chat_id' => $chat_id,
        'text' => $message,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        error_log("Telegram API Error: " . $error);
        return false;
    }
    
    if ($httpCode !== 200) {
        error_log("Telegram API HTTP Error: " . $httpCode . " Response: " . $response);
        return false;
    }
    
    $result = json_decode($response, true);
    return $result && isset($result['ok']) && $result['ok'];
}

// Отправка сообщения
$success = send_telegram_message($telegram_bot_token, $telegram_chat_id, $message);

// Ответ клиенту
header('Content-Type: application/json; charset=utf-8');

if ($success) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Заявка успешно отправлена!'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Ошибка при отправке заявки. Попробуйте позже.'
    ]);
}
?>

