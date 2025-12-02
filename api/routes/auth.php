<?php
/**
 * Authentication API routes
 */

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();

// Parse the request URI to get the action
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = trim($path, '/');

// Split into segments
$segments = explode('/', $path);

// Find 'auth' in the path and get the next segment (the action)
$action = null;
for ($i = 0; $i < count($segments); $i++) {
    if ($segments[$i] === 'auth' && isset($segments[$i + 1])) {
        $action = $segments[$i + 1];
        break;
    }
}

switch ($_SERVER['REQUEST_METHOD']) {
    case 'POST':
        if ($action === 'login') {
            // Login user
            $rawInput = file_get_contents('php://input');
            error_log('Raw input: ' . $rawInput);
            
            $data = json_decode($rawInput, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                error_log('JSON decode error: ' . json_last_error_msg());
                http_response_code(400);
                echo json_encode(['error' => 'Invalid JSON: ' . json_last_error_msg()]);
                exit;
            }
            
            $username = $data['username'] ?? null;
            $password = $data['password'] ?? null;
            
            error_log('Username: ' . $username);
            error_log('Password provided: ' . ($password ? 'yes' : 'no'));
            
            if (!$username || !$password) {
                http_response_code(400);
                echo json_encode(['error' => 'Username and password required']);
                exit;
            }
            
            try {
                $user = $db->fetchOne("SELECT * FROM users WHERE username = ?", [$username]);
                
                error_log('User found: ' . ($user ? 'yes' : 'no'));
                if ($user) {
                    error_log('User ID: ' . $user['id']);
                    error_log('User username: ' . $user['username']);
                    error_log('Password hash length: ' . strlen($user['password_hash']));
                }
                
                if (!$user) {
                    http_response_code(401);
                    echo json_encode(['error' => 'Invalid credentials - user not found']);
                    exit;
                }
                
                $passwordValid = password_verify($password, $user['password_hash']);
                error_log('Password valid: ' . ($passwordValid ? 'yes' : 'no'));
                
                if (!$passwordValid) {
                    http_response_code(401);
                    echo json_encode(['error' => 'Invalid credentials - wrong password']);
                    exit;
                }
                
                // Start session if not already started
                if (session_status() === PHP_SESSION_NONE) {
                    session_start();
                }
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['role'] = $user['role'];
                
                error_log('Session started. User ID: ' . $_SESSION['user_id']);
                
                echo json_encode([
                    'success' => true,
                    'user' => [
                        'id' => $user['id'],
                        'username' => $user['username'],
                        'role' => $user['role']
                    ]
                ], JSON_UNESCAPED_UNICODE);
            } catch (PDOException $e) {
                error_log('PDO Error: ' . $e->getMessage());
                error_log('PDO Error Code: ' . $e->getCode());
                http_response_code(500);
                echo json_encode(['error' => 'Login failed: ' . $e->getMessage()]);
            } catch (Exception $e) {
                error_log('General Error: ' . $e->getMessage());
                http_response_code(500);
                echo json_encode(['error' => 'Login failed: ' . $e->getMessage()]);
            }
        } elseif ($action === 'create-user') {
            // Create user (for initial setup)
            $data = json_decode(file_get_contents('php://input'), true);
            
            $username = $data['username'] ?? null;
            $password = $data['password'] ?? null;
            $role = $data['role'] ?? 'manager';
            
            if (!$username || !$password) {
                http_response_code(400);
                echo json_encode(['error' => 'Username and password required']);
                exit;
            }
            
            try {
                $existing = $db->fetchOne("SELECT id FROM users WHERE username = ?", [$username]);
                
                if ($existing) {
                    http_response_code(409);
                    echo json_encode(['error' => 'User already exists']);
                    exit;
                }
                
                $passwordHash = password_hash($password, PASSWORD_DEFAULT);
                
                $db->execute("
                    INSERT INTO users (username, password_hash, role)
                    VALUES (?, ?, ?)
                ", [$username, $passwordHash, $role]);
                
                $userId = $db->lastInsertId();
                
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'User created successfully',
                    'userId' => $userId
                ], JSON_UNESCAPED_UNICODE);
            } catch (PDOException $e) {
                http_response_code(500);
                error_log('Error creating user: ' . $e->getMessage());
                echo json_encode(['error' => 'Failed to create user']);
            }
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Action not found: ' . $action]);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
