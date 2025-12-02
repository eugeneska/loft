<?php
/**
 * Тестовый скрипт для проверки API логина
 * Откройте в браузере: http://localhost:8000/test-api-login.php
 */

echo "<h2>Тест API логина</h2>";

// Симулируем запрос к API
$url = 'http://localhost:8000/api/auth/login';
$data = json_encode([
    'username' => 'admin',
    'password' => 'admin123'
]);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Content-Length: ' . strlen($data)
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headers = substr($response, 0, $headerSize);
$body = substr($response, $headerSize);

curl_close($ch);

echo "<h3>HTTP Code: $httpCode</h3>";
echo "<h3>Headers:</h3>";
echo "<pre>" . htmlspecialchars($headers) . "</pre>";
echo "<h3>Response Body:</h3>";
echo "<pre>" . htmlspecialchars($body) . "</pre>";

$responseData = json_decode($body, true);
if ($responseData) {
    echo "<h3>Parsed Response:</h3>";
    echo "<pre>" . print_r($responseData, true) . "</pre>";
    
    if (isset($responseData['success']) && $responseData['success']) {
        echo "<p style='color: green; font-size: 18px;'>✅ Логин успешен!</p>";
        echo "<p>Пользователь: " . htmlspecialchars($responseData['user']['username']) . "</p>";
    } else {
        echo "<p style='color: red; font-size: 18px;'>❌ Ошибка логина</p>";
        if (isset($responseData['error'])) {
            echo "<p>Ошибка: " . htmlspecialchars($responseData['error']) . "</p>";
        }
    }
}

