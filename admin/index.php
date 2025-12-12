<?php
/**
 * Admin panel - PHP version
 */

session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    header('Location: /admin/login.php');
    exit;
}

$user = [
    'id' => $_SESSION['user_id'],
    'username' => $_SESSION['username'],
    'role' => $_SESSION['role']
];
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Админка - Управление ценами</title>
    <link rel="stylesheet" href="/admin/admin.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Админка - Управление ценами и условиями аренды</h1>
            <div id="message" class="message"></div>
            <div style="text-align: right; margin-top: 10px;">
                <span style="margin-right: 15px; color: #666;">Пользователь: <?php echo htmlspecialchars($user['username']); ?></span>
                <button class="btn btn-danger logout-btn" onclick="admin.logout()">Выйти</button>
            </div>
        </div>
        
        <div class="tabs">
            <button class="tab active" data-tab="halls">Залы</button>
            <button class="tab" data-tab="price-sets">Прайс-сеты</button>
            <button class="tab" data-tab="hall-prices">Цены залов</button>
            <button class="tab" data-tab="extras">Доп. услуги</button>
            <button class="tab" data-tab="extras-prices">Цены доп. услуг</button>
            <button class="tab" data-tab="season-rules">Сезонные правила</button>
            <button class="tab" data-tab="services">Услуги</button>
            <button class="tab" data-tab="merchant">Мерчант</button>
            <button class="tab" data-tab="settings">Настройки</button>
        </div>
        
        <!-- Залы -->
        <div id="halls" class="tab-content active">
            <div class="content-card">
                <div class="content-header">
                    <h2>Управление залами</h2>
                    <button class="btn btn-primary" onclick="admin.openHallModal()">+ Добавить зал</button>
                </div>
                <div id="halls-loading" class="loading">Загрузка...</div>
                <table class="table" id="halls-table" style="display: none;">
                    <thead>
                        <tr>
                            <th>Название</th>
                            <th>Код</th>
                            <th>Вместимость</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="halls-table-body"></tbody>
                </table>
            </div>
        </div>
        
        <!-- Прайс-сеты -->
        <div id="price-sets" class="tab-content">
            <div class="content-card">
                <div class="content-header">
                    <h2>Прайс-сеты</h2>
                    <button class="btn btn-primary" onclick="admin.openPriceSetModal()">+ Добавить прайс-сет</button>
                </div>
                <div id="price-sets-loading" class="loading">Загрузка...</div>
                <table class="table" id="price-sets-table" style="display: none;">
                    <thead>
                        <tr>
                            <th>Код</th>
                            <th>Название</th>
                            <th>Описание</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="price-sets-table-body"></tbody>
                </table>
            </div>
        </div>
        
        <!-- Цены залов -->
        <div id="hall-prices" class="tab-content">
            <div class="content-card">
                <div class="content-header">
                    <h2>Цены залов</h2>
                    <button class="btn btn-primary" id="add-hall-price-btn" onclick="admin.openHallPriceModal(null)" style="display: none;">+ Добавить цены</button>
                </div>
                <div class="form-group">
                    <label>Выберите зал:</label>
                    <select id="hall-select" class="form-control" onchange="admin.loadHallPrices()">
                        <option value="">-- Выберите зал --</option>
                    </select>
                </div>
                <div id="hall-prices-loading" class="loading" style="display: none;">Загрузка...</div>
                <table class="table" id="hall-prices-table" style="display: none;">
                    <thead>
                        <tr>
                            <th>Прайс-сет</th>
                            <th>Будни 10:00-22:00</th>
                            <th>Будни 22:00-00:00</th>
                            <th>Пт/Сб</th>
                            <th>Вс</th>
                            <th>Уборка до 30</th>
                            <th>Уборка > 30</th>
                            <th>Внеурочные</th>
                            <th>Мин. часов</th>
                            <th>Мин. часов (сб)</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="hall-prices-table-body"></tbody>
                </table>
            </div>
        </div>
        
        <!-- Дополнительные услуги -->
        <div id="extras" class="tab-content">
            <div class="content-card">
                <div class="content-header">
                    <h2>Дополнительные услуги</h2>
                    <button class="btn btn-primary" onclick="admin.openExtraModal()">+ Добавить услугу</button>
                </div>
                <div id="extras-loading" class="loading">Загрузка...</div>
                <table class="table" id="extras-table" style="display: none;">
                    <thead>
                        <tr>
                            <th>Название</th>
                            <th>Код</th>
                            <th>Тип</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="extras-table-body"></tbody>
                </table>
            </div>
        </div>
        
        <!-- Цены дополнительных услуг -->
        <div id="extras-prices" class="tab-content">
            <div class="content-card">
                <h2>Цены дополнительных услуг</h2>
                <div class="form-group">
                    <label>Выберите услугу:</label>
                    <select id="extra-select" class="form-control" onchange="admin.loadExtraPrices()">
                        <option value="">-- Выберите услугу --</option>
                    </select>
                </div>
                <button class="btn btn-primary" id="add-extra-price-btn" onclick="admin.openExtraPriceModal(null)" style="display: none; margin-bottom: 20px;">+ Добавить цену</button>
                <div id="extras-prices-loading" class="loading" style="display: none;">Загрузка...</div>
                <table class="table" id="extras-prices-table" style="display: none;">
                    <thead>
                        <tr>
                            <th>Прайс-сет</th>
                            <th>Базовая цена</th>
                            <th>Цена доп. единицы</th>
                            <th>Единица</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="extras-prices-table-body"></tbody>
                </table>
            </div>
        </div>
        
        <!-- Сезонные правила -->
        <div id="season-rules" class="tab-content">
            <div class="content-card">
                <div class="content-header">
                    <h2>Сезонные правила</h2>
                    <button class="btn btn-primary" onclick="admin.openSeasonRuleModal()">+ Добавить правило</button>
                </div>
                <div id="season-rules-loading" class="loading">Загрузка...</div>
                <table class="table" id="season-rules-table" style="display: none;">
                    <thead>
                        <tr>
                            <th>Описание</th>
                            <th>Прайс-сет</th>
                            <th>Дата начала</th>
                            <th>Дата окончания</th>
                            <th>Дни недели</th>
                            <th>Приоритет</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="season-rules-table-body"></tbody>
                </table>
            </div>
        </div>
        
        <!-- Услуги -->
        <div id="services" class="tab-content">
            <div class="content-card">
                <div class="content-header">
                    <h2>Управление услугами</h2>
                    <button class="btn btn-primary" onclick="admin.openServiceModal()">+ Создать услугу</button>
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                    <input type="text" id="services-search" class="form-control" placeholder="Поиск по названию или slug..." onkeyup="admin.filterServices()">
                    <label style="margin-top: 10px;">
                        <input type="checkbox" id="services-filter-active" onchange="admin.filterServices()">
                        Только активные
                    </label>
                </div>
                <div id="services-loading" class="loading">Загрузка...</div>
                <table class="table" id="services-table" style="display: none;">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Название</th>
                            <th>Slug</th>
                            <th>Статус</th>
                            <th>В меню</th>
                            <th>Порядок</th>
                            <th>Создано</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="services-table-body"></tbody>
                </table>
            </div>
        </div>
        
        <!-- Мерчант -->
        <div id="merchant" class="tab-content">
            <div class="content-card">
                <div class="content-header">
                    <h2>Настройки мерчанта</h2>
                    <button class="btn btn-primary" onclick="admin.openMerchantModal()">+ Добавить мерчант</button>
                </div>
                <div id="merchant-loading" class="loading">Загрузка...</div>
                <div id="merchant-content" style="display: none;">
                    <table class="table" id="merchant-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Название мерчанта</th>
                                <th>Merchant ID</th>
                                <th>Terminal ID</th>
                                <th>SBP Merchant ID</th>
                                <th>Обновлено</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody id="merchant-table-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <!-- Настройки -->
        <div id="settings" class="tab-content">
            <div class="content-card">
                <div class="content-header">
                    <h2>Настройки приложения</h2>
                </div>
                <div id="settings-loading" class="loading">Загрузка...</div>
                <div id="settings-content" style="display: none;">
                    <form id="settings-form">
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="use-payment-module" name="use_payment_module" style="width: auto; height: auto;">
                                <span>Использовать платежный модуль при бронировании зала</span>
                            </label>
                            <small style="display: block; margin-top: 5px; color: #666;">
                                Если включено: при бронировании будет кнопка "Перейти к оплате".<br>
                                Если выключено: при бронировании будет кнопка "Отправить" (заявка отправляется без оплаты).
                            </small>
                        </div>
                        <div class="form-group">
                            <label for="payment-percent">Процент предоплаты (%):</label>
                            <input type="number" id="payment-percent" name="payment_percent" class="form-control" min="0" max="100" step="0.1" value="50">
                            <small style="display: block; margin-top: 5px; color: #666;">
                                Процент от полной суммы, который взимается при бронировании (например, 50 для 50%).
                            </small>
                        </div>
                        <div class="form-group">
                            <label for="payment-terms-text">Текст условий оплаты и возврата:</label>
                            <textarea id="payment-terms-text" name="payment_terms_text" class="form-control" rows="8" style="resize: vertical;"></textarea>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Сохранить настройки</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Модальное окно -->
    <div id="modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modal-title">Редактирование</h2>
                <button class="close-btn" onclick="admin.closeModal()">&times;</button>
            </div>
            <div id="modal-body"></div>
        </div>
    </div>
    
    <script src="/admin/admin.js"></script>
</body>
</html>

