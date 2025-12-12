/**
 * UI компонент для отображения стоимости аренды и дополнительных услуг
 */

class PricingUI {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            hallId: options.hallId || '',
            showExtraServices: options.showExtraServices !== false,
            showBreakdown: options.showBreakdown !== false,
            ...options
        };
        
        this.init();
    }
    
    init() {
        if (!this.container) {
            console.error('Контейнер для PricingUI не найден');
            return;
        }
        
        // Создание структуры UI
        this.createUIStructure();
        
        // Получение элементов
        this.priceDisplay = this.container.querySelector('.pricing-total');
        this.breakdownContainer = this.container.querySelector('.pricing-breakdown');
        this.warningsContainer = this.container.querySelector('.pricing-warnings');
        this.extraServicesContainer = this.container.querySelector('.pricing-extra-services');
        
        // Инициализация дополнительных услуг
        if (this.options.showExtraServices) {
            this.renderExtraServices();
        }
    }
    
    createUIStructure() {
        const extraServicesHTML = this.options.showExtraServices 
            ? '<div class="pricing-extra-services"></div>'
            : '';
            
        const breakdownHTML = this.options.showBreakdown
            ? '<div class="pricing-breakdown"></div>'
            : '';
        
        this.container.innerHTML = `
            <div class="pricing-container">
                ${extraServicesHTML}
                <div class="pricing-warnings"></div>
                ${breakdownHTML}
                <div class="pricing-total-container">
                    <div class="pricing-total-label">Итого:</div>
                    <div class="pricing-total">0 ₽</div>
                </div>
            </div>
        `;
    }
    
    /**
     * Отрисовка дополнительных услуг
     */
    renderExtraServices() {
        if (!this.extraServicesContainer) return;
        
        const services = window.PricingCalculator.getExtraServices();
        console.log('📋 Все услуги из калькулятора:', Object.keys(services));
        console.log('📋 Детали услуг:', services);
        
        let html = '<div class="pricing-extra-services-title">Дополнительные услуги:</div>';
        html += '<div class="pricing-extra-services-list">';
        
        // Отслеживаем уже показанные названия, чтобы избежать дублирования
        const shownNames = new Set();
        
        Object.entries(services).forEach(([id, service]) => {
            console.log(`🔍 Проверка услуги ${id}:`, service);
            
            // Пропускаем услуги без цены или с некорректной ценой
            if (!service || service.price == null || service.price === undefined || isNaN(service.price) || service.price <= 0) {
                console.warn(`❌ Пропуск услуги ${id} (${service?.name || 'unknown'}): невалидная цена`, {
                    service,
                    price: service?.price,
                    priceType: typeof service?.price,
                    isNaN: isNaN(service?.price),
                    isNull: service?.price == null,
                    isUndefined: service?.price === undefined
                });
                return;
            }
            
            // Пропускаем услуги с дублирующимися названиями (оставляем первую)
            if (shownNames.has(service.name)) {
                console.warn(`⚠️ Пропуск услуги ${id} с дублирующимся названием "${service.name}"`);
                return;
            }
            shownNames.add(service.name);
            
            console.log(`✅ Услуга ${id} (${service.name}) будет отображена`);
            
            const checkboxId = `service-${id}`;
            const price = parseFloat(service.price) || 0;
            html += `
                <div class="pricing-extra-service-item">
                    <label class="pricing-extra-service-label">
                        <input 
                            type="checkbox" 
                            class="pricing-extra-service-checkbox" 
                            value="${id}" 
                            id="${checkboxId}"
                            data-service-name="${service.name}"
                            data-service-price="${price}"
                            data-service-type="${service.type || 'fixed'}"
                            ${service.per ? `data-service-per="${service.per}"` : ''}
                        >
                        <span class="pricing-extra-service-text">
                            ${service.name} 
                            ${service.type === 'per_person' && service.per 
                                ? `(${price} ₽ за каждые ${service.per} чел.)`
                                : `(${price} ₽)`
                            }
                        </span>
                    </label>
                </div>
            `;
        });
        
        html += '</div>';
        this.extraServicesContainer.innerHTML = html;
        
        // Логирование для отладки
        const serviceCount = shownNames.size;
        console.log(`Rendered ${serviceCount} extra services (after deduplication):`, Array.from(shownNames));
        
        // Обработчики событий для чекбоксов
        const checkboxes = this.extraServicesContainer.querySelectorAll('.pricing-extra-service-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.onExtraServicesChange();
            });
        });
    }
    
    /**
     * Получение выбранных дополнительных услуг
     */
    getSelectedExtraServices() {
        if (!this.extraServicesContainer) return [];
        
        const checkboxes = this.extraServicesContainer.querySelectorAll('.pricing-extra-service-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    /**
     * Обновление отображения стоимости
     */
    updatePrice(calculationResult) {
        if (!calculationResult || !calculationResult.valid) {
            this.showError(calculationResult?.error || 'Ошибка расчёта');
            return;
        }
        
        const { total, breakdown, details, warnings = [] } = calculationResult;
        
        // Обновление итоговой стоимости
        if (this.priceDisplay) {
            this.priceDisplay.textContent = `${total.toLocaleString('ru-RU')} ₽`;
        }
        
        // Обновление детализации
        if (this.breakdownContainer && breakdown) {
            let breakdownHTML = '<div class="pricing-breakdown-title">Детализация:</div>';
            breakdownHTML += '<div class="pricing-breakdown-items">';
            
            breakdownHTML += `<div class="pricing-breakdown-item">
                <span class="pricing-breakdown-label">Аренда зала:</span>
                <span class="pricing-breakdown-value">${breakdown.base}</span>
            </div>`;
            
            breakdownHTML += `<div class="pricing-breakdown-item">
                <span class="pricing-breakdown-label">Уборка:</span>
                <span class="pricing-breakdown-value">${breakdown.cleaning}</span>
            </div>`;
            
            if (breakdown.after_hours && breakdown.after_hours !== '0 руб') {
                breakdownHTML += `<div class="pricing-breakdown-item">
                    <span class="pricing-breakdown-label">Внеурочное время:</span>
                    <span class="pricing-breakdown-value">${breakdown.after_hours}</span>
                </div>`;
            }
            
            if (breakdown.extra_services && breakdown.extra_services !== '0 руб') {
                breakdownHTML += `<div class="pricing-breakdown-item">
                    <span class="pricing-breakdown-label">Доп. услуги:</span>
                    <span class="pricing-breakdown-value">${breakdown.extra_services}</span>
                </div>`;
            }
            
            breakdownHTML += '</div>';
            this.breakdownContainer.innerHTML = breakdownHTML;
        }
        
        // Обновление предупреждений
        this.updateWarnings(warnings, details);
    }
    
    /**
     * Обновление предупреждений
     */
    updateWarnings(warnings, details) {
        if (!this.warningsContainer) return;
        
        const allWarnings = [...warnings];
        
        // Добавление предупреждения о декабрьских тарифах
        if (details.season === 'december') {
            allWarnings.push('Применяются декабрьские тарифы');
        }
        
        if (allWarnings.length === 0) {
            this.warningsContainer.innerHTML = '';
            return;
        }
        
        let warningsHTML = '<div class="pricing-warnings-list">';
        allWarnings.forEach(warning => {
            warningsHTML += `<div class="pricing-warning">${warning}</div>`;
        });
        warningsHTML += '</div>';
        this.warningsContainer.innerHTML = warningsHTML;
    }
    
    /**
     * Показ ошибки
     */
    showError(message) {
        if (this.priceDisplay) {
            this.priceDisplay.textContent = '—';
        }
        
        if (this.warningsContainer) {
            this.warningsContainer.innerHTML = `
                <div class="pricing-error">${message}</div>
            `;
        }
        
        if (this.breakdownContainer) {
            this.breakdownContainer.innerHTML = '';
        }
    }
    
    /**
     * Очистка отображения
     */
    clear() {
        if (this.priceDisplay) {
            this.priceDisplay.textContent = '0 ₽';
        }
        
        if (this.warningsContainer) {
            this.warningsContainer.innerHTML = '';
        }
        
        if (this.breakdownContainer) {
            this.breakdownContainer.innerHTML = '';
        }
    }
    
    /**
     * Обработчик изменения дополнительных услуг
     */
    onExtraServicesChange() {
        // Вызывается при изменении чекбоксов
        // Должен вызывать callback для пересчёта
        if (this.options.onChange) {
            this.options.onChange();
        }
    }
}

// Экспорт
if (typeof window !== 'undefined') {
    window.PricingUI = PricingUI;
}











