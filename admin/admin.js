/**
 * Admin panel JavaScript с авторизацией
 */

const API_BASE = '/api';

// Глобальный объект админки
const admin = {
    currentTab: 'halls',
    
    init() {
        // PHP handles authentication, so we just initialize
        console.log('Admin panel initializing...');
        this.setupTabs();
        this.loadTabData(this.currentTab);
    },
    
    logout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            window.location.href = '/admin/logout.php';
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
            case 'services':
                this.loadServices();
                break;
            case 'merchant':
                this.loadMerchant();
                break;
            case 'settings':
                this.loadSettings();
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
        const addBtn = document.getElementById('add-hall-price-btn');
        
        if (!hallId) {
            document.getElementById('hall-prices-table').style.display = 'none';
            addBtn.style.display = 'none';
            return;
        }
        
        addBtn.style.display = 'block';
        
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
    
    async openHallPriceModal(id) {
        const hallId = document.getElementById('hall-select').value;
        if (!hallId && !id) {
            this.showMessage('Сначала выберите зал', 'error');
            return;
        }
        
        if (id) {
            // Редактирование существующей цены
            fetch(`${API_BASE}/hall-prices/${id}`)
                .then(r => r.json())
                .then(price => {
                    this.openModal(`Редактировать цены: ${price.hall_name} (${price.price_set_name})`, 
                        this.getHallPriceFormHTML(price, id));
                    this.setupHallPriceForm(id);
                })
                .catch(err => {
                    this.showMessage('Ошибка загрузки данных', 'error');
                    console.error(err);
                });
        } else {
            // Создание новой цены
            try {
                const [hallsRes, priceSetsRes] = await Promise.all([
                    fetch(`${API_BASE}/halls`),
                    fetch(`${API_BASE}/price-sets`)
                ]);
                
                const halls = await hallsRes.json();
                const priceSets = await priceSetsRes.json();
                
                const hall = halls.find(h => h.id == hallId);
                if (!hall) {
                    this.showMessage('Зал не найден', 'error');
                    return;
                }
                
                // Получаем существующие прайс-сеты для этого зала
                const existingPricesRes = await fetch(`${API_BASE}/hall-prices?hall_id=${hallId}`);
                const existingPrices = await existingPricesRes.json();
                const existingPriceSetIds = existingPrices.map(p => p.price_set_id);
                
                // Фильтруем прайс-сеты, оставляя только те, для которых еще нет цен
                const availablePriceSets = priceSets.filter(ps => !existingPriceSetIds.includes(ps.id));
                
                if (availablePriceSets.length === 0) {
                    this.showMessage('Для этого зала уже созданы цены для всех прайс-сетов', 'error');
                    return;
                }
                
                this.openModal(`Добавить цены: ${hall.name}`, 
                    this.getHallPriceFormHTML({ hall_id: hallId, hall_name: hall.name }, null, availablePriceSets));
                this.setupHallPriceForm(null, hallId);
            } catch (error) {
                this.showMessage('Ошибка загрузки данных', 'error');
                console.error(error);
            }
        }
    },
    
    getHallPriceFormHTML(price, id = null, availablePriceSets = null) {
        const isNew = id === null;
        const priceSetSelect = isNew && availablePriceSets ? `
            <div class="form-group">
                <label>Прайс-сет:</label>
                <select name="price_set_id" required>
                    <option value="">-- Выберите прайс-сет --</option>
                    ${availablePriceSets.map(ps => `<option value="${ps.id}">${ps.name}</option>`).join('')}
                </select>
            </div>
        ` : '';
        
        return `
            <form id="hall-price-form">
                ${priceSetSelect}
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
                        value="${price.fri_sat_price || ''}" required>
                </div>
                <div class="form-group">
                    <label>Воскресенье (₽/час):</label>
                    <input type="number" step="0.01" name="sun_price" 
                        value="${price.sun_price || ''}" required>
                </div>
                <div class="form-group">
                    <label>Уборка до 30 гостей (₽):</label>
                    <input type="number" step="0.01" name="cleaning_up_to_30" 
                        value="${price.cleaning_up_to_30 || ''}" required>
                </div>
                <div class="form-group">
                    <label>Уборка свыше 30 гостей (₽):</label>
                    <input type="number" step="0.01" name="cleaning_over_30" 
                        value="${price.cleaning_over_30 || ''}" required>
                </div>
                <div class="form-group">
                    <label>Доплата за внеурочное время (₽/час):</label>
                    <input type="number" step="0.01" name="after_hours_fee" 
                        value="${price.after_hours_fee || ''}" required>
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
    
    setupHallPriceForm(id, hallId = null) {
        const form = document.getElementById('hall-price-form');
        // Удаляем старый обработчик, если есть
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(newForm);
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
            
            // Если создание новой цены, добавляем hall_id и price_set_id
            if (id === null) {
                const selectedHallId = hallId || document.getElementById('hall-select').value;
                const priceSetId = formData.get('price_set_id');
                
                if (!selectedHallId || !priceSetId) {
                    this.showMessage('Необходимо выбрать зал и прайс-сет', 'error');
                    return;
                }
                
                data.hall_id = parseInt(selectedHallId);
                data.price_set_id = parseInt(priceSetId);
            }
            
            try {
                const url = id ? `${API_BASE}/hall-prices/${id}` : `${API_BASE}/hall-prices`;
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
                
                this.showMessage(id ? 'Цены сохранены успешно' : 'Цены созданы успешно');
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
    },
    
    // ==================== SERVICES ====================
    
    async loadServices() {
        const loadingEl = document.getElementById('services-loading');
        const tableEl = document.getElementById('services-table');
        
        try {
            loadingEl.style.display = 'block';
            tableEl.style.display = 'none';
            
            const response = await fetch(`${API_BASE}/services`);
            if (!response.ok) throw new Error('Ошибка загрузки');
            
            const services = await response.json();
            this.allServices = services; // Сохраняем для фильтрации
            
            this.renderServicesTable(services);
            
            loadingEl.style.display = 'none';
            tableEl.style.display = 'table';
        } catch (error) {
            console.error('Error loading services:', error);
            loadingEl.innerHTML = `<span style="color: red;">Ошибка загрузки: ${error.message}</span>`;
        }
    },
    
    renderServicesTable(services) {
        const tbody = document.getElementById('services-table-body');
        tbody.innerHTML = services.map(service => `
            <tr>
                <td>${service.id}</td>
                <td>${service.hero_title || '-'}</td>
                <td><code>${service.slug}</code></td>
                <td><span class="status-badge ${service.is_active ? 'status-active' : 'status-inactive'}">
                    ${service.is_active ? 'Активна' : 'Неактивна'}
                </span></td>
                <td><span class="status-badge ${service.show_in_menu ? 'status-active' : 'status-inactive'}">
                    ${service.show_in_menu ? 'Да' : 'Нет'}
                </span></td>
                <td>${service.menu_sort || 500}</td>
                <td>${new Date(service.created_at).toLocaleDateString('ru-RU')}</td>
                <td>
                    <button class="btn btn-secondary" onclick="admin.openServiceModal(${service.id})">Редактировать</button>
                    <button class="btn btn-danger" onclick="admin.deleteService(${service.id})">Удалить</button>
                    ${service.is_active ? `<a href="/services/${service.slug}" target="_blank" class="btn btn-primary" style="margin-left: 5px;">Перейти</a>` : ''}
                </td>
            </tr>
        `).join('');
    },
    
    filterServices() {
        if (!this.allServices) return;
        
        const search = document.getElementById('services-search').value.toLowerCase();
        const onlyActive = document.getElementById('services-filter-active').checked;
        
        let filtered = this.allServices.filter(service => {
            const matchesSearch = !search || 
                (service.hero_title && service.hero_title.toLowerCase().includes(search)) ||
                (service.slug && service.slug.toLowerCase().includes(search));
            const matchesActive = !onlyActive || service.is_active;
            return matchesSearch && matchesActive;
        });
        
        this.renderServicesTable(filtered);
    },
    
    openServiceModal(id = null) {
        if (id) {
            fetch(`${API_BASE}/services/admin/${id}`)
                .then(r => r.json())
                .then(service => {
                    this.openModal('Редактировать услугу', this.getServiceFormHTML(service));
                    this.setupServiceForm(id);
                })
                .catch(err => {
                    this.showMessage('Ошибка загрузки данных', 'error');
                    console.error(err);
                });
        } else {
            this.openModal('Создать услугу', this.getServiceFormHTML(null));
            this.setupServiceForm(null);
        }
    },
    
    getServiceFormHTML(service) {
        const advantages = service?.advantages || [];
        const photos = service?.photos || [];
        
        return `
            <div style="max-height: 80vh; overflow-y: auto;">
                <form id="service-form" enctype="multipart/form-data">
                    <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 10px;">
                        <button type="button" class="tab-btn active" data-tab="general" onclick="admin.switchServiceTab('general')">Общее</button>
                        <button type="button" class="tab-btn" data-tab="seo" onclick="admin.switchServiceTab('seo')">SEO</button>
                        <button type="button" class="tab-btn" data-tab="hero" onclick="admin.switchServiceTab('hero')">Hero</button>
                        <button type="button" class="tab-btn" data-tab="content" onclick="admin.switchServiceTab('content')">Контент</button>
                    </div>
                    
                    <!-- Общее -->
                    <div id="service-tab-general" class="service-tab-content active">
                        <div class="form-group">
                            <label>Название (hero_title): *</label>
                            <input type="text" name="hero_title" value="${service?.hero_title || ''}" required 
                                oninput="admin.generateSlug(this.value, 'service-slug')">
                        </div>
                        <div class="form-group">
                            <label>Slug (URL): *</label>
                            <input type="text" name="slug" id="service-slug" value="${service?.slug || ''}" required>
                            <small>Латинские буквы, дефисы. Будет использоваться в URL: /services/{slug}</small>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" name="is_active" ${(service?.is_active === true || service?.is_active === 1) ? 'checked' : ''}>
                                Активна (страница доступна по URL)
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" name="show_in_menu" ${(service?.show_in_menu === true || service?.show_in_menu === 1) ? 'checked' : ''}>
                                Показывать в меню
                            </label>
                        </div>
                        <div class="form-group">
                            <label>Порядок в меню:</label>
                            <input type="number" name="menu_sort" value="${service?.menu_sort || 500}">
                        </div>
                    </div>
                    
                    <!-- SEO -->
                    <div id="service-tab-seo" class="service-tab-content">
                        <div class="form-group">
                            <label>Meta Title:</label>
                            <input type="text" name="meta_title" value="${service?.meta_title || ''}" 
                                placeholder="Заголовок страницы (title)">
                        </div>
                        <div class="form-group">
                            <label>Meta Description:</label>
                            <textarea name="meta_description" rows="3" 
                                placeholder="Описание для поисковых систем">${service?.meta_description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Meta Keywords:</label>
                            <input type="text" name="meta_keywords" value="${service?.meta_keywords || ''}" 
                                placeholder="Ключевые слова через запятую">
                        </div>
                    </div>
                    
                    <!-- Hero -->
                    <div id="service-tab-hero" class="service-tab-content">
                        <div class="form-group">
                            <label>Фоновое изображение Hero:</label>
                            <input type="file" name="hero_background_image" accept="image/*">
                            ${service?.hero_background_image ? `
                                <div style="margin-top: 10px;">
                                    <img src="${service.hero_background_image}" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px;">
                                    <div><small>Текущее изображение</small></div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="form-group">
                            <label>Заголовок Hero:</label>
                            <input type="text" name="hero_title" value="${service?.hero_title || ''}">
                        </div>
                        <div class="form-group">
                            <label>Подзаголовок Hero:</label>
                            <textarea name="hero_subtitle" rows="2">${service?.hero_subtitle || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Текст кнопки Hero:</label>
                            <input type="text" name="hero_button_text" value="${service?.hero_button_text || ''}">
                        </div>
                        <div class="form-group">
                            <label>Ссылка кнопки Hero:</label>
                            <input type="text" name="hero_button_link" value="${service?.hero_button_link || ''}" 
                                placeholder="URL или якорь (#section)">
                        </div>
                    </div>
                    
                    <!-- Контент -->
                    <div id="service-tab-content" class="service-tab-content">
                        <div class="form-group">
                            <label>Заголовок вступления:</label>
                            <input type="text" name="intro_title" value="${service?.intro_title || ''}">
                        </div>
                        <div class="form-group">
                            <label>Текст вступления (HTML):</label>
                            <textarea name="intro_text" rows="5">${service?.intro_text || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Изображение вступления:</label>
                            <input type="file" name="intro_image" accept="image/*">
                            ${service?.intro_image ? `
                                <div style="margin-top: 10px;">
                                    <img src="${service.intro_image}" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px;">
                                </div>
                            ` : ''}
                        </div>
                        
                        <h3 style="margin-top: 30px;">Преимущества</h3>
                        <div id="advantages-list">
                            ${advantages.map((adv, index) => `
                                <div class="advantage-item" style="border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 4px;">
                                    <div class="form-group">
                                        <label>Заголовок:</label>
                                        <input type="text" name="advantage_title_${index}" value="${adv.title || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label>Текст:</label>
                                        <textarea name="advantage_text_${index}" rows="2">${adv.text || ''}</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>Иконка (эмодзи или текст):</label>
                                        <input type="text" name="advantage_icon_${index}" value="${adv.icon || ''}">
                                    </div>
                                    <button type="button" class="btn btn-danger" onclick="admin.removeAdvantageItem(this)">Удалить</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-secondary" onclick="admin.addAdvantageItem()">+ Добавить преимущество</button>
                        
                        <h3 style="margin-top: 30px;">Фотографии</h3>
                        <div id="photos-list">
                            ${photos.map((photo, index) => `
                                <div class="photo-item" style="border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 4px;">
                                    <div class="form-group">
                                        <label>URL изображения:</label>
                                        <input type="text" name="photo_image_${index}" value="${photo.image || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label>Подпись:</label>
                                        <input type="text" name="photo_caption_${index}" value="${photo.caption || ''}">
                                    </div>
                                    <button type="button" class="btn btn-danger" onclick="admin.removePhotoItem(this)">Удалить</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-secondary" onclick="admin.addPhotoItem()">+ Добавить фото</button>
                        
                        <h3 style="margin-top: 30px;">Нижний CTA</h3>
                        <div class="form-group">
                            <label>Заголовок CTA:</label>
                            <input type="text" name="bottom_cta_title" value="${service?.bottom_cta_title || ''}">
                        </div>
                        <div class="form-group">
                            <label>Текст CTA:</label>
                            <textarea name="bottom_cta_text" rows="2">${service?.bottom_cta_text || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Текст кнопки CTA:</label>
                            <input type="text" name="bottom_cta_button_text" value="${service?.bottom_cta_button_text || ''}">
                        </div>
                        <div class="form-group">
                            <label>Ссылка кнопки CTA:</label>
                            <input type="text" name="bottom_cta_button_link" value="${service?.bottom_cta_button_link || ''}">
                        </div>
                    </div>
                    
                    <div class="form-actions" style="margin-top: 20px; border-top: 2px solid #ddd; padding-top: 15px;">
                        <button type="button" class="btn" onclick="admin.closeModal()">Отмена</button>
                        <button type="submit" class="btn btn-primary">Сохранить</button>
                    </div>
                </form>
            </div>
            <style>
                .tab-btn { padding: 8px 15px; border: 1px solid #ddd; background: #f5f5f5; cursor: pointer; }
                .tab-btn.active { background: #007bff; color: white; }
                .service-tab-content { display: none; }
                .service-tab-content.active { display: block; }
            </style>
        `;
    },
    
    switchServiceTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.service-tab-content').forEach(content => content.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`service-tab-${tabName}`).classList.add('active');
    },
    
    generateSlug(text, targetId) {
        const slug = text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        document.getElementById(targetId).value = slug;
    },
    
    addAdvantageItem() {
        const list = document.getElementById('advantages-list');
        const index = list.children.length;
        const item = document.createElement('div');
        item.className = 'advantage-item';
        item.style.cssText = 'border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 4px;';
        item.innerHTML = `
            <div class="form-group">
                <label>Заголовок:</label>
                <input type="text" name="advantage_title_${index}">
            </div>
            <div class="form-group">
                <label>Текст:</label>
                <textarea name="advantage_text_${index}" rows="2"></textarea>
            </div>
            <div class="form-group">
                <label>Иконка (эмодзи или текст):</label>
                <input type="text" name="advantage_icon_${index}">
            </div>
            <button type="button" class="btn btn-danger" onclick="admin.removeAdvantageItem(this)">Удалить</button>
        `;
        list.appendChild(item);
    },
    
    removeAdvantageItem(btn) {
        btn.closest('.advantage-item').remove();
    },
    
    addPhotoItem() {
        const list = document.getElementById('photos-list');
        const index = list.children.length;
        const item = document.createElement('div');
        item.className = 'photo-item';
        item.style.cssText = 'border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 4px;';
        item.innerHTML = `
            <div class="form-group">
                <label>URL изображения:</label>
                <input type="text" name="photo_image_${index}">
            </div>
            <div class="form-group">
                <label>Подпись:</label>
                <input type="text" name="photo_caption_${index}">
            </div>
            <button type="button" class="btn btn-danger" onclick="admin.removePhotoItem(this)">Удалить</button>
        `;
        list.appendChild(item);
    },
    
    removePhotoItem(btn) {
        btn.closest('.photo-item').remove();
    },
    
    setupServiceForm(id) {
        // Сохраняем id для использования в обработчике
        const serviceId = id;
        
        // Ждем, пока форма отрендерится в модальном окне
        setTimeout(() => {
            const form = document.getElementById('service-form');
            if (!form) {
                console.error('Form not found!');
                this.showMessage('Ошибка: форма не найдена', 'error');
                return;
            }
            
            // Удаляем старые обработчики
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            const cleanForm = document.getElementById('service-form');
            
            if (!cleanForm) {
                console.error('Clean form not found after clone!');
                return;
            }
            
            // Привязываем обработчик к форме
            cleanForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Form submit triggered');
            
            const formData = new FormData(cleanForm);
            
            // Собираем преимущества
            const advantages = [];
            document.querySelectorAll('.advantage-item').forEach((item, index) => {
                const title = item.querySelector(`[name="advantage_title_${index}"]`)?.value;
                if (title) {
                    advantages.push({
                        title: title,
                        text: item.querySelector(`[name="advantage_text_${index}"]`)?.value || null,
                        icon: item.querySelector(`[name="advantage_icon_${index}"]`)?.value || null,
                        sort_order: index
                    });
                }
            });
            
            // Собираем фотографии
            const photos = [];
            document.querySelectorAll('.photo-item').forEach((item, index) => {
                const image = item.querySelector(`[name="photo_image_${index}"]`)?.value;
                if (image) {
                    photos.push({
                        image: image,
                        caption: item.querySelector(`[name="photo_caption_${index}"]`)?.value || null,
                        sort_order: index
                    });
                }
            });
            
            const data = new FormData();
            data.append('slug', formData.get('slug'));
            data.append('hero_title', formData.get('hero_title'));
            
            // Правильная обработка чекбоксов
            const isActiveCheckbox = cleanForm.querySelector('[name="is_active"]');
            const showInMenuCheckbox = cleanForm.querySelector('[name="show_in_menu"]');
            const isActiveValue = isActiveCheckbox && isActiveCheckbox.checked ? '1' : '0';
            const showInMenuValue = showInMenuCheckbox && showInMenuCheckbox.checked ? '1' : '0';
            
            console.log('Sending service data:', {
                is_active_checked: isActiveCheckbox?.checked,
                show_in_menu_checked: showInMenuCheckbox?.checked,
                is_active_value: isActiveValue,
                show_in_menu_value: showInMenuValue
            });
            
            data.append('is_active', isActiveValue);
            data.append('show_in_menu', showInMenuValue);
            data.append('menu_sort', formData.get('menu_sort') || '500');
            data.append('meta_title', formData.get('meta_title') || '');
            data.append('meta_description', formData.get('meta_description') || '');
            data.append('meta_keywords', formData.get('meta_keywords') || '');
            data.append('hero_subtitle', formData.get('hero_subtitle') || '');
            data.append('hero_button_text', formData.get('hero_button_text') || '');
            data.append('hero_button_link', formData.get('hero_button_link') || '');
            data.append('intro_title', formData.get('intro_title') || '');
            data.append('intro_text', formData.get('intro_text') || '');
            data.append('bottom_cta_title', formData.get('bottom_cta_title') || '');
            data.append('bottom_cta_text', formData.get('bottom_cta_text') || '');
            data.append('bottom_cta_button_text', formData.get('bottom_cta_button_text') || '');
            data.append('bottom_cta_button_link', formData.get('bottom_cta_button_link') || '');
            data.append('advantages', JSON.stringify(advantages));
            data.append('photos', JSON.stringify(photos));
            
            if (formData.get('hero_background_image')?.size > 0) {
                data.append('hero_background_image', formData.get('hero_background_image'));
            }
            if (formData.get('intro_image')?.size > 0) {
                data.append('intro_image', formData.get('intro_image'));
            }
            
            try {
                // Показываем индикатор загрузки
                const submitBtn = cleanForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    const originalText = submitBtn.textContent;
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Сохранение...';
                }
                
                // Use POST for both create and update to avoid PHP multipart/form-data parsing issues with PUT
                // PHP doesn't populate $_POST for PUT requests with multipart/form-data
                const url = serviceId ? `${API_BASE}/services/${serviceId}` : `${API_BASE}/services`;
                const method = 'POST';
                
                // Add _method=PUT for updates so PHP knows it's an update
                if (serviceId) {
                    data.append('_method', 'PUT');
                }
                
                console.log('Sending request to:', url, 'Method:', method, 'ServiceId:', serviceId);
                
                // Debug: Log all FormData entries
                console.log('FormData contents:');
                for (let pair of data.entries()) {
                    console.log('  ' + pair[0] + ': ' + pair[1]);
                }
                
                const response = await fetch(url, {
                    method,
                    body: data
                    // Don't set Content-Type header - browser will set it automatically for FormData with boundary
                });
                
                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    let errorMessage = 'Ошибка сохранения';
                    try {
                        const error = await response.json();
                        errorMessage = error.error || errorMessage;
                    } catch (e) {
                        errorMessage = `Ошибка ${response.status}: ${response.statusText}`;
                    }
                    throw new Error(errorMessage);
                }
                
                const result = await response.json();
                console.log('Service saved successfully:', result);
                
                this.showMessage('Услуга сохранена успешно');
                this.closeModal();
                this.loadServices();
            } catch (error) {
                console.error('Error saving service:', error);
                this.showMessage(error.message || 'Ошибка сохранения услуги', 'error');
                
                // Восстанавливаем кнопку
                const submitBtn = cleanForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Сохранить';
                }
            }
            });
            
            // Также привязываем обработчик к кнопке напрямую (на случай проблем с формой)
            const submitButton = cleanForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    cleanForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                });
            }
        }, 100); // Небольшая задержка для рендеринга модального окна
    },
    
    async deleteService(id) {
        if (!confirm('Вы уверены, что хотите удалить эту услугу? Страница станет недоступна, ссылка исчезнет из меню.')) return;
        
        try {
            const response = await fetch(`${API_BASE}/services/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Ошибка удаления');
            
            this.showMessage('Услуга удалена успешно');
            this.loadServices();
        } catch (error) {
            this.showMessage('Ошибка удаления услуги', 'error');
        }
    },
    
    // ==================== MERCHANT ====================
    
    async loadMerchant() {
        const loadingEl = document.getElementById('merchant-loading');
        const contentEl = document.getElementById('merchant-content');
        
        try {
            loadingEl.style.display = 'block';
            contentEl.style.display = 'none';
            
            const response = await fetch(`${API_BASE}/merchant`);
            if (!response.ok) throw new Error('Ошибка загрузки');
            
            const merchants = await response.json();
            
            const tbody = document.getElementById('merchant-table-body');
            if (merchants.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Нет данных. <button class="btn btn-primary" onclick="admin.openMerchantModal()">Создать настройки</button></td></tr>';
            } else {
                tbody.innerHTML = merchants.map(merchant => `
                    <tr>
                        <td>${merchant.id}</td>
                        <td>${merchant.merchant_name}</td>
                        <td><code>${merchant.merchant_id}</code></td>
                        <td><code>${merchant.terminal_id}</code></td>
                        <td><code>${merchant.sbp_merchant_id}</code></td>
                        <td>${merchant.updated_at ? new Date(merchant.updated_at).toLocaleString('ru-RU') : '-'}</td>
                        <td>
                            <button class="btn btn-secondary" onclick="admin.openMerchantModal(${merchant.id})">Редактировать</button>
                            <button class="btn btn-danger" onclick="admin.deleteMerchant(${merchant.id})">Удалить</button>
                        </td>
                    </tr>
                `).join('');
            }
            
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
        } catch (error) {
            console.error('Error loading merchant:', error);
            loadingEl.innerHTML = `<span style="color: red;">Ошибка загрузки: ${error.message}</span>`;
        }
    },
    
    openMerchantModal(id = null) {
        if (id) {
            fetch(`${API_BASE}/merchant/${id}`)
                .then(r => r.json())
                .then(merchant => {
                    this.openModal('Редактировать настройки мерчанта', this.getMerchantFormHTML(merchant));
                    this.setupMerchantForm(id);
                })
                .catch(err => {
                    this.showMessage('Ошибка загрузки данных', 'error');
                    console.error(err);
                });
        } else {
            this.openModal('Добавить настройки мерчанта', this.getMerchantFormHTML(null));
            this.setupMerchantForm(null);
        }
    },
    
    getMerchantFormHTML(merchant) {
        return `
            <form id="merchant-form">
                <div class="form-group">
                    <label>Название мерчанта:</label>
                    <input type="text" name="merchant_name" value="${merchant?.merchant_name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Merchant ID:</label>
                    <input type="text" name="merchant_id" value="${merchant?.merchant_id || ''}" required>
                </div>
                <div class="form-group">
                    <label>Terminal ID:</label>
                    <input type="text" name="terminal_id" value="${merchant?.terminal_id || ''}" required>
                </div>
                <div class="form-group">
                    <label>SBP Merchant ID:</label>
                    <input type="text" name="sbp_merchant_id" value="${merchant?.sbp_merchant_id || ''}" required>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn" onclick="admin.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `;
    },
    
    setupMerchantForm(id) {
        const form = document.getElementById('merchant-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = {
                merchant_name: formData.get('merchant_name'),
                merchant_id: formData.get('merchant_id'),
                terminal_id: formData.get('terminal_id'),
                sbp_merchant_id: formData.get('sbp_merchant_id')
            };
            
            try {
                const url = id ? `${API_BASE}/merchant/${id}` : `${API_BASE}/merchant`;
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
                
                this.showMessage('Настройки мерчанта сохранены успешно');
                this.closeModal();
                this.loadMerchant();
            } catch (error) {
                this.showMessage(error.message, 'error');
            }
        });
    },
    
    async deleteMerchant(id) {
        if (!confirm('Вы уверены, что хотите удалить эти настройки мерчанта?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/merchant/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Ошибка удаления');
            
            this.showMessage('Настройки мерчанта удалены успешно');
            this.loadMerchant();
        } catch (error) {
            this.showMessage('Ошибка удаления настроек мерчанта', 'error');
        }
    },
    
    // ==================== SETTINGS ====================
    
    async loadSettings() {
        const loadingEl = document.getElementById('settings-loading');
        const contentEl = document.getElementById('settings-content');
        
        try {
            loadingEl.style.display = 'block';
            contentEl.style.display = 'none';
            
            const response = await fetch(`${API_BASE}/settings`);
            if (!response.ok) throw new Error('Ошибка загрузки');
            
            const settings = await response.json();
            
            // Заполняем форму
            const checkbox = document.getElementById('use-payment-module');
            if (checkbox) {
                checkbox.checked = settings.use_payment_module === true || settings.use_payment_module === 1;
            }
            
            // Настраиваем форму
            this.setupSettingsForm();
            
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
        } catch (error) {
            console.error('Error loading settings:', error);
            loadingEl.innerHTML = `<span style="color: red;">Ошибка загрузки: ${error.message}</span>`;
        }
    },
    
    setupSettingsForm() {
        const form = document.getElementById('settings-form');
        if (!form) return;
        
        // Удаляем старые обработчики
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        const cleanForm = document.getElementById('settings-form');
        
        cleanForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(cleanForm);
            const data = {
                use_payment_module: formData.get('use_payment_module') === 'on'
            };
            
            try {
                const response = await fetch(`${API_BASE}/settings`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Ошибка сохранения');
                }
                
                this.showMessage('Настройки сохранены успешно');
            } catch (error) {
                this.showMessage(error.message, 'error');
            }
        });
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
