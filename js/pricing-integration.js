/**
 * Интеграция модуля расчёта стоимости с формами бронирования
 */

class PricingIntegration {
    constructor(formSelector, options = {}) {
        this.form = document.querySelector(formSelector);
        this.options = {
            hallId: options.hallId || '',
            priceContainerId: options.priceContainerId || 'pricing-container',
            autoCalculate: options.autoCalculate !== false,
            ...options
        };
        
        if (!this.form) {
            console.error('Форма не найдена:', formSelector);
            return;
        }
        
        // Инициализация UI
        this.pricingUI = new PricingUI(this.options.priceContainerId, {
            hallId: this.options.hallId,
            showExtraServices: options.showExtraServices !== false,
            showBreakdown: options.showBreakdown !== false,
            onChange: () => this.calculate()
        });
        
        // Получение элементов формы
        this.dateInput = this.form.querySelector('[name="date"]');
        this.timeFromSelect = this.form.querySelector('[name="time-from"]');
        this.timeToSelect = this.form.querySelector('[name="time-to"]');
        this.guestsSelect = this.form.querySelector('[name="guests"]');
        
        // Маппинг ID залов для форм на разных страницах
        this.hallIdMap = {
            'armaloft': 'armaloft',
            'mercury': 'merkuri',
            'merkuri': 'merkuri',
            'pulka': 'pulka',
            'rufer': 'rufer',
            'samolet': 'samolet',
            'airplane': 'samolet'
        };
        
        // Определение ID зала
        this.determineHallId();
        
        // Установка обработчиков событий
        this.setupEventListeners();
        
        // Первоначальный расчёт (если данные уже заполнены)
        if (this.options.autoCalculate) {
            setTimeout(() => this.calculate(), 100);
        }
    }
    
    /**
     * Определение ID зала по URL или опциям
     */
    determineHallId() {
        if (this.options.hallId) {
            this.hallId = this.options.hallId;
            return;
        }
        
        // Попытка определить по URL
        const path = window.location.pathname;
        const filename = path.split('/').pop().replace('.html', '');
        
        // Маппинг файлов на ID залов
        const fileToHallMap = {
            'armaloft': 'armaloft',
            'merkuri': 'merkuri',
            'pulka': 'pulka',
            'rufer': 'rufer',
            'samolet': 'samolet'
        };
        
        this.hallId = fileToHallMap[filename] || this.options.hallId || '';
        
        if (!this.hallId) {
            console.warn('Не удалось определить ID зала');
        }
    }
    
    /**
     * Установка обработчиков событий
     */
    setupEventListeners() {
        const inputs = [
            this.dateInput,
            this.timeFromSelect,
            this.timeToSelect,
            this.guestsSelect
        ];
        
        inputs.forEach(input => {
            if (input) {
                input.addEventListener('change', () => {
                    if (this.options.autoCalculate) {
                        this.calculate();
                    }
                });
                
                input.addEventListener('input', () => {
                    if (this.options.autoCalculate) {
                        this.calculate();
                    }
                });
            }
        });
    }
    
    /**
     * Получение значений из формы
     */
    getFormValues() {
        const date = this.dateInput?.value || '';
        const startTime = this.timeFromSelect?.value || '';
        const endTime = this.timeToSelect?.value || '';
        const guestsValue = this.guestsSelect?.value || '';
        
        // Парсинг количества гостей (может быть в формате "1-10", "10-20" и т.д.)
        let guestsCount = 0;
        if (guestsValue) {
            if (guestsValue.includes('-')) {
                // Берём максимальное значение из диапазона
                const parts = guestsValue.split('-');
                guestsCount = parseInt(parts[parts.length - 1]) || 0;
            } else {
                guestsCount = parseInt(guestsValue) || 0;
            }
        }
        
        // Получение выбранных дополнительных услуг
        const extraServices = this.pricingUI.getSelectedExtraServices();
        
        return {
            date,
            startTime,
            endTime,
            guestsCount,
            extraServices
        };
    }
    
    /**
     * Выполнение расчёта стоимости
     */
    calculate() {
        if (!this.hallId) {
            this.pricingUI.showError('Не выбран зал');
            return;
        }
        
        const formValues = this.getFormValues();
        
        // Проверка заполненности обязательных полей
        if (!formValues.date || !formValues.startTime || !formValues.endTime || !formValues.guestsCount) {
            this.pricingUI.clear();
            return;
        }
        
        // Проверка корректности времени
        if (formValues.startTime === formValues.endTime) {
            this.pricingUI.showError('Время начала и окончания не могут совпадать');
            return;
        }
        
        // Выполнение расчёта
        const result = window.PricingCalculator.calculate({
            hallId: this.hallId,
            date: formValues.date,
            startTime: formValues.startTime,
            endTime: formValues.endTime,
            guestsCount: formValues.guestsCount,
            extraServices: formValues.extraServices
        });
        
        // Обновление UI
        this.pricingUI.updatePrice(result);
        
        // Вызов callback, если задан
        if (this.options.onCalculate && result.valid) {
            this.options.onCalculate(result);
        }
        
        return result;
    }
    
    /**
     * Валидация формы
     */
    validateForm() {
        const formValues = this.getFormValues();
        const result = this.calculate();
        
        if (!result || !result.valid) {
            return {
                valid: false,
                error: result?.error || 'Ошибка валидации'
            };
        }
        
        // Проверка минимального количества часов
        if (result.hours < 2) {
            return {
                valid: false,
                error: 'Минимальная аренда 2 часа'
            };
        }
        
        // Проверка бронирования с едой/алкоголем
        const foodAlcoholValidation = window.PricingCalculator.validateFoodAlcohol(
            this.hallId,
            result.hours
        );
        
        if (!foodAlcoholValidation.valid) {
            return {
                valid: false,
                error: foodAlcoholValidation.message
            };
        }
        
        return {
            valid: true,
            calculation: result
        };
    }
    
    /**
     * Получение итоговой стоимости
     */
    getTotalPrice() {
        const formValues = this.getFormValues();
        const result = window.PricingCalculator.calculate({
            hallId: this.hallId,
            date: formValues.date,
            startTime: formValues.startTime,
            endTime: formValues.endTime,
            guestsCount: formValues.guestsCount,
            extraServices: formValues.extraServices
        });
        
        return result.valid ? result.total : 0;
    }
}

// Экспорт
if (typeof window !== 'undefined') {
    window.PricingIntegration = PricingIntegration;
}




