/**
 * Модальное окно бронирования с формой и оплатой
 */

class BookingModal {
    constructor() {
        this.modal = null;
        this.currentStep = 1;
        this.bookingData = {};
        this.pricingData = null;
        this.usePaymentModule = true; // По умолчанию включено
        this.paymentCompleted = false; // Флаг успешной оплаты
        this.paymentPercent = 50; // По умолчанию 50%
        this.paymentTermsText = ''; // Текст условий оплаты
        this.init();
    }

    async init() {
        this.createModal();
        this.attachEventListeners();
        await this.loadSettings();
    }
    
    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                const settings = await response.json();
                this.usePaymentModule = settings.use_payment_module !== false;
                this.paymentPercent = settings.payment_percent || 50;
                this.paymentTermsText = settings.payment_terms_text || '';
                this.updatePaymentButton();
            }
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
            // В случае ошибки оставляем оплату включенной по умолчанию
        }
    }
    
    updatePaymentButton() {
        const submitButton = this.modal?.querySelector('#bookingContactForm button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = this.usePaymentModule ? 'Перейти к оплате' : 'Отправить';
        }
    }

    createModal() {
        const overlay = document.createElement('div');
        overlay.className = 'booking-modal-overlay';
        overlay.innerHTML = `
            <div class="booking-modal">
                <button class="booking-modal-close" aria-label="Закрыть">&times;</button>
                
                <!-- Шаг 1: Форма с именем и телефоном -->
                <div class="booking-modal-step active" data-step="1">
                    <h2 class="booking-modal-title">Бронирование зала</h2>
                    <div class="booking-modal-summary" id="bookingSummary"></div>
                    <form id="bookingContactForm">
                        <div class="booking-modal-form-group">
                            <label for="booking-name">Ваше имя *</label>
                            <input type="text" id="booking-name" name="name" required placeholder="Введите ваше имя">
                        </div>
                        <div class="booking-modal-form-group">
                            <label for="booking-phone">Телефон *</label>
                            <input type="tel" id="booking-phone" name="phone" required placeholder="+7 (999) 123-45-67">
                        </div>
                        <div class="booking-modal-buttons">
                            <button type="button" class="booking-modal-button booking-modal-button-secondary" data-action="close">Отмена</button>
                            <button type="submit" class="booking-modal-button booking-modal-button-primary" id="booking-submit-btn">Перейти к оплате</button>
                        </div>
                    </form>
                </div>

                <!-- Шаг 2: Оплата -->
                <div class="booking-modal-step" data-step="2">
                    <h2 class="booking-modal-title">Оплата</h2>
                    <div class="booking-modal-payment-container" id="paymentContainer">
                    </div>
                    <div class="booking-modal-buttons">
                        <button type="button" class="booking-modal-button booking-modal-button-secondary" data-action="back">Назад</button>
                    </div>
                </div>

                <!-- Шаг 3: Успешная оплата/отправка заявки -->
                <div class="booking-modal-step" data-step="3">
                    <div class="booking-modal-success">
                        <div class="booking-modal-success-icon">✓</div>
                        <h3 class="booking-modal-success-title"></h3>
                        <p class="booking-modal-success-text"></p>
                        <div class="booking-modal-buttons" style="margin-top: 30px;">
                            <button type="button" class="booking-modal-button booking-modal-button-primary" data-action="close">Закрыть</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.modal = overlay;
    }

    attachEventListeners() {
        // Закрытие модального окна
        this.modal.querySelector('.booking-modal-close').addEventListener('click', () => this.close());
        this.modal.querySelectorAll('[data-action="close"]').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        // Кнопка "Назад"
        const backBtn = this.modal.querySelector('[data-action="back"]');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goToStep(1));
        }

        // Обработка формы контактов
        const contactForm = this.modal.querySelector('#bookingContactForm');
        contactForm.addEventListener('submit', (e) => this.handleContactSubmit(e));

        // Закрытие при клике на overlay
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Маска для телефона
        const phoneInput = this.modal.querySelector('#booking-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => this.formatPhone(e.target));
        }
    }

    formatPhone(input) {
        let value = input.value.replace(/\D/g, '');
        if (value.startsWith('8')) {
            value = '7' + value.substring(1);
        }
        if (value.startsWith('7')) {
            value = value.substring(0, 11);
            let formatted = '+7';
            if (value.length > 1) {
                formatted += ' (' + value.substring(1, 4);
            }
            if (value.length >= 4) {
                formatted += ') ' + value.substring(4, 7);
            }
            if (value.length >= 7) {
                formatted += '-' + value.substring(7, 9);
            }
            if (value.length >= 9) {
                formatted += '-' + value.substring(9, 11);
            }
            input.value = formatted;
        }
    }

    async open(bookingData, pricingData) {
        // Сбрасываем флаг успешной оплаты при открытии модального окна
        this.paymentCompleted = false;
        this.bookingData = { ...bookingData };
        this.pricingData = pricingData;
        this.currentStep = 1;
        await this.loadSettings(); // Перезагружаем настройки при открытии
        this.updateSummary();
        this.updatePaymentButton();
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.currentStep = 1;
        this.bookingData = {};
        this.pricingData = null;
        // Сброс формы
        const form = this.modal.querySelector('#bookingContactForm');
        if (form) form.reset();
    }

    goToStep(step) {
        this.currentStep = step;
        this.modal.querySelectorAll('.booking-modal-step').forEach(stepEl => {
            stepEl.classList.remove('active');
        });
        const targetStep = this.modal.querySelector(`[data-step="${step}"]`);
        if (targetStep) {
            targetStep.classList.add('active');
        }

        if (step === 2) {
            // Показываем текст условий сразу, до инициализации платежной системы
            this.showPaymentTerms();
            this.initPayment();
        }
        
        if (step === 3) {
            // Устанавливаем текст в зависимости от того, включена ли оплата
            this.updateSuccessMessage();
        }
    }
    
    updateSuccessMessage() {
        const titleEl = this.modal.querySelector('.booking-modal-success-title');
        const textEl = this.modal.querySelector('.booking-modal-success-text');
        
        if (!titleEl || !textEl) return;
        
        if (this.usePaymentModule && this.paymentCompleted) {
            // Если оплата включена и успешно завершена - это подтвержденное бронирование
            titleEl.textContent = 'Бронирование подтверждено!';
            textEl.textContent = 'Ваша заявка успешно отправлена. Мы свяжемся с вами в ближайшее время для подтверждения бронирования.';
        } else {
            // Если оплата отключена или не завершена - это только заявка, не бронирование
            titleEl.textContent = '✅ Мы приняли вашу заявку';
            textEl.textContent = '⚠️ Обратите внимание - это не окончательное бронирование. Для бронирования необходимо внести аванс, в ближайшее время мы свяжемся с вами для согласования формы оплаты.';
        }
    }
    
    showPaymentTerms() {
        const paymentContainer = this.modal.querySelector('#paymentContainer');
        if (!paymentContainer || !this.pricingData) return;
        
        // Используем процент из настроек
        const paymentAmount = this.pricingData.totalPrice * (this.paymentPercent / 100);
        
        paymentContainer.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p style="color: #FFFFF0; margin-bottom: 10px; font-family: 'Montserrat', sans-serif; font-size: 14px;">
                    Полная сумма: <span style="text-decoration: line-through; opacity: 0.7;">${this.pricingData.totalPrice.toLocaleString('ru-RU')} ₽</span>
                </p>
                <p style="color: #FFFFF0; margin-bottom: 20px; font-family: 'Montserrat', sans-serif;">
                    К оплате (${this.paymentPercent}%): <strong style="color: #CC7A6F; font-size: 24px;">${paymentAmount.toLocaleString('ru-RU')} ₽</strong>
                </p>
            </div>
        `;
        
    }
    
    getPaymentTermsText() {
        // Формируем текст условий с подстановкой переменных
        let termsText = this.paymentTermsText || '';
        
        // Если текст не задан, используем дефолтный
        if (!termsText || !termsText.trim()) {
            termsText = `Для бронирования мы берем аванс в размере {payment_percent}% от полной суммы. Данная сумма возвращается в случае отмены брони не позднее 7 дней, если бронь на выходные, и 3 дней, если бронь на будний день. Оплачивая, вы соглашаетесь с <a href="/dogovor.html" target="_blank" style="color: #CC7A6F; text-decoration: underline;">договором оферты</a>.`;
        }
        
        // Подстановка переменных
        termsText = termsText.replace(/{payment_percent}/g, this.paymentPercent);
        termsText = termsText.replace(/{refund_weekend_days}/g, '7');
        termsText = termsText.replace(/{refund_weekday_days}/g, '3');
        
        return termsText;
    }

    updateSummary() {
        const summaryEl = this.modal.querySelector('#bookingSummary');
        if (!summaryEl || !this.pricingData) return;

        const { hall, date, timeFrom, timeTo, guests, totalPrice } = this.pricingData;

        summaryEl.innerHTML = `
            <div class="booking-modal-summary-title">Детали бронирования</div>
            <div class="booking-modal-summary-item">
                <span>Зал:</span>
                <span>${hall}</span>
            </div>
            <div class="booking-modal-summary-item">
                <span>Дата:</span>
                <span>${this.formatDate(date)}</span>
            </div>
            <div class="booking-modal-summary-item">
                <span>Время:</span>
                <span>${timeFrom} - ${timeTo}</span>
            </div>
            ${guests ? `<div class="booking-modal-summary-item">
                <span>Гостей:</span>
                <span>${guests}</span>
            </div>` : ''}
            <div class="booking-modal-summary-total">
                <span>Итого:</span>
                <span>${totalPrice.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div class="booking-modal-summary-item" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 240, 0.2);">
                <span style="font-size: 14px; opacity: 0.8;">К оплате (${this.paymentPercent}%):</span>
                <span style="color: #CC7A6F; font-weight: 600; font-size: 18px;">${(totalPrice * (this.paymentPercent / 100)).toLocaleString('ru-RU')} ₽</span>
            </div>
            ${this.getPaymentTermsText() ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 240, 0.2);">
                <div style="color: #FFFFF0; font-family: 'Montserrat', sans-serif; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; opacity: 0.9;">
                    ${this.getPaymentTermsText()}
                </div>
            </div>
            ` : ''}
        `;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return date.toLocaleDateString('ru-RU', options);
    }

    async handleContactSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const name = form.querySelector('#booking-name').value.trim();
        const phone = form.querySelector('#booking-phone').value.trim();

        if (!name || !phone) {
            alert('Пожалуйста, заполните все поля');
            return;
        }

        this.bookingData.name = name;
        this.bookingData.phone = phone;

        // Всегда создаем заказ в БД
        await this.createOrderInDB();
        
        // Проверяем, включен ли платежный модуль
        if (this.usePaymentModule) {
            // Telegram отправится после успешной оплаты
            // Переходим к оплате
            this.goToStep(2);
        } else {
            // Платежный модуль выключен - отправляем заявку в Telegram сразу
            await this.sendBookingToTelegram();
            // Переходим к шагу успешной отправки
            await this.submitBookingWithoutPayment();
        }
    }
    
    async createOrderInDB() {
        // Создаем заказ в БД (без отправки в Telegram)
        // Используется когда платежный модуль включен
        if (this.bookingData.orderId) {
            return; // Заказ уже создан
        }

        try {
            const response = await fetch('/api/booking/create-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    booking: this.bookingData,
                    pricing: this.pricingData
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.bookingData.orderId = result.orderId;
            }
        } catch (error) {
            console.error('Ошибка создания заказа:', error);
        }
    }

    async sendBookingToTelegram() {
        // Сначала создаем заказ в БД (если еще не создан)
        let orderId = this.bookingData.orderId;
        
        if (!orderId) {
            await this.createOrderInDB();
            orderId = this.bookingData.orderId;
        }

        // Отправляем уведомление в Telegram (даже если orderId не получен, используем временный)
        const finalOrderId = orderId || 'TEMP_' + Date.now();
        
        try {
            // Если оплата отключена, используем 'no_payment' чтобы указать, что нужно создать бронирование
            // Если оплата включена, используем 'success' только после успешной оплаты
            const paymentStatus = this.usePaymentModule ? 'success' : 'no_payment';
            const response = await fetch('/api/booking/send-telegram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    booking: this.bookingData,
                    pricing: this.pricingData,
                    orderId: finalOrderId,
                    paymentStatus: paymentStatus,
                    paymentDisabled: !this.usePaymentModule // Флаг, что оплата отключена
                })
            });
            
            if (response.ok) {
                console.log('Заявка отправлена в Telegram');
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Ошибка отправки в Telegram:', errorData);
            }
        } catch (error) {
            console.error('Ошибка отправки в Telegram:', error);
            // Не блокируем процесс из-за ошибки Telegram
        }
    }
    
    async submitBookingWithoutPayment() {
        try {
            // Заявка уже создана и отправлена в Telegram в handleContactSubmit
            // Просто переходим к шагу успешной отправки
            this.goToStep(3);
        } catch (error) {
            console.error('Ошибка отправки заявки:', error);
            alert('Ошибка при отправке заявки. Пожалуйста, попробуйте еще раз.');
        }
    }

    async initPayment() {
        const paymentContainer = this.modal.querySelector('#paymentContainer');
        
        // Показываем текст условий сразу, если еще не показан
        if (!paymentContainer.querySelector('.booking-modal-payment-container > div')) {
            this.showPaymentTerms();
        }

        try {
            console.log('Initializing payment with Tbank Integration.js widget...');
            
            // Ждем загрузки PaymentIntegration
            if (typeof PaymentIntegration === 'undefined') {
                console.log('Waiting for PaymentIntegration to load...');
                await this.waitForPaymentSystem();
            }

            if (typeof PaymentIntegration === 'undefined') {
                throw new Error('PaymentIntegration не загружен. Проверьте подключение скрипта Т-Банка.');
            }

            // Получаем конфигурацию
            const config = window.tbankPaymentInit?.getConfig();
            if (!config || !config.terminalKey) {
                throw new Error('Конфигурация платежной системы не загружена');
            }

            // Получаем данные пользователя
            const customerName = this.bookingData.name || '';
            const customerPhone = this.bookingData.phone || '';
            const orderId = this.bookingData.orderId;
            // Используем процент из настроек
            const paymentAmount = this.pricingData.totalPrice * (this.paymentPercent / 100);
            const amount = Math.round(paymentAmount * 100); // в копейках

            if (!orderId) {
                throw new Error('OrderId не найден. Сначала создайте заказ.');
            }

            console.log('Payment data:', {
                orderId,
                amount,
                customerName,
                customerPhone
            });

            // Инициализируем виджет Tbank с paymentStartCallback
            const initConfig = {
                terminalKey: config.terminalKey,
                product: 'eacq',
                features: {
                    payment: {
                        container: paymentContainer,
                        paymentStartCallback: async (paymentType) => {
                            console.log('paymentStartCallback called with paymentType:', paymentType);
                            
                            // Вызываем бэкенд для создания платежа через Tbank API
                            const response = await fetch('/api/booking/init-tbank-payment', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    orderId: orderId,
                                    amount: amount,
                                    description: `Бронирование зала ${this.bookingData.hall || 'неизвестный'}`,
                                    name: customerName,
                                    phone: customerPhone,
                                    paymentType: paymentType
                                })
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Ошибка создания платежа');
                            }

                            const result = await response.json();
                            console.log('PaymentURL received from backend:', result);

                            if (!result.PaymentURL) {
                                throw new Error('Бэкенд не вернул PaymentURL');
                            }

                            return result.PaymentURL;
                        }
                    }
                }
            };

            console.log('Initializing Tbank widget with config:', {
                terminalKey: initConfig.terminalKey,
                product: initConfig.product,
                hasContainer: !!initConfig.features.payment.container,
                hasCallback: !!initConfig.features.payment.paymentStartCallback
            });

            // Согласно документации Tbank, используем PaymentIntegration.init() напрямую
            // PaymentIntegration - это глобальный объект, который доступен после загрузки скрипта
            if (typeof PaymentIntegration === 'undefined') {
                throw new Error('PaymentIntegration не загружен. Проверьте подключение скрипта integration.js');
            }

            console.log('PaymentIntegration object:', PaymentIntegration);
            console.log('PaymentIntegration keys:', Object.keys(PaymentIntegration || {}));
            console.log('PaymentIntegration.init type:', typeof PaymentIntegration.init);
            console.log('PaymentIntegration.Integration:', PaymentIntegration.Integration);

            // Проверяем разные варианты доступа к init
            let initFunction = null;
            
            // Вариант 1: PaymentIntegration.init напрямую
            if (typeof PaymentIntegration.init === 'function') {
                initFunction = PaymentIntegration.init;
                console.log('Using PaymentIntegration.init');
            }
            // Вариант 2: PaymentIntegration.Integration.init
            else if (PaymentIntegration.Integration && typeof PaymentIntegration.Integration.init === 'function') {
                initFunction = PaymentIntegration.Integration.init;
                console.log('Using PaymentIntegration.Integration.init');
            }
            // Вариант 3: PaymentIntegration.default.init (ES module)
            else if (PaymentIntegration.default && typeof PaymentIntegration.default.init === 'function') {
                initFunction = PaymentIntegration.default.init;
                console.log('Using PaymentIntegration.default.init');
            }
            // Вариант 4: PaymentIntegration.Integration может быть классом
            else if (PaymentIntegration.Integration && typeof PaymentIntegration.Integration === 'function') {
                // Это может быть класс, пробуем вызвать как статический метод
                if (typeof PaymentIntegration.Integration.init === 'function') {
                    initFunction = PaymentIntegration.Integration.init;
                    console.log('Using PaymentIntegration.Integration (class).init');
                } else {
                    // Или это конструктор, создаем экземпляр
                    try {
                        const IntegrationClass = PaymentIntegration.Integration;
                        const instance = new IntegrationClass();
                        if (typeof instance.init === 'function') {
                            initFunction = instance.init.bind(instance);
                            console.log('Using new PaymentIntegration.Integration().init');
                        }
                    } catch (e) {
                        console.error('Failed to create Integration instance:', e);
                    }
                }
            }

            if (!initFunction) {
                console.error('PaymentIntegration structure:', {
                    hasInit: typeof PaymentIntegration.init,
                    hasIntegration: !!PaymentIntegration.Integration,
                    IntegrationType: typeof PaymentIntegration.Integration,
                    hasDefault: !!PaymentIntegration.default,
                    allKeys: Object.keys(PaymentIntegration)
                });
                throw new Error('Не удалось найти метод init в PaymentIntegration. Проверьте версию скрипта integration.js');
            }

            // Инициализируем виджет
            const integrationInstance = await initFunction(initConfig);
            
            console.log('Tbank widget initialized successfully:', integrationInstance);
            
            // Сохраняем экземпляр для дальнейшего использования
            window.PaymentIntegrationInstance = integrationInstance;
            
            // Виджет автоматически покажет кнопки оплаты в контейнере
            // Не нужно ничего дополнительно делать

        } catch (error) {
            console.error('Ошибка инициализации оплаты:', error);
            paymentContainer.innerHTML = `
                <div class="booking-modal-loading">
                    <p>Ошибка инициализации оплаты. Пожалуйста, попробуйте позже.</p>
                    <p style="font-size: 12px; margin-top: 10px; color: #999;">${error.message}</p>
                    <p style="font-size: 12px; margin-top: 10px; color: #999;">Проверьте консоль браузера для деталей (F12)</p>
                    <button onclick="location.reload()" style="margin-top: 15px; padding: 10px 20px; background: #CC7A6F; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Обновить страницу
                    </button>
                </div>
            `;
        }
    }

    async waitForPaymentSystem() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 секунд

            const checkInterval = setInterval(() => {
                attempts++;
                console.log(`Waiting for payment system... attempt ${attempts}/${maxAttempts}`);
                
                if (typeof PaymentIntegration !== 'undefined') {
                    console.log('PaymentIntegration found');
                    if (window.tbankPaymentInit?.isReady()) {
                        console.log('Payment system is ready');
                        clearInterval(checkInterval);
                        resolve();
                    } else {
                        console.log('Payment system not ready yet');
                    }
                } else {
                    console.log('PaymentIntegration not found yet');
                }
                
                if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.error('Payment system timeout');
                    reject(new Error('Платежная система не загрузилась за отведенное время'));
                }
            }, 100);
        });
    }

    async createPayment() {
        // Если заказ уже создан (имеем orderId), используем его
        if (this.bookingData.orderId) {
            // Используем процент из настроек
            const paymentAmount = this.pricingData.totalPrice * (this.paymentPercent / 100);
            return {
                orderId: this.bookingData.orderId,
                amount: paymentAmount * 100,
                description: `Бронирование зала ${this.pricingData.hall}`
            };
        }
        
        // Отправляем данные на сервер для создания платежа
        const response = await fetch('/api/booking/create-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                booking: this.bookingData,
                pricing: this.pricingData
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка создания платежа');
        }

        const result = await response.json();
        // Сохраняем orderId для дальнейшего использования
        if (result.orderId) {
            this.bookingData.orderId = result.orderId;
        }
        
        return result;
    }

    renderPaymentIframe(paymentUrl) {
        const paymentContainer = this.modal.querySelector('#paymentContainer');
        paymentContainer.innerHTML = `
            <iframe 
                src="${paymentUrl}" 
                style="width: 100%; height: 500px; border: none; border-radius: 8px;"
                id="paymentIframe">
            </iframe>
        `;

        // Слушаем сообщения от iframe (успешная оплата)
        window.addEventListener('message', this.handlePaymentMessage.bind(this));
    }

    renderPaymentButton(paymentData) {
        const paymentContainer = this.modal.querySelector('#paymentContainer');
        
        // Если текст условий еще не показан, показываем его
        if (!paymentContainer.querySelector('.booking-modal-payment-container > div')) {
            this.showPaymentTerms();
        }
        
        // Обновляем только кнопку оплаты и убираем индикатор загрузки
        const loadingDiv = paymentContainer.querySelector('.booking-modal-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
        
        // Находим или создаем кнопку оплаты
        let paymentButton = paymentContainer.querySelector('#paymentButton');
        if (!paymentButton) {
            // Если кнопки нет, добавляем её перед errorDiv
            const errorDiv = paymentContainer.querySelector('#paymentError');
            paymentButton = document.createElement('button');
            paymentButton.id = 'paymentButton';
            paymentButton.className = 'booking-modal-button booking-modal-button-primary';
            paymentButton.style.cssText = 'width: 100%;';
            paymentButton.textContent = 'Оплатить';
            
            if (errorDiv) {
                errorDiv.parentNode.insertBefore(paymentButton, errorDiv);
            } else {
                const termsDiv = paymentContainer.querySelector('div[style*="background: rgba(255, 255, 240, 0.1)"]');
                if (termsDiv && termsDiv.parentNode) {
                    termsDiv.parentNode.appendChild(paymentButton);
                } else {
                    paymentContainer.appendChild(paymentButton);
                }
            }
        }
        
        const errorDiv = paymentContainer.querySelector('#paymentError') || (() => {
            const div = document.createElement('div');
            div.id = 'paymentError';
            div.style.cssText = 'margin-top: 15px; color: #ff6b6b; display: none; font-size: 14px;';
            paymentContainer.appendChild(div);
            return div;
        })();
        
        paymentButton.addEventListener('click', async () => {
            // Проверяем доступность PaymentIntegration
            if (typeof PaymentIntegration === 'undefined') {
                errorDiv.textContent = 'Платежная система не загружена. Пожалуйста, обновите страницу.';
                errorDiv.style.display = 'block';
                console.error('PaymentIntegration is undefined');
                return;
            }

            // Получаем инициализированный экземпляр (должен быть создан после init)
            let Integration = window.PaymentIntegrationInstance;
            
            console.log('window.PaymentIntegrationInstance:', Integration);
            
            // Если экземпляр не найден, пытаемся получить из модуля
            if (!Integration) {
                let IntegrationModule = window.PaymentIntegrationModule ||
                                       window.tbankPaymentInit?.getIntegration() ||
                                       (PaymentIntegration.Integration || PaymentIntegration.default || PaymentIntegration);
                
                console.log('IntegrationModule:', IntegrationModule);
                
                // Если это ES модуль, извлекаем класс Integration
                let IntegrationClass = IntegrationModule;
                if (IntegrationModule && IntegrationModule.__esModule && IntegrationModule.Integration) {
                    IntegrationClass = IntegrationModule.Integration;
                    console.log('Using IntegrationModule.Integration (ES module)');
                } else if (IntegrationModule && typeof IntegrationModule.Integration === 'function') {
                    IntegrationClass = IntegrationModule.Integration;
                    console.log('Using IntegrationModule.Integration');
                }
                
                // Если класс найден, но экземпляр нет - возможно init() возвращает экземпляр
                // Или нужно использовать методы класса напрямую
                if (IntegrationClass) {
                    // Проверяем, может быть это уже экземпляр (после init)
                    if (IntegrationClass.features || typeof IntegrationClass.payment === 'function') {
                        Integration = IntegrationClass;
                        console.log('Using IntegrationClass as instance');
                    } else {
                        // Это класс, используем его напрямую (методы могут быть статическими)
                        Integration = IntegrationClass;
                        console.log('Using IntegrationClass directly (may have static methods)');
                    }
                }
            }
            
            console.log('Final Integration:', Integration);
            console.log('Integration type:', typeof Integration);
            console.log('Is class:', typeof Integration === 'function' && Integration.prototype);
            console.log('Integration keys:', Object.keys(Integration || {}));
            console.log('Integration has features:', !!Integration?.features);
            console.log('Integration has payment method:', typeof Integration?.payment);
            
            if (!Integration) {
                errorDiv.textContent = 'Платежная система не инициализирована. Попробуйте обновить страницу.';
                errorDiv.style.display = 'block';
                console.error('Integration instance not found');
                return;
            }

            // Проверяем, что система инициализирована
            if (!window.tbankPaymentInit?.isReady()) {
                console.warn('PaymentIntegration is not ready, waiting...');
                errorDiv.textContent = 'Платежная система не готова. Пожалуйста, подождите...';
                errorDiv.style.display = 'block';
                
                // Пытаемся подождать инициализации
                try {
                    await this.waitForPaymentSystem();
                    // Обновляем Integration после ожидания - используем сохраненный экземпляр
                    Integration = window.PaymentIntegrationInstance;
                    
                    if (!Integration) {
                        // Если экземпляр не найден, пытаемся получить из модуля
                        IntegrationModule = window.PaymentIntegrationModule ||
                                          window.tbankPaymentInit?.getIntegration() ||
                                          (PaymentIntegration.Integration || PaymentIntegration.default || PaymentIntegration);
                        if (IntegrationModule && IntegrationModule.__esModule && IntegrationModule.Integration) {
                            Integration = IntegrationModule.Integration;
                        } else if (IntegrationModule && typeof IntegrationModule.Integration === 'function') {
                            Integration = IntegrationModule.Integration;
                        }
                    }
                    console.log('Payment system ready after waiting');
                    errorDiv.style.display = 'none';
                } catch (error) {
                    console.error('Failed to wait for payment system:', error);
                    errorDiv.textContent = 'Не удалось инициализировать платежную систему. Попробуйте обновить страницу.';
                    errorDiv.style.display = 'block';
                    return;
                }
            }
            
            // Дополнительная проверка: убеждаемся, что Integration действительно инициализирован
            // Проверяем наличие features или payments (после init() может быть payments вместо features)
            const hasFeatures = !!Integration?.features;
            const hasPayments = !!Integration?.payments;
            const hasPaymentMethod = typeof Integration?.payment === 'function';
            const hasPaymentsMethod = typeof Integration?.payments?.open === 'function' || typeof Integration?.payments?.pay === 'function';
            
            if (!Integration || (!hasFeatures && !hasPayments && !hasPaymentMethod && !hasPaymentsMethod)) {
                console.error('Integration exists but not properly initialized');
                console.error('Integration:', Integration);
                console.error('Integration keys:', Object.keys(Integration || {}));
                console.error('hasFeatures:', hasFeatures);
                console.error('hasPayments:', hasPayments);
                console.error('hasPaymentMethod:', hasPaymentMethod);
                console.error('hasPaymentsMethod:', hasPaymentsMethod);
                errorDiv.textContent = 'Платежная система не инициализирована. Попробуйте обновить страницу.';
                errorDiv.style.display = 'block';
                return;
            }

            // Блокируем кнопку
            paymentButton.disabled = true;
            paymentButton.textContent = 'Обработка...';
            errorDiv.style.display = 'none';

            try {
                // Проверяем и восстанавливаем данные из формы, если они потеряны
                if (!this.bookingData.name || !this.bookingData.phone) {
                    const nameInput = this.modal.querySelector('#booking-name');
                    const phoneInput = this.modal.querySelector('#booking-phone');
                    if (nameInput) this.bookingData.name = nameInput.value.trim();
                    if (phoneInput) this.bookingData.phone = phoneInput.value.trim();
                }
                
                // Валидация обязательных полей
                let customerName = (this.bookingData.name || '').trim();
                let customerPhone = (this.bookingData.phone || '').trim();
                
                // Очищаем имя от лишних пробелов и проверяем формат
                customerName = customerName.replace(/\s+/g, ' ').trim();
                
                if (!customerName || customerName.length < 2) {
                    throw new Error('Имя клиента обязательно и должно содержать минимум 2 символа');
                }
                
                if (customerName.length > 100) {
                    customerName = customerName.substring(0, 100);
                }
                
                // Очищаем телефон от лишних символов, оставляем только цифры и +
                customerPhone = customerPhone.replace(/[^\d+]/g, '').trim();
                
                if (!customerPhone || customerPhone.length < 5) {
                    throw new Error('Телефон клиента обязателен');
                }
                
                // Проверяем, что имя содержит хотя бы одну букву
                if (!/[а-яА-Яa-zA-Z]/.test(customerName)) {
                    throw new Error('Имя должно содержать хотя бы одну букву');
                }
                
                // Нормализуем имя для API Т-Банка
                // Убираем специальные символы, оставляем только буквы, пробелы, дефисы и точки
                let normalizedName = customerName.replace(/[^а-яА-Яa-zA-Z\s\-\.]/g, '').trim();
                if (normalizedName.length < 2) {
                    throw new Error('Имя содержит недопустимые символы');
                }
                
                // Пробуем транслитерировать латиницу в кириллицу, если API требует кириллицу
                // Простая транслитерация для распространенных имен
                const translitMap = {
                    'Eugene': 'Евгений',
                    'eugene': 'евгений',
                    'Eugene': 'Евгений'
                };
                
                // Если имя полностью на латинице и есть в мапе, заменяем
                if (/^[a-zA-Z\s]+$/.test(normalizedName) && translitMap[normalizedName]) {
                    normalizedName = translitMap[normalizedName];
                    console.log('Transliterated name from', customerName, 'to', normalizedName);
                }
                
                customerName = normalizedName;
                
                // Формируем параметры платежа
                // Согласно документации Т-Банка, метод payments.create() требует ТОЛЬКО:
                // - amount (в копейках)
                // - orderId
                // - description
                // Поля name и phone НЕ должны передаваться в create() - они уже сохранены на бэкенде
                // Используем процент из настроек
                const paymentAmount = this.pricingData.totalPrice * (this.paymentPercent / 100);
                const amountInKopecks = Math.round(paymentAmount * 100); // в копейках
                
                // Создаем ТОЛЬКО обязательные параметры - БЕЗ name и phone
                const paymentParams = {
                    amount: amountInKopecks,
                    orderId: paymentData.orderId,
                    description: `Бронирование зала ${this.bookingData.hall || 'неизвестный'}`
                };
                
                // ЯВНО удаляем name и phone, если они каким-то образом попали в paymentParams
                delete paymentParams.name;
                delete paymentParams.phone;
                delete paymentParams.firstName;
                delete paymentParams.lastName;
                delete paymentParams.customer;
                
                // ВАЖНО: name и phone уже переданы на бэкенд при создании платежа через /api/booking/create-payment
                // и сохранены в базе данных. API Т-Банка не принимает эти поля в методе create()

                console.log('Starting payment:');
                console.log('  Full amount:', this.pricingData.totalPrice, '₽');
                console.log('  Payment amount (50%):', paymentAmount, '₽');
                console.log('  Amount in kopecks:', amountInKopecks);
                console.log('  Payment params:', paymentParams);
                console.log('Booking data:', this.bookingData);
                console.log('Customer name:', customerName);
                console.log('Customer phone:', customerPhone);
                console.log('Integration object:', Integration);
                console.log('Integration type:', typeof Integration);
                console.log('Integration keys:', Object.keys(Integration || {}));
                
                // Детальная диагностика Integration
                if (Integration) {
                    console.log('Integration properties:', {
                        hasPayment: typeof Integration.payment,
                        hasOpenPaymentForm: typeof Integration.openPaymentForm,
                        hasCreatePayment: typeof Integration.createPayment,
                        hasFeatures: !!Integration.features,
                        featuresKeys: Integration.features ? Object.keys(Integration.features) : null,
                        hasPaymentFeature: !!(Integration.features && Integration.features.payment),
                        paymentFeatureKeys: Integration.features?.payment ? Object.keys(Integration.features.payment) : null
                    });
                }

                // Проверяем доступные методы Integration
                let paymentResult;
                
                // ВАРИАНТ 3: Использовать iframe вместо create (рекомендуется)
                // iframe может принимать name и phone, в отличие от payments.create()
                if (Integration.iframe && typeof Integration.iframe.open === 'function') {
                    console.log('Using Integration.iframe.open() (recommended method)');
                    try {
                        const iframeParams = {
                            amount: amountInKopecks,
                            orderId: paymentData.orderId,
                            description: `Бронирование зала ${this.bookingData.hall || 'неизвестный'}`,
                            name: customerName,
                            phone: customerPhone
                        };
                        console.log('Opening iframe with params:', iframeParams);
                        paymentResult = await Integration.iframe.open(iframeParams);
                        
                        // Если iframe открылся успешно, он покажет форму оплаты
                        if (paymentResult) {
                            console.log('Iframe opened successfully, result:', paymentResult);
                            
                            // iframe.open() может вернуть URL или элемент iframe
                            // Если вернулся URL, используем renderPaymentIframe
                            if (typeof paymentResult === 'string' || (paymentResult && paymentResult.url)) {
                                const iframeUrl = typeof paymentResult === 'string' ? paymentResult : paymentResult.url;
                                this.renderPaymentIframe(iframeUrl);
                                return; // Выходим - iframe покажет форму оплаты
                            } else if (paymentResult && paymentResult.success) {
                                // Если платеж уже успешен (редкий случай)
                                this.handlePaymentSuccess(paymentData.orderId);
                                return;
                            } else {
                                // iframe может автоматически встроиться в контейнер
                                // Просто выходим - форма оплаты должна отобразиться
                                console.log('Iframe should be displayed automatically');
                                return;
                            }
                        }
                    } catch (iframeError) {
                        console.error('Iframe.open failed:', iframeError);
                        console.log('Falling back to payments.create()');
                        // Продолжаем к payments.create() как fallback
                    }
                }
                
                // Сначала проверяем payments (может быть вместо features.payment)
                if (Integration.payments) {
                    const payments = Integration.payments;
                    console.log('Payments found:', payments);
                    console.log('Payments methods:', Object.keys(payments));
                    console.log('Payments prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(payments)));
                    
                    // Проверяем все возможные методы создания платежа
                    // Пробуем использовать open вместо create, так как create требует name
                    if (typeof payments.open === 'function') {
                        console.log('Using Integration.payments.open()');
                        // Метод open может не требовать name
                        paymentResult = await payments.open(paymentParams);
                    } else if (typeof payments.pay === 'function') {
                        console.log('Using Integration.payments.pay()');
                        paymentResult = await payments.pay(paymentParams);
                    } else if (typeof payments.create === 'function') {
                        console.log('Using Integration.payments.create()');
                        // API Т-Банка требует ТОЛЬКО: amount, orderId, description
                        // name и phone уже сохранены на бэкенде при создании платежа
                        
                        // Создаем ЧИСТЫЙ объект только с обязательными полями
                        const cleanParams = {
                            amount: paymentParams.amount,
                            orderId: paymentParams.orderId,
                            description: paymentParams.description
                        };
                        
                        console.log('Creating payment with CLEAN params (ONLY amount, orderId, description):', cleanParams);
                        console.log('PaymentParams keys:', Object.keys(paymentParams));
                        console.log('CleanParams keys:', Object.keys(cleanParams));
                        
                        paymentResult = await payments.create(cleanParams);
                    } else {
                        // Пробуем найти метод через прототип
                        const proto = Object.getPrototypeOf(payments);
                        const protoMethods = Object.getOwnPropertyNames(proto).filter(name => typeof payments[name] === 'function');
                        console.log('Prototype methods:', protoMethods);
                        
                        if (protoMethods.includes('create')) {
                            console.log('Using payments.create() from prototype');
                            // Создаем ЧИСТЫЙ объект только с обязательными полями
                            const cleanParams = {
                                amount: paymentParams.amount,
                                orderId: paymentParams.orderId,
                                description: paymentParams.description
                            };
                            console.log('Creating payment from prototype with CLEAN params:', cleanParams);
                            paymentResult = await payments.create(cleanParams);
                        } else {
                            console.error('Payments available but no method found. Available methods:', Object.keys(payments));
                            throw new Error('Метод оплаты не найден в Integration.payments. Доступные методы: ' + Object.keys(payments).join(', '));
                        }
                    }
                } 
                // Затем проверяем features.payment (основной способ для Т-Банка)
                else if (Integration.features && Integration.features.payment) {
                    const paymentFeature = Integration.features.payment;
                    console.log('Payment feature found:', paymentFeature);
                    console.log('Payment feature methods:', Object.keys(paymentFeature));
                    
                    if (typeof paymentFeature.open === 'function') {
                        console.log('Using Integration.features.payment.open()');
                        paymentResult = await paymentFeature.open(paymentParams);
                    } else if (typeof paymentFeature.pay === 'function') {
                        console.log('Using Integration.features.payment.pay()');
                        paymentResult = await paymentFeature.pay(paymentParams);
                    } else if (typeof paymentFeature.create === 'function') {
                        console.log('Using Integration.features.payment.create()');
                        // Создаем ЧИСТЫЙ объект только с обязательными полями
                        const cleanParams = {
                            amount: paymentParams.amount,
                            orderId: paymentParams.orderId,
                            description: paymentParams.description
                        };
                        console.log('Creating payment via features.payment.create() with CLEAN params:', cleanParams);
                        paymentResult = await paymentFeature.create(cleanParams);
                    } else {
                        console.error('Payment feature available but no method found. Available methods:', Object.keys(paymentFeature));
                        throw new Error('Метод оплаты не найден в Integration.features.payment. Доступные методы: ' + Object.keys(paymentFeature).join(', '));
                    }
                } else if (typeof Integration.payment === 'function') {
                    console.log('Using Integration.payment()');
                    paymentResult = await Integration.payment(paymentParams);
                } else if (typeof Integration.openPaymentForm === 'function') {
                    console.log('Using Integration.openPaymentForm()');
                    paymentResult = await Integration.openPaymentForm(paymentParams);
                } else if (typeof Integration.createPayment === 'function') {
                    console.log('Using Integration.createPayment()');
                    paymentResult = await Integration.createPayment(paymentParams);
                } else {
                    // Детальная диагностика проблемы
                    const availableMethods = Object.keys(Integration || {}).filter(key => typeof Integration[key] === 'function');
                    console.error('No payment method found. Available methods:', availableMethods);
                    console.error('Integration structure (first level):', {
                        features: !!Integration.features,
                        payments: !!Integration.payments,
                        payment: typeof Integration.payment,
                        openPaymentForm: typeof Integration.openPaymentForm,
                        createPayment: typeof Integration.createPayment
                    });
                    
                    throw new Error('Платежный модуль не инициализирован. Integration не содержит методов оплаты. Проверьте конфигурацию и убедитесь, что features.payment включен.');
                }

                console.log('Payment result:', paymentResult);

                // Обработка результата
                if (paymentResult) {
                    if (paymentResult.success === true || paymentResult.status === 'success') {
                        this.handlePaymentSuccess(paymentData.orderId);
                    } else if (paymentResult.success === false || paymentResult.status === 'error') {
                        throw new Error(paymentResult.error || paymentResult.message || 'Ошибка при обработке платежа');
                    } else {
                        // Если результат не содержит явного статуса, считаем успешным
                        // (некоторые API возвращают просто объект без success)
                        console.warn('Payment result without explicit success status, assuming success');
                        this.handlePaymentSuccess(paymentData.orderId);
                    }
                } else {
                    throw new Error('Пустой ответ от платежной системы');
                }
            } catch (error) {
                console.error('Ошибка оплаты:', error);
                console.error('Error stack:', error.stack);
                errorDiv.textContent = error.message || 'Ошибка при оплате. Попробуйте еще раз.';
                errorDiv.style.display = 'block';
                paymentButton.disabled = false;
                paymentButton.textContent = 'Оплатить';
            }
        });
    }

    handlePaymentMessage(event) {
        // Обработка сообщений от платежной системы
        if (event.data && event.data.type === 'payment-success') {
            this.handlePaymentSuccess(event.data.orderId);
        }
    }

    async handlePaymentSuccess(orderId) {
        // Устанавливаем флаг успешной оплаты
        this.paymentCompleted = true;
        
        // Отправляем данные в Telegram
        try {
            const response = await fetch('/api/booking/send-telegram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    booking: this.bookingData,
                    pricing: this.pricingData,
                    orderId: orderId,
                    paymentStatus: 'success'
                })
            });

            const result = await response.json();
            
            if (!response.ok || !result.success) {
                console.error('Ошибка отправки в Telegram:', result.error || result.message);
                // Показываем предупреждение, но не блокируем успешную оплату
                if (result.message && result.message.includes('not configured')) {
                    console.warn('Telegram не настроен, но бронирование сохранено');
                }
            } else {
                console.log('Уведомление успешно отправлено в Telegram');
            }
        } catch (error) {
            console.error('Ошибка отправки в Telegram:', error);
            // Не блокируем успешную оплату из-за ошибки Telegram
        }

        // Переходим к шагу успешной оплаты
        this.goToStep(3);
    }
}

// Инициализация при загрузке страницы
let bookingModalInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    bookingModalInstance = new BookingModal();

    // Перехватываем отправку формы бронирования
    // Обрабатываем все формы бронирования на странице
    document.querySelectorAll('.booking-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopImmediatePropagation(); // Останавливаем другие обработчики
            
            // Валидация формы через pricingIntegration, если доступен
            if (window.pricingIntegration && typeof window.pricingIntegration.validateForm === 'function') {
                const validation = window.pricingIntegration.validateForm();
                if (!validation.valid) {
                    alert(validation.error);
                    return;
                }
            }
            
            const formData = new FormData(e.target);
            
            // Базовая валидация обязательных полей
            const date = formData.get('date');
            const timeFrom = formData.get('time-from');
            const timeTo = formData.get('time-to');
            
            if (!date || !timeFrom || !timeTo) {
                alert('Пожалуйста, заполните все обязательные поля (дата и время)');
                return;
            }
            
            // Получаем hall-id из контейнера формы или из URL
            const formContainer = e.target.closest('.booking-form-container');
            const hall = formContainer?.getAttribute('data-hall-id') || 
                        document.querySelector('[data-hall-id]')?.getAttribute('data-hall-id') ||
                        window.location.pathname.split('/').pop().replace('.html', '');
            
            const bookingData = {
                hall: hall,
                date: date,
                timeFrom: timeFrom,
                timeTo: timeTo,
                guests: formData.get('guests')
            };

            // Получаем расчет стоимости
            let totalPrice = 0;
            
            // Используем validation из pricingIntegration, если доступен
            if (window.pricingIntegration && typeof window.pricingIntegration.validateForm === 'function') {
                const validation = window.pricingIntegration.validateForm();
                if (validation.valid && validation.calculation) {
                    totalPrice = validation.calculation.total || 0;
                }
            }
            
            // Если цена не получена, пытаемся извлечь из контейнера
            if (totalPrice === 0) {
                const pricingContainer = e.target.querySelector('#pricing-container');
                if (pricingContainer && pricingContainer.textContent) {
                    const priceMatch = pricingContainer.textContent.match(/(\d+[\s,]*\d*)\s*₽/);
                    if (priceMatch) {
                        totalPrice = parseFloat(priceMatch[1].replace(/\s/g, '').replace(',', '.'));
                    }
                }
            }

            // Если цена все еще не найдена, используем калькулятор
            if (totalPrice === 0 && typeof calculateBookingPrice === 'function') {
                totalPrice = calculateBookingPrice(bookingData);
            }

            const pricingData = {
                ...bookingData,
                hall: getHallName(hall),
                totalPrice: totalPrice || 0
            };

            // Открываем модальное окно для ввода имени и телефона
            if (bookingModalInstance) {
                bookingModalInstance.open(bookingData, pricingData);
            } else {
                console.error('Модальное окно бронирования не инициализировано');
                alert('Ошибка: модальное окно не загружено. Пожалуйста, обновите страницу.');
            }
        }, { capture: true }); // Используем capture для приоритета обработки
    });
});

function getHallName(hallId) {
    const hallNames = {
        'armaloft': 'АРМАЛОФТ',
        'merkuri': 'МЕРКУРИ',
        'samolet': 'САМОЛЕТ',
        'rufer': 'РУФЕР',
        'pulka': 'ПУЛЬКА'
    };
    return hallNames[hallId] || hallId.toUpperCase();
}

// Экспорт для глобального доступа
window.BookingModal = BookingModal;
window.bookingModal = bookingModalInstance;

