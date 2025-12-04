<?php
/**
 * Admin page to update merchant terminal_key
 */

require_once __DIR__ . '/../api/config/database.php';

$db = Database::getInstance();
$message = '';
$error = '';

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['terminal_key'])) {
    $terminalKey = trim($_POST['terminal_key']);
    $merchantId = intval($_POST['merchant_id'] ?? 1);
    
    if (empty($terminalKey)) {
        $error = 'Terminal key не может быть пустым';
    } else {
        try {
            $db->execute("
                UPDATE merchant_settings 
                SET terminal_key = ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ", [$terminalKey, $merchantId]);
            
            $message = 'Terminal key успешно обновлен!';
        } catch (Exception $e) {
            $error = 'Ошибка при обновлении: ' . $e->getMessage();
        }
    }
}

// Get current merchant settings
$merchants = $db->fetchAll("SELECT * FROM merchant_settings ORDER BY id");
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Обновление конфигурации мерчанта</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #555;
        }
        input[type="text"], select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }
        button {
            background: #CC7A6F;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background: #b8695d;
        }
        .message {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        .success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .merchant-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .merchant-info h3 {
            margin-top: 0;
            color: #333;
        }
        .merchant-info p {
            margin: 5px 0;
            color: #666;
        }
        .terminal-key-status {
            font-weight: bold;
        }
        .has-key {
            color: #28a745;
        }
        .no-key {
            color: #dc3545;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Обновление конфигурации мерчанта Т-Банк</h1>
        
        <?php if ($message): ?>
            <div class="message success"><?= htmlspecialchars($message) ?></div>
        <?php endif; ?>
        
        <?php if ($error): ?>
            <div class="message error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        
        <?php foreach ($merchants as $merchant): ?>
            <div class="merchant-info">
                <h3>Мерчант: <?= htmlspecialchars($merchant['merchant_name']) ?></h3>
                <p><strong>ID:</strong> <?= htmlspecialchars($merchant['id']) ?></p>
                <p><strong>Merchant ID:</strong> <?= htmlspecialchars($merchant['merchant_id']) ?></p>
                <p><strong>Terminal ID:</strong> <?= htmlspecialchars($merchant['terminal_id']) ?></p>
                <p><strong>SBP Merchant ID:</strong> <?= htmlspecialchars($merchant['sbp_merchant_id']) ?></p>
                <p class="terminal-key-status <?= !empty($merchant['terminal_key']) ? 'has-key' : 'no-key' ?>">
                    <strong>Terminal Key:</strong> 
                    <?= !empty($merchant['terminal_key']) ? htmlspecialchars($merchant['terminal_key']) : 'НЕ УСТАНОВЛЕН' ?>
                </p>
            </div>
            
            <form method="POST">
                <input type="hidden" name="merchant_id" value="<?= htmlspecialchars($merchant['id']) ?>">
                
                <div class="form-group">
                    <label for="terminal_key">Terminal Key (из личного кабинета Т-Банка):</label>
                    <input 
                        type="text" 
                        id="terminal_key" 
                        name="terminal_key" 
                        value="<?= htmlspecialchars($merchant['terminal_key'] ?? '') ?>"
                        placeholder="Введите terminal_key"
                        required
                    >
                </div>
                
                <button type="submit">Обновить Terminal Key</button>
            </form>
        <?php endforeach; ?>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
            <p><strong>Примечание:</strong> Terminal Key можно найти в личном кабинете Т-Банка в разделе настроек мерчанта.</p>
        </div>
    </div>
</body>
</html>

