<?php
/**
 * Admin login page - PHP version
 */

session_start();

// If already logged in, redirect to admin
if (isset($_SESSION['user_id'])) {
    header('Location: /admin');
    exit;
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Вход в админку</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            width: 100%;
            max-width: 400px;
        }
        
        .login-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .login-header h1 {
            color: #333;
            font-size: 24px;
            margin-bottom: 10px;
        }
        
        .login-header p {
            color: #666;
            font-size: 14px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }
        
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            font-family: inherit;
            transition: border-color 0.3s;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .btn-login {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        .btn-login:hover {
            background: #5568d3;
        }
        
        .btn-login:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .error-message {
            background: #ffebee;
            color: #f44336;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 14px;
            display: none;
        }
        
        .error-message.show {
            display: block;
        }
        
        .loading {
            display: none;
            text-align: center;
            color: #666;
            margin-top: 10px;
        }
        
        .loading.show {
            display: block;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <h1>Админка</h1>
            <p>Войдите в систему управления ценами</p>
        </div>
        
        <div id="error-message" class="error-message"></div>
        
        <form id="login-form">
            <div class="form-group">
                <label for="username">Логин:</label>
                <input type="text" id="username" name="username" required autocomplete="username">
            </div>
            
            <div class="form-group">
                <label for="password">Пароль:</label>
                <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>
            
            <button type="submit" class="btn-login" id="login-btn">Войти</button>
            
            <div id="loading" class="loading">Вход в систему...</div>
        </form>
    </div>
    
    <script>
        const form = document.getElementById('login-form');
        const errorMessage = document.getElementById('error-message');
        const loginBtn = document.getElementById('login-btn');
        const loading = document.getElementById('loading');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // Сброс ошибок
            errorMessage.classList.remove('show');
            errorMessage.textContent = '';
            loginBtn.disabled = true;
            loading.classList.add('show');
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Ошибка входа');
                }
                
                // Redirect to admin panel (PHP will handle session)
                window.location.href = '/admin';
                
            } catch (error) {
                errorMessage.textContent = error.message || 'Ошибка входа. Проверьте логин и пароль.';
                errorMessage.classList.add('show');
                loginBtn.disabled = false;
                loading.classList.remove('show');
            }
        });
    </script>
</body>
</html>

