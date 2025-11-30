/**
 * Admin panel JavaScript с авторизацией
 */

const API_BASE = '/api';

// Глобальный объект админки
const admin = {
    currentTab: 'halls',
    
    init() {
        // Проверка авторизации
        if (!this.checkAuth()) {
            return;
        }
        
        console.log('Admin panel initializing...');
        this.setupTabs();
        this.loadTabData(this.currentTab);
        this.setupLogout();
    },
    
    checkAuth() {
        const token = localStorage.getItem('admin_token');
        const user = localStorage.getItem('admin_user');
        
        if (!token || !user) {
            window.location.href = '/admin/login.html';
            return false;
        }
        
        return true;
    },
    
    setupLogout() {
        // Добавляем кнопку выхода в header
        const header = document.querySelector('.header');
        if (header && !header.querySelector('.logout-btn')) {
            const user = JSON.parse(localStorage.getItem('admin_user') || '{}');
            const logoutBtn = document.createElement('div');
            logoutBtn.style.cssText = 'text-align: right; margin-top: 10px;';
            logoutBtn.innerHTML = `
                <span style="margin-right: 15px; color: #666;">Пользователь: ${user.username || 'admin'}</span>
                <button class="btn btn-danger logout-btn" onclick="admin.logout()">Выйти</button>
            `;
            header.appendChild(logoutBtn);
        }
    },
    
    logout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            window.location.href = '/admin/login.html';
        }
    },
    
    // Переключение вкладок
    setupTabs() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(targetTab).classList.add('active');
                this.currentTab = targetTab;
                this.loadTabData(targetTab);
            });
        });
    },
    
    // Загрузка данных для активной вкладки
    loadTabData(tabName) {
        switch(tabName) {
            case 'halls':
                this.loadHalls();
                break;
            case 'price-sets':
                this.loadPriceSets();
                break;
            case 'hall-prices':
                this.loadHallsForSelect();
                break;
            case 'extras':
                this.loadExtras();
                break;
            case 'extras-prices':
                this.loadExtrasForSelect();
                break;
            case 'season-rules':
                this.loadSeasonRules();
                break;
        }
    },
    
    // Сообщения
    showMessage(text, type = 'success') {
        const messageDiv = document.getElementById('message');
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    },
    
    // Модальное окно
    openModal(title, bodyHTML) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHTML;
        document.getElementById('modal').classList.add('active');
    },
    
    closeModal() {
        document.getElementById('modal').classList.remove('active');
    },
    
    // ==================== HALLS ====================
    
    async loadHalls() {
        const loadingEl = document.getElementById('halls-loading');
        const tableEl = document.getElementById('halls-table');
        
        try {
            loadingEl.style.display = 'block';
            tableEl.style.display = 'none';
            
            const response = await fetch(`${API_BASE}/halls`);
            if (!response.ok) throw new Error('Ошибка загрузки');
            
            const halls = await response.json();
            
            const tbody = document.getElementById('halls-table-body');
            tbody.innerHTML = halls.map(hall => `
                <tr>
                    <td>${hall.name}</td>
                    <td><code>${hall.code}</code></td>
                    <td>${hall.capacity}</td>
                    <td><span class="status-badge ${hall.is_active ? 'status-active' : 'status-inactive'}">
                        ${hall.is_active ? 'Активен' : 'Неактивен'}
                    </span></td>
                    <td>
                        <button class="btn btn-secondary" onclick="admin.openHallModal(${hall.id})">Редактировать</button>
                        <button class="btn btn-danger" onclick="admin.deleteHall(${hall.id})">Удалить</button>
                    </td>
                </tr>
            `).join('');
            
            loadingEl.style.display = 'none';
            tableEl.style.display = 'table';
        } catch (error) {
            console.error('Error loading halls:', error);
            loadingEl.innerHTML = `<span style="color: red;">Ошибка загрузки: ${error.message}</span>`;
        }
    },
    
    openHallModal(id = null) {
        if (id) {
            fetch(`${API_BASE}/halls/${id}`)
                .then(r => r.json())
                .then(hall => {
                    this.openModal('Редактировать зал', this.getHallFormHTML(hall));
                    this.setupHallForm(id);
                })
                .catch(err => {
                    this.showMessage('Ошибка загрузки данных', 'error');
                    console.error(err);
                });
        } else {
            this.openModal('Добавить зал', this.getHallFormHTML(null));
            this.setupHallForm(null);
        }
    },
    
    getHallFormHTML(hall) {
        return `
            <form id="hall-form">
                <div class="form-group">
                    <label>Название:</label>
                    <input type="text" name="name" value="${hall?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Код:</label>
                    <input type="text" name="code" value="${hall?.code || ''}" required ${hall ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                    <label>Вместимость:</label>
                    <input type="number" name="capacity" value="${hall?.capacity || ''}" required>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="is_active" ${hall?.is_active ? 'checked' : ''}>
                        Активен
                    </label>
                </div>
                <div class="form-group">
                    <label>Порядок сортировки:</label>
                    <input type="number" name="sort_order" value="${hall?.sort_order || 0}">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn" onclick="admin.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `;
    },
    
    setupHallForm(id) {
        const form = document.getElementById('hall-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = {
                name: formData.get('name'),
                code: formData.get('code'),
                capacity: parseInt(formData.get('capacity')),
                is_active: formData.get('is_active') === 'on',
                sort_order: parseInt(formData.get('sort_order')) || 0
            };
            
            try {
                const url = id ? `${API_BASE}/halls/${id}` : `${API_BASE}/halls`;
                const method = id ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Ошибка сохранения');
                }
                
                this.showMessage('Зал сохранен успешно');
                this.closeModal();
                this.loadHalls();
            } catch (error) {
                this.showMessage(error.message, 'error');
            }
        });
    },
    
    async deleteHall(id) {
        if (!confirm('Вы уверены, что хотите удалить этот зал?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/halls/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Ошибка удаления');
            
            this.showMessage('Зал удален успешно');
            this.loadHalls();
        } catch (error) {
            this.showMessage('Ошибка удаления зала', 'error');
        }
    },
    
    // ==================== PRICE SETS ====================
    
    async loadPriceSets() {
        const loadingEl = document.getElementById('price-sets-loading');
        const tableEl = document.getElementById('price-sets-table');
        
        try {
            loadingEl.style.display = 'block';
            tableEl.style.display = 'none';
            
            const response = await fetch(`${API_BASE}/price-sets`);
            if (!response.ok) throw new Error('Ошибка загрузки');
            
            const priceSets = await response.json();
            
            const tbody = document.getElementById('price-sets-table-body');
            tbody.innerHTML = priceSets.map(ps => `
                <tr>
                    <td><code>${ps.code}</code></td>
                    <td>${ps.name}</td>
                    <td>${ps.description || ''}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="admin.openPriceSetModal(${ps.id})">Редактировать</button>
                        <button class="btn btn-danger" onclick="admin.deletePriceSet(${ps.id})">Удалить</button>
                    </td>
                </tr>
            `).join('');
            
            loadingEl.style.display = 'none';
            tableEl.style.display = 'table';
        } catch (error) {
            console.error('Error loading price sets:', error);
            loadingEl.innerHTML = `<span style="color: red;">Ошибка загрузки: ${error.message}</span>`;
        }
    },
    
    openPriceSetModal(id = null) {
        if (id) {
            fetch(`${API_BASE}/price-sets/${id}`)
                .then(r => r.json())
                .then(ps => {
                    this.openModal('Редактировать прайс-сет', this.getPriceSetFormHTML(ps));
                    this.setupPriceSetForm(id);
                });
        } else {
            this.openModal('Добавить прайс-сет', this.getPriceSetFormHTML(null));
            this.setupPriceSetForm(null);
        }
    },
    
    getPriceSetFormHTML(ps) {
        return `
            <form id="price-set-form">
                <div class="form-group">
                    <label>Код:</label>
                    <input type="text" name="code" value="${ps?.code || ''}" required ${ps ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                    <label>Название:</label>
                    <input type="text" name="name" value="${ps?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Описание:</label>
                    <textarea name="description">${ps?.description || ''}</textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn" onclick="admin.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `;
    },
    
    setupPriceSetForm(id) {
        const form = document.getElementById('price-set-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = {
                code: formData.get('code'),
                name: formData.get('name'),
                description: formData.get('description') || null
            };
            
            try {
                const url = id ? `${API_BASE}/price-sets/${id}` : `${API_BASE}/price-sets`;
                const method = id ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Ошибка сохранения');
                }
                
                this.showMessage('Прайс-сет сохранен успешно');
                this.closeModal();
                this.loadPriceSets();
            } catch (error) {
                this.showMessage(error.message, 'error');
            }
        });
    },
    
    async deletePriceSet(id) {
        if (!confirm('Вы уверены, что хотите удалить этот прайс-сет?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/price-sets/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Ошибка удаления');
            
            this.showMessage('Прайс-сет удален успешно');
            this.loadPriceSets();
        } catch (error) {
            this.showMessage('Ошибка удаления прайс-сета', 'error');
        }
    },
    
    // ==================== HALL PRICES ====================
    
    async loadHallsForSelect() {
        try {
            const response = await fetch(`${API_BASE}/halls`);
            const halls = await response.json();
            
            const select = document.getElementById('hall-select');
            select.innerHTML = '<option value="">-- Выберите зал --</option>' +
                halls.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
        } catch (error) {
            console.error('Error loading halls:', error);
        }
    },
    
    async loadHallPrices() {
        const hallId = document.getElementById('hall-select').value;
        if (!hallId) {
            document.getElementById('hall-prices-table').style.display = 'none';
            return;
        }
        
        const loadingEl = document.getElementById('hall-prices-loading');
        const tableEl = document.getElementById('hall-prices-table');
        
        try {
            loadingEl.style.display = 'block';
            tableEl.style.display = 'none';
            
            const response = await fetch(`${API_BASE}/hall-prices?hall_id=${hallId}`);
            if (!response.ok) throw new Error('Ошибка загрузки');
            
            const prices = await response.json();
            
            const tbody = document.getElementById('hall-prices-table-body');
            tbody.innerHTML = prices.map(price => `
                <tr>
                    <td>${price.price_set_name}</td>
                    <td>${price.weekday_10_22 || price.weekday_price || '-'} ₽</td>
                    <td>${price.weekday_22_00 || '-'} ₽</td>
                    <td>${price.fri_sat_price} ₽</td>
                    <td>${price.sun_price} ₽</td>
                    <td>${price.cleaning_up_to_30} ₽</td>
                    <td>${price.cleaning_over_30} ₽</td>
                    <td>${price.after_hours_fee} ₽</td>
                    <td>${price.min_hours}</td>
                    <td>${price.min_hours_saturday || price.min_hours || '-'}</td>
                    <td>${price.allow_food_alcohol_from_hours}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="admin.openHallPriceModal(${price.id})">Редактировать</button>
                    </td>
                </tr>
            `).join('');
            
            loadingEl.style.display = 'none';
            tableEl.style.display = 'table';
        } catch (error) {
            console.error('Error loading hall prices:', error);
            loadingEl.innerHTML = `<span style="color: red;">Ошибка загрузки: ${error.message}</span>`;
        }
    },
    
    openHallPriceModal(id) {
        fetch(`${API_BASE}/hall-prices/${id}`)
            .then(r => r.json())
            .then(price => {
                this.openModal(`Редактировать цены: ${price.hall_name} (${price.price_set_name})`, 
                    this.getHallPriceFormHTML(price));
                this.setupHallPriceForm(id);
            })
            .catch(err => {
                this.showMessage('Ошибка загрузки данных', 'error');
                console.error(err);
            });
    },
    
    getHallPriceFormHTML(price) {
        return `
            <form id="hall-price-form">
                <div class="form-group">
                    <label>Будни с 10:00 до 22:00 (₽/час):</label>
                    <input type="number" step="0.01" name="weekday_10_22" 
                        value="${price.weekday_10_22 || price.weekday_price || ''}" required>
                </div>
                <div class="form-group">
                    <label>Будни с 22:00 до 00:00 (₽/час):</label>
                    <input type="number" step="0.01" name="weekday_22_00" 
                        value="${price.weekday_22_00 || price.weekday_price || ''}" required>
                </div>
                <div class="form-group">
                    <label>Пятница 17:00+ и суббота (₽/час):</label>
                    <input type="number" step="0.01" name="fri_sat_price" 
                        value="${price.fri_sat_price}" required>
                </div>
                <div class="form-group">
                    <label>Воскресенье (₽/час):</label>
                    <input type="number" step="0.01" name="sun_price" 
                        value="${price.sun_price}" required>
                </div>
                <div class="form-group">
                    <label>Уборка до 30 гостей (₽):</label>
                    <input type="number" step="0.01" name="cleaning_up_to_30" 
                        value="${price.cleaning_up_to_30}" required>
                </div>
                <div class="form-group">
                    <label>Уборка свыше 30 гостей (₽):</label>
                    <input type="number" step="0.01" name="cleaning_over_30" 
                        value="${price.cleaning_over_30}" required>
                </div>
                <div class="form-group">
                    <label>Доплата за внеурочное время (₽/час):</label>
                    <input type="number" step="0.01" name="after_hours_fee" 
                        value="${price.after_hours_fee}" required>
                </div>
                <div class="form-group">
                    <label>Минимальное количество часов:</label>
                    <input type="number" name="min_hours" value="${price.min_hours || 2}" required>
                </div>
                <div class="form-group">
                    <label>Минимальное количество часов суббота:</label>
                    <input type="number" name="min_hours_saturday" 
                        value="${price.min_hours_saturday || price.min_hours || 2}" required>
                </div>
                <div class="form-group">
                    <label>Еда/алкоголь разрешены с (часы аренды, минимум):</label>
                    <input type="number" name="allow_food_alcohol_from_hours" 
                        value="${price.allow_food_alcohol_from_hours || 2}" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn" onclick="admin.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `;
    },
    
    setupHallPriceForm(id) {
        const form = document.getElementById('hall-price-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = {
                weekday_10_22: parseFloat(formData.get('weekday_10_22')),
                weekday_22_00: parseFloat(formData.get('weekday_22_00')),
                fri_sat_price: parseFloat(formData.get('fri_sat_price')),
                sun_price: parseFloat(formData.get('sun_price')),
                cleaning_up_to_30: parseFloat(formData.get('cleaning_up_to_30')),
                cleaning_over_30: parseFloat(formData.get('cleaning_over_30')),
                after_hours_fee: parseFloat(formData.get('after_hours_fee')),
                min_hours: parseInt(formData.get('min_hours')),
                min_hours_saturday: parseInt(formData.get('min_hours_saturday')),
                allow_food_alcohol_from_hours: parseInt(formData.get('allow_food_alcohol_from_hours'))
            };
            
            try {
                const response = await fetch(`${API_BASE}/hall-prices/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Ошибка сохранения');
                }
                
                this.showMessage('Цены сохранены успешно');
                this.closeModal();
                this.loadHallPrices();
            } catch (error) {
                this.showMessage(error.message, 'error');
            }
        });
    },
    
    // ==================== EXTRAS ====================
    
    async loadExtras() {
        const loadingEl = document.getElementById('extras-loading');
        const tableEl = document.getElementById('extras-table');
        
        try {
            loadingEl.style.display = 'block';
            tableEl.style.display = 'none';
            
            const response = await fetch(`${API_BASE}/extras`);
            if (!response.ok) throw new Error('Ошибка загрузки');
            
            const extras = await response.json();
            
            const tbody = document.getElementById('extras-table-body');
            tbody.innerHTML = extras.map(extra => `
                <tr>
                    <td>${extra.name}</td>
                    <td><code>${extra.code}</code></td>
                    <td>${extra.pricing_type}</td>
                    <td><span class="status-badge ${extra.is_active ? 'status-active' : 'status-inactive'}">
                        ${extra.is_active ? 'Активна' : 'Неактивна'}
                    </span></td>
                    <td>
                        <button class="btn btn-secondary" onclick="admin.openExtraModal(${extra.id})">Редактировать</button>
                        <button class="btn btn-danger" onclick="admin.deleteExtra(${extra.id})">Удалить</button>
                    </td>
                </tr>
            `).join('');
            
            loadingEl.style.display = 'none';
            tableEl.style.display = 'table';
        } catch (error) {
            console.error('Error loading extras:', error);
            loadingEl.innerHTML = `<span style="color: red;">Ошибка загрузки: ${error.message}</span>`;
        }
    },
    
    openExtraModal(id = null) {
        if (id) {
            fetch(`${API_BASE}/extras/${id}`)
                .then(r => r.json())
                .then(extra => {
                    this.openModal('Редактировать услугу', this.getExtraFormHTML(extra));
                    this.setupExtraForm(id);
                });
        } else {
            this.openModal('Добавить услугу', this.getExtraFormHTML(null));
            this.setupExtraForm(null);
        }
    },
    
    getExtraFormHTML(extra) {
        return `
            <form id="extra-form">
                <div class="form-group">
                    <label>Название:</label>
                    <input type="text" name="name" value="${extra?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Код:</label>
                    <input type="text" name="code" value="${extra?.code || ''}" required ${extra ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                    <label>Тип расчёта:</label>
                    <select name="pricing_type" required>
                        <option value="fixed" ${extra?.pricing_type === 'fixed' ? 'selected' : ''}>Фиксированная</option>
                        <option value="per_unit" ${extra?.pricing_type === 'per_unit' ? 'selected' : ''}>За единицу</option>
                        <option value="complex" ${extra?.pricing_type === 'complex' ? 'selected' : ''}>Сложная схема</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Описание:</label>
                    <textarea name="description">${extra?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="is_active" ${extra?.is_active ? 'checked' : ''}>
                        Активна
                    </label>
                </div>
                <div class="form-group">
                    <label>Порядок сортировки:</label>
                    <input type="number" name="sort_order" value="${extra?.sort_order || 0}">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn" onclick="admin.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `;
    },
    
    setupExtraForm(id) {
        const form = document.getElementById('extra-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = {
                name: formData.get('name'),
                code: formData.get('code'),
                pricing_type: formData.get('pricing_type'),
                description: formData.get('description') || null,
                is_active: formData.get('is_active') === 'on',
                sort_order: parseInt(formData.get('sort_order')) || 0
            };
            
            try {
                const url = id ? `${API_BASE}/extras/${id}` : `${API_BASE}/extras`;
                const method = id ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Ошибка сохранения');
                }
                
                this.showMessage('Услуга сохранена успешно');
                this.closeModal();
                this.loadExtras();
            } catch (error) {
                this.showMessage(error.message, 'error');
            }
        });
    },
    
    async deleteExtra(id) {
        if (!confirm('Вы уверены, что хотите удалить эту услугу?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/extras/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Ошибка удаления');
            
            this.showMessage('Услуга удалена успешно');
            this.loadExtras();
        } catch (error) {
            this.showMessage('Ошибка удаления услуги', 'error');
        }
    },
    
    // ==================== EXTRAS PRICES ====================
    
    async loadExtrasForSelect() {
        try {
            const response = await fetch(`${API_BASE}/extras`);
            const extras = await response.json();
            
            const select = document.getElementById('extra-select');
            select.innerHTML = '<option value="">-- Выберите услугу --</option>' +
                extras.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        } catch (error) {
            console.error('Error loading extras:', error);
        }
    },
    
    async loadExtraPrices() {
        const extraId = document.getElementById('extra-select').value;
        if (!extraId) {
            document.getElementById('extras-prices-table').style.display = 'none';
            return;
        }
        
        const loadingEl = document.getElementById('extras-prices-loading');
        const tableEl = document.getElementById('extras-prices-table');
        
        try {
            loadingEl.style.display = 'block';
            tableEl.style.display = 'none';
            
            const response = await fetch(`${API_BASE}/extras-prices?extra_id=${extraId}`);
            if (!response.ok) throw new Error('Ошибка загрузки');
            
            const prices = await response.json();
            
            const tbody = document.getElementById('extras-prices-table-body');
            tbody.innerHTML = prices.map(price => `
                <tr>
                    <td>${price.price_set_name}</td>
                    <td>${price.base_price !== null ? price.base_price + ' ₽' : '-'}</td>
                    <td>${price.additional_unit_price !== null ? price.additional_unit_price + ' ₽' : '-'}</td>
                    <td>${price.unit_description || '-'}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="admin.openExtraPriceModal(${price.id})">Редактировать</button>
                    </td>
                </tr>
            `).join('');
            
            loadingEl.style.display = 'none';
            tableEl.style.display = 'table';
        } catch (error) {
            console.error('Error loading extra prices:', error);
            loadingEl.innerHTML = `<span style="color: red;">Ошибка загрузки: ${error.message}</span>`;
        }
    },
    
    openExtraPriceModal(id) {
        fetch(`${API_BASE}/extras-prices/${id}`)
            .then(r => r.json())
            .then(price => {
                this.openModal(`Редактировать цены: ${price.extra_name} (${price.price_set_name})`, 
                    this.getExtraPriceFormHTML(price));
                this.setupExtraPriceForm(id);
            });
    },
    
    getExtraPriceFormHTML(price) {
        return `
            <form id="extra-price-form">
                <div class="form-group">
                    <label>Базовая цена (₽):</label>
                    <input type="number" step="0.01" name="base_price" value="${price.base_price || ''}">
                </div>
                <div class="form-group">
                    <label>Цена доп. единицы (₽):</label>
                    <input type="number" step="0.01" name="additional_unit_price" value="${price.additional_unit_price || ''}">
                </div>
                <div class="form-group">
                    <label>Описание единицы:</label>
                    <input type="text" name="unit_description" value="${price.unit_description || ''}" 
                        placeholder="например: за каждые 10 человек">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn" onclick="admin.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `;
    },
    
    setupExtraPriceForm(id) {
        const form = document.getElementById('extra-price-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = {
                base_price: formData.get('base_price') ? parseFloat(formData.get('base_price')) : null,
                additional_unit_price: formData.get('additional_unit_price') ? parseFloat(formData.get('additional_unit_price')) : null,
                unit_description: formData.get('unit_description') || null
            };
            
            try {
                const response = await fetch(`${API_BASE}/extras-prices/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Ошибка сохранения');
                }
                
                this.showMessage('Цены сохранены успешно');
                this.closeModal();
                this.loadExtraPrices();
            } catch (error) {
                this.showMessage(error.message, 'error');
            }
        });
    },
    
    // ==================== SEASON RULES ====================
    
    async loadSeasonRules() {
        const loadingEl = document.getElementById('season-rules-loading');
        const tableEl = document.getElementById('season-rules-table');
        
        try {
            loadingEl.style.display = 'block';
            tableEl.style.display = 'none';
            
            const response = await fetch(`${API_BASE}/season-rules`);
            if (!response.ok) throw new Error('Ошибка загрузки');
            
            const rules = await response.json();
            
            const dayNames = { 0: 'Вс', 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб' };
            
            const tbody = document.getElementById('season-rules-table-body');
            tbody.innerHTML = rules.map(rule => {
                const days = rule.days_of_week_mask.split(',').map(d => dayNames[parseInt(d.trim())]).join(', ');
                return `
                    <tr>
                        <td>${rule.description || '-'}</td>
                        <td>${rule.price_set_name}</td>
                        <td>${rule.start_date}</td>
                        <td>${rule.end_date}</td>
                        <td>${days}</td>
                        <td>${rule.priority}</td>
                        <td>
                            <button class="btn btn-secondary" onclick="admin.openSeasonRuleModal(${rule.id})">Редактировать</button>
                            <button class="btn btn-danger" onclick="admin.deleteSeasonRule(${rule.id})">Удалить</button>
                        </td>
                    </tr>
                `;
            }).join('');
            
            loadingEl.style.display = 'none';
            tableEl.style.display = 'table';
        } catch (error) {
            console.error('Error loading season rules:', error);
            loadingEl.innerHTML = `<span style="color: red;">Ошибка загрузки: ${error.message}</span>`;
        }
    },
    
    async openSeasonRuleModal(id = null) {
        const [rulesRes, priceSetsRes] = await Promise.all([
            id ? fetch(`${API_BASE}/season-rules/${id}`).then(r => r.json()) : Promise.resolve(null),
            fetch(`${API_BASE}/price-sets`).then(r => r.json())
        ]);
        
        const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const selectedDays = id ? rulesRes.days_of_week_mask.split(',').map(d => parseInt(d.trim())) : [];
        
        this.openModal(id ? 'Редактировать правило' : 'Добавить правило', 
            this.getSeasonRuleFormHTML(rulesRes, priceSetsRes, dayNames, selectedDays));
        this.setupSeasonRuleForm(id);
    },
    
    getSeasonRuleFormHTML(rule, priceSets, dayNames, selectedDays) {
        return `
            <form id="season-rule-form">
                <div class="form-group">
                    <label>Прайс-сет:</label>
                    <select name="price_set_id" required>
                        <option value="">-- Выберите прайс-сет --</option>
                        ${priceSets.map(ps => `<option value="${ps.id}" ${rule && rule.price_set_id == ps.id ? 'selected' : ''}>${ps.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Дата начала:</label>
                    <input type="date" name="start_date" value="${rule?.start_date || ''}" required>
                </div>
                <div class="form-group">
                    <label>Дата окончания:</label>
                    <input type="date" name="end_date" value="${rule?.end_date || ''}" required>
                </div>
                <div class="form-group">
                    <label>Дни недели:</label>
                    <div class="days-checkboxes">
                        ${dayNames.map((name, idx) => `
                            <div class="day-checkbox">
                                <input type="checkbox" name="days" value="${idx}" ${selectedDays.includes(idx) ? 'checked' : ''} id="day-${idx}">
                                <label for="day-${idx}">${name}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label>Приоритет:</label>
                    <input type="number" name="priority" value="${rule?.priority || 1}" required>
                </div>
                <div class="form-group">
                    <label>Описание:</label>
                    <textarea name="description">${rule?.description || ''}</textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn" onclick="admin.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `;
    },
    
    setupSeasonRuleForm(id) {
        const form = document.getElementById('season-rule-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const days = Array.from(formData.getAll('days')).map(d => parseInt(d)).sort((a, b) => a - b);
            const daysOfWeekMask = days.join(',');
            
            if (days.length === 0) {
                this.showMessage('Выберите хотя бы один день недели', 'error');
                return;
            }
            
            const data = {
                price_set_id: parseInt(formData.get('price_set_id')),
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date'),
                days_of_week_mask: daysOfWeekMask,
                priority: parseInt(formData.get('priority')),
                description: formData.get('description') || null
            };
            
            try {
                const url = id ? `${API_BASE}/season-rules/${id}` : `${API_BASE}/season-rules`;
                const method = id ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Ошибка сохранения');
                }
                
                this.showMessage('Правило сохранено успешно');
                this.closeModal();
                this.loadSeasonRules();
            } catch (error) {
                this.showMessage(error.message, 'error');
            }
        });
    },
    
    async deleteSeasonRule(id) {
        if (!confirm('Вы уверены, что хотите удалить это правило?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/season-rules/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Ошибка удаления');
            
            this.showMessage('Правило удалено успешно');
            this.loadSeasonRules();
        } catch (error) {
            this.showMessage('Ошибка удаления правила', 'error');
        }
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    admin.init();
});

// Закрытие модального окна по клику вне его
document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
        admin.closeModal();
    }
});
