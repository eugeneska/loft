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
            setTimeout(() => {
                this.calculate();
                // Обновляем доступные опции времени окончания
                this.updateEndTimeOptions().catch(err => console.error('Ошибка в updateEndTimeOptions:', err));
            }, 100);
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
        
        // Автоматическая установка времени окончания при выборе времени начала
        if (this.timeFromSelect && this.timeToSelect) {
            this.timeFromSelect.addEventListener('change', () => {
                this.autoSetEndTime().catch(err => console.error('Ошибка в autoSetEndTime:', err));
            });
            
            // Также при изменении даты пересчитываем время окончания
            if (this.dateInput) {
                this.dateInput.addEventListener('change', () => {
                    if (this.timeFromSelect.value) {
                        this.autoSetEndTime().catch(err => console.error('Ошибка в autoSetEndTime:', err));
                    }
                });
            }
            
            // Валидация при ручном изменении времени окончания
            this.timeToSelect.addEventListener('change', () => {
                this.validateEndTime();
            });
            
            // Обновление доступных опций времени окончания при изменении времени начала
            this.timeFromSelect.addEventListener('change', () => {
                this.updateEndTimeOptions().catch(err => console.error('Ошибка в updateEndTimeOptions:', err));
            });
            
            if (this.dateInput) {
                this.dateInput.addEventListener('change', () => {
                    if (this.timeFromSelect.value) {
                        this.updateEndTimeOptions().catch(err => console.error('Ошибка в updateEndTimeOptions:', err));
                    }
                });
            }
        }
    }
    
    /**
     * Автоматическая установка времени окончания на основе минимального количества часов
     * Учитывает занятые часы и выбирает ближайшее свободное время
     */
    async autoSetEndTime() {
        if (!this.timeFromSelect || !this.timeToSelect || !this.dateInput || !this.hallId) {
            return;
        }
        
        const timeFrom = this.timeFromSelect.value;
        const date = this.dateInput.value;
        
        if (!timeFrom || !date) {
            return;
        }
        
        // Получаем минимальное количество часов для зала
        const bookingDate = new Date(date + 'T00:00:00');
        const dayOfWeek = bookingDate.getDay();
        const isSaturday = dayOfWeek === 6;
        
        // Получаем настройки зала через PricingCalculator
        if (!window.PricingCalculator || typeof window.PricingCalculator.getHallPricing !== 'function') {
            console.warn('PricingCalculator.getHallPricing не доступен');
            return;
        }
        
        const hallPricing = window.PricingCalculator.getHallPricing(this.hallId, date);
        if (!hallPricing) {
            console.warn('Настройки зала не найдены для:', this.hallId);
            return;
        }
        
        const minHoursRequired = isSaturday && hallPricing.min_hours_saturday !== undefined 
            ? hallPricing.min_hours_saturday 
            : (hallPricing.min_hours !== undefined ? hallPricing.min_hours : 2);
        
        // Получаем занятые часы из API
        let busyHours = [];
        let busyIntervals = [];
        let endHours = new Set();
        
        try {
            if (window.getBusyHours && typeof window.getBusyHours === 'function') {
                // Маппинг ID залов для getBusyHours (некоторые залы используют другие ID)
                const hallIdForBusyHours = {
                    'merkuri': 'mercury',  // merkuri.html использует 'mercury'
                    'samolet': 'airplane', // samolet.html использует 'airplane'
                    'armaloft': 'armaloft',
                    'pulka': 'pulka',
                    'rufer': 'rufer'
                };
                
                const busyHoursHallId = hallIdForBusyHours[this.hallId] || this.hallId;
                const busyData = await window.getBusyHours(busyHoursHallId, date);
                busyHours = Array.isArray(busyData) ? busyData : (busyData?.hours || []);
                busyIntervals = busyData?.intervals || [];
                
                // Создаем Set с часами окончания занятых интервалов
                busyIntervals.forEach(interval => {
                    if (interval.to) {
                        const toHour = interval.to === '00:00:00' ? 24 : parseInt(interval.to.split(':')[0]);
                        if (toHour < 24) {
                            endHours.add(toHour);
                        }
                    }
                });
            }
        } catch (error) {
            console.warn('Ошибка при получении занятых часов в autoSetEndTime:', error);
        }
        
        // Вычисляем время окончания = время начала + минимальное количество часов
        const [fromH, fromM] = timeFrom.split(':').map(Number);
        const fromTotalMinutes = fromH * 60 + fromM;
        const minTotalMinutes = fromTotalMinutes + (minHoursRequired * 60);
        
        // Ищем ближайшее свободное время, которое:
        // 1. Не меньше минимального времени окончания
        // 2. Не занято
        // 3. Не является часом окончания занятого интервала
        const allOptions = Array.from(this.timeToSelect.options)
            .filter(opt => opt.value && opt.value !== '')
            .map(opt => {
                const [h, m] = opt.value.split(':').map(Number);
                let totalMinutes = h * 60 + m;
                // Если время меньше времени начала, считаем что это следующий день
                if (totalMinutes < fromTotalMinutes) {
                    totalMinutes += 24 * 60;
                }
                return { 
                    value: opt.value, 
                    hours: h, 
                    minutes: m, 
                    totalMinutes,
                    isBusy: busyHours.includes(h),
                    isEndHour: endHours.has(h)
                };
            })
            .filter(opt => {
                // Фильтруем опции, которые:
                // 1. Не меньше минимального времени окончания
                // 2. Не заняты
                // 3. Не являются часом окончания занятого интервала
                // 4. Не пересекаются с занятыми интервалами
                
                // Функция для проверки пересечения интервала [from, to] с занятыми интервалами
                const intersectsWithBusyInterval = (fromMinutes, toMinutes) => {
                    for (const interval of busyIntervals) {
                        if (!interval.from || !interval.to) continue;
                        
                        const intervalFromHour = parseInt(interval.from.split(':')[0]);
                        const intervalFromMin = parseInt(interval.from.split(':')[1] || 0);
                        let intervalFromMinutes = intervalFromHour * 60 + intervalFromMin;
                        
                        let intervalToHour = interval.to === '00:00:00' ? 24 : parseInt(interval.to.split(':')[0]);
                        const intervalToMin = interval.to === '00:00:00' ? 0 : parseInt(interval.to.split(':')[1] || 0);
                        let intervalToMinutes = intervalToHour * 60 + intervalToMin;
                        
                        // Если интервал переходит через полночь
                        if (intervalToMinutes < intervalFromMinutes) {
                            intervalToMinutes += 24 * 60;
                        }
                        
                        // Нормализуем время до, если оно переходит через полночь
                        let normalizedToMinutes = toMinutes;
                        if (normalizedToMinutes < fromMinutes) {
                            normalizedToMinutes += 24 * 60;
                        }
                        
                        // Проверяем пересечение интервалов
                        const fromInside = fromMinutes >= intervalFromMinutes && fromMinutes < intervalToMinutes;
                        const toInside = normalizedToMinutes > intervalFromMinutes && normalizedToMinutes <= intervalToMinutes;
                        const intervalInside = intervalFromMinutes >= fromMinutes && intervalToMinutes <= normalizedToMinutes;
                        
                        if (fromInside || toInside || intervalInside) {
                            return true;
                        }
                    }
                    return false;
                };
                
                const intersectsBusy = intersectsWithBusyInterval(fromTotalMinutes, opt.totalMinutes);
                
                return opt.totalMinutes >= minTotalMinutes && !opt.isBusy && !opt.isEndHour && !intersectsBusy;
            })
            .sort((a, b) => a.totalMinutes - b.totalMinutes);
        
        if (allOptions.length > 0) {
            // Устанавливаем ближайшее свободное время
            this.timeToSelect.value = allOptions[0].value;
            
            // Триггерим событие change для пересчёта
            this.timeToSelect.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            // Если не найдено свободное время, не устанавливаем ничего автоматически
            // Пользователь должен выбрать время вручную
            console.warn('Не найдено свободное время окончания. Пожалуйста, выберите время вручную.');
            // Очищаем поле, чтобы пользователь выбрал время вручную
            this.timeToSelect.value = '';
        }
    }
    
    /**
     * Обновление доступных опций времени окончания на основе минимального количества часов И занятых часов
     */
    async updateEndTimeOptions() {
        if (!this.timeFromSelect || !this.timeToSelect || !this.dateInput || !this.hallId) {
            return;
        }
        
        const timeFrom = this.timeFromSelect.value;
        const date = this.dateInput.value;
        
        if (!timeFrom || !date) {
            // Если время начала не выбрано, делаем все опции доступными
            Array.from(this.timeToSelect.options).forEach(opt => {
                opt.disabled = false;
            });
            return;
        }
        
        // Получаем минимальное количество часов
        const bookingDate = new Date(date + 'T00:00:00');
        const dayOfWeek = bookingDate.getDay();
        const isSaturday = dayOfWeek === 6;
        
        if (!window.PricingCalculator || typeof window.PricingCalculator.getHallPricing !== 'function') {
            return;
        }
        
        const hallPricing = window.PricingCalculator.getHallPricing(this.hallId, date);
        if (!hallPricing) {
            return;
        }
        
        const minHoursRequired = isSaturday && hallPricing.min_hours_saturday !== undefined 
            ? hallPricing.min_hours_saturday 
            : (hallPricing.min_hours !== undefined ? hallPricing.min_hours : 2);
        
        // Вычисляем минимальное время окончания
        const [fromH, fromM] = timeFrom.split(':').map(Number);
        const fromTotalMinutes = fromH * 60 + fromM;
        const minEndTotalMinutes = fromTotalMinutes + (minHoursRequired * 60);
        
        // Получаем занятые часы из API
        let busyHours = [];
        let busyIntervals = [];
        let endHours = new Set();
        
        try {
            // Пробуем получить занятые часы через глобальную функцию getBusyHours
            if (window.getBusyHours && typeof window.getBusyHours === 'function') {
                // Маппинг ID залов для getBusyHours (некоторые залы используют другие ID)
                const hallIdForBusyHours = {
                    'merkuri': 'mercury',  // merkuri.html использует 'mercury'
                    'samolet': 'airplane', // samolet.html использует 'airplane'
                    'armaloft': 'armaloft',
                    'pulka': 'pulka',
                    'rufer': 'rufer'
                };
                
                const busyHoursHallId = hallIdForBusyHours[this.hallId] || this.hallId;
                const busyData = await window.getBusyHours(busyHoursHallId, date);
                busyHours = Array.isArray(busyData) ? busyData : (busyData?.hours || []);
                busyIntervals = busyData?.intervals || [];
                
                // Создаем Set с часами окончания занятых интервалов
                busyIntervals.forEach(interval => {
                    if (interval.to) {
                        const toHour = interval.to === '00:00:00' ? 24 : parseInt(interval.to.split(':')[0]);
                        if (toHour < 24) {
                            endHours.add(toHour);
                        }
                    }
                });
            }
        } catch (error) {
            console.warn('Ошибка при получении занятых часов:', error);
        }
        
        // Функция для проверки пересечения интервала [from, to] с занятыми интервалами
        const intersectsWithBusyInterval = (fromMinutes, toMinutes) => {
            for (const interval of busyIntervals) {
                if (!interval.from || !interval.to) continue;
                
                const intervalFromHour = parseInt(interval.from.split(':')[0]);
                const intervalFromMin = parseInt(interval.from.split(':')[1] || 0);
                let intervalFromMinutes = intervalFromHour * 60 + intervalFromMin;
                
                let intervalToHour = interval.to === '00:00:00' ? 24 : parseInt(interval.to.split(':')[0]);
                const intervalToMin = interval.to === '00:00:00' ? 0 : parseInt(interval.to.split(':')[1] || 0);
                let intervalToMinutes = intervalToHour * 60 + intervalToMin;
                
                // Если интервал переходит через полночь
                if (intervalToMinutes < intervalFromMinutes) {
                    intervalToMinutes += 24 * 60;
                }
                
                // Нормализуем время до, если оно переходит через полночь
                let normalizedToMinutes = toMinutes;
                if (normalizedToMinutes < fromMinutes) {
                    normalizedToMinutes += 24 * 60;
                }
                
                // Проверяем пересечение интервалов
                // Интервалы пересекаются, если начало одного внутри другого или наоборот
                const fromInside = fromMinutes >= intervalFromMinutes && fromMinutes < intervalToMinutes;
                const toInside = normalizedToMinutes > intervalFromMinutes && normalizedToMinutes <= intervalToMinutes;
                const intervalInside = intervalFromMinutes >= fromMinutes && intervalToMinutes <= normalizedToMinutes;
                
                if (fromInside || toInside || intervalInside) {
                    return true;
                }
            }
            return false;
        };
        
        // Обновляем доступность опций
        Array.from(this.timeToSelect.options).forEach(opt => {
            if (!opt.value || opt.value === '') {
                // Опция "До" всегда доступна
                opt.disabled = false;
                return;
            }
            
            const [toH, toM] = opt.value.split(':').map(Number);
            let toTotalMinutes = toH * 60 + toM;
            
            // Если время меньше времени начала, считаем что это следующий день
            if (toTotalMinutes < fromTotalMinutes) {
                toTotalMinutes += 24 * 60;
            }
            
            // Проверяем, меньше ли время минимального времени окончания
            const isLessThanMin = toTotalMinutes < minEndTotalMinutes;
            
            // Проверяем, занят ли этот час
            const isBusyHour = busyHours.includes(toH);
            
            // Проверяем, является ли это часом окончания занятого интервала
            const isEndHour = endHours.has(toH);
            
            // Проверяем, пересекается ли интервал [timeFrom, timeTo] с занятыми интервалами
            const intersectsBusy = intersectsWithBusyInterval(fromTotalMinutes, toTotalMinutes);
            
            // Отключаем опции, которые:
            // 1. Меньше минимального времени окончания ИЛИ
            // 2. Заняты ИЛИ
            // 3. Являются часом окончания занятого интервала ИЛИ
            // 4. Пересекаются с занятыми интервалами
            opt.disabled = isLessThanMin || isBusyHour || isEndHour || intersectsBusy;
        });
        
        // Если текущее выбранное время меньше минимума или занято, автоматически устанавливаем правильное
        const currentTimeTo = this.timeToSelect.value;
        if (currentTimeTo) {
            const [currentToH, currentToM] = currentTimeTo.split(':').map(Number);
            let currentToTotalMinutes = currentToH * 60 + currentToM;
            if (currentToTotalMinutes < fromTotalMinutes) {
                currentToTotalMinutes += 24 * 60;
            }
            
            const isLessThanMin = currentToTotalMinutes < minEndTotalMinutes;
            const isBusyHour = busyHours.includes(currentToH);
            const isEndHour = endHours.has(currentToH);
            
            if (isLessThanMin || isBusyHour || isEndHour) {
                this.autoSetEndTime().catch(err => console.error('Ошибка в autoSetEndTime:', err));
            }
        }
    }
    
    /**
     * Валидация времени окончания - проверка минимального количества часов
     */
    validateEndTime() {
        if (!this.timeFromSelect || !this.timeToSelect || !this.dateInput || !this.hallId) {
            return;
        }
        
        const timeFrom = this.timeFromSelect.value;
        const timeTo = this.timeToSelect.value;
        const date = this.dateInput.value;
        
        if (!timeFrom || !timeTo || !date) {
            return;
        }
        
        // Получаем минимальное количество часов
        const bookingDate = new Date(date + 'T00:00:00');
        const dayOfWeek = bookingDate.getDay();
        const isSaturday = dayOfWeek === 6;
        
        if (!window.PricingCalculator || typeof window.PricingCalculator.getHallPricing !== 'function') {
            return;
        }
        
        const hallPricing = window.PricingCalculator.getHallPricing(this.hallId, date);
        if (!hallPricing) {
            return;
        }
        
        const minHoursRequired = isSaturday && hallPricing.min_hours_saturday !== undefined 
            ? hallPricing.min_hours_saturday 
            : (hallPricing.min_hours !== undefined ? hallPricing.min_hours : 2);
        
        // Вычисляем длительность
        const [fromH, fromM] = timeFrom.split(':').map(Number);
        const [toH, toM] = timeTo.split(':').map(Number);
        
        let fromTotalMinutes = fromH * 60 + fromM;
        let toTotalMinutes = toH * 60 + toM;
        
        // Если время окончания меньше времени начала, считаем что это следующий день
        if (toTotalMinutes < fromTotalMinutes) {
            toTotalMinutes += 24 * 60;
        }
        
        const durationMinutes = toTotalMinutes - fromTotalMinutes;
        const durationHours = durationMinutes / 60;
        
        // Если длительность меньше минимальной, автоматически устанавливаем правильное время
        if (durationHours < minHoursRequired) {
            this.autoSetEndTime().catch(err => console.error('Ошибка в autoSetEndTime:', err));
        }
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
        
        // Проверка максимальной длительности бронирования (12 часов) - делаем ДО calculate()
        if (formValues.startTime && formValues.endTime) {
            const [fromH, fromM] = formValues.startTime.split(':').map(Number);
            const [toH, toM] = formValues.endTime.split(':').map(Number);
            let fromTotalMinutes = fromH * 60 + fromM;
            let toTotalMinutes = toH * 60 + toM;
            
            // Если время окончания меньше времени начала, считаем что это следующий день
            if (toTotalMinutes < fromTotalMinutes) {
                toTotalMinutes += 24 * 60;
            }
            
            const durationMinutes = toTotalMinutes - fromTotalMinutes;
            const durationHours = Math.round(durationMinutes / 60);
            const maxDurationHours = 12;
            
            if (durationHours > maxDurationHours) {
                return {
                    valid: false,
                    error: `Максимальная длительность бронирования через сайт составляет ${maxDurationHours} часов. Для бронирования на ${durationHours} часов пожалуйста, обратитесь к менеджеру`
                };
            }
        }
        
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
        
        // Дополнительная проверка максимального количества часов (на случай если calculate вернет другое значение)
        const maxDurationHours = 12;
        if (result.hours > maxDurationHours) {
            const durationHours = Math.round(result.hours);
            return {
                valid: false,
                error: `Максимальная длительность бронирования через сайт составляет ${maxDurationHours} часов. Для бронирования на ${durationHours} часов пожалуйста, обратитесь к менеджеру`
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




