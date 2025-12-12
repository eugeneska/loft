/**
 * Обновленная версия калькулятора с поддержкой PHP API
 * Использует данные из PHP API, если они доступны, иначе fallback на захардкоженные данные
 */

// Импорт оригинального калькулятора (должен быть загружен раньше)
// Это расширение оригинального pricing-calculator.js

(function() {
    'use strict';
    
    // Ждем загрузки API loader и оригинального калькулятора
    function initApiCalculator() {
        if (!window.PricingCalculator || !window.PricingApiLoader) {
            setTimeout(initApiCalculator, 100);
            return;
        }
        
        // Сохраняем оригинальные функции
        const originalCalculate = window.PricingCalculator.calculate;
        const originalGetExtraServices = window.PricingCalculator.getExtraServices;
        
        // Переопределяем getHallPricing для использования API данных
        const originalGetHallPricing = window.getHallPricing || function(hallId, date) {
            const season = window.getPricingSeason ? window.getPricingSeason(date) : 'standard';
            const prices = season === 'december' ? window.DECEMBER_PRICES : window.STANDARD_PRICES;
            return prices[hallId] || null;
        };
        
        // Новая функция получения прайса с поддержкой API
        async function getHallPricingFromAPI(hallId, date) {
            try {
                const apiData = await window.PricingApiLoader.get();
                
                if (apiData && apiData.halls && apiData.halls.length > 0) {
                    const converted = window.PricingApiLoader.convert(apiData);
                    const hall = converted.halls[hallId];
                    
                    if (hall) {
                        // Определяем какой прайс-сет использовать
                        const priceSetCode = window.PricingDataAPI?.getPriceSetForDate(date) || 
                                            window.getPricingSeason ? window.getPricingSeason(date) : 'standard';
                        
                        // Используем все доступные прайс-сеты, а не только standard/december
                        let priceSet = null;
                        if (hall.priceSets && hall.priceSets[priceSetCode]) {
                            priceSet = hall.priceSets[priceSetCode];
                        } else if (priceSetCode === 'december' && hall.december) {
                            priceSet = hall.december;
                        } else if (hall.standard) {
                            priceSet = hall.standard;
                        } else if (hall.priceSets && Object.keys(hall.priceSets).length > 0) {
                            // Fallback на первый доступный прайс-сет
                            priceSet = Object.values(hall.priceSets)[0];
                        }
                        
                        if (priceSet) {
                            return {
                                ...priceSet,
                                name: hall.name
                            };
                        }
                    }
                }
            } catch (error) {
                console.warn('Failed to get pricing from API, using fallback:', error);
            }
            
            // Fallback на оригинальную функцию
            return originalGetHallPricing(hallId, date);
        }
        
        // Новая функция получения дополнительных услуг из API
        function getExtraServicesFromAPI() {
            try {
                if (window.PricingDataAPI && window.PricingDataAPI.converted) {
                    return window.PricingDataAPI.converted.extras || {};
                }
            } catch (error) {
                console.warn('Failed to get extras from API, using fallback:', error);
            }
            
            // Fallback на оригинальную функцию
            return originalGetExtraServices();
        }
        
        // Обновленная функция расчета с поддержкой API
        async function calculateWithAPI(params) {
            const { hallId, date } = params;
            
            // Получаем прайс зала (с поддержкой API)
            let hallPricing;
            try {
                if (window.PricingApiLoader) {
                    hallPricing = await getHallPricingFromAPI(hallId, new Date(date));
                } else {
                    hallPricing = originalGetHallPricing(hallId, new Date(date));
                }
            } catch (error) {
                console.warn('API not available, using fallback:', error);
                hallPricing = originalGetHallPricing(hallId, new Date(date));
            }
            
            if (!hallPricing) {
                return {
                    error: 'Зал не найден',
                    valid: false
                };
            }
            
            // Используем оригинальную логику расчета, но с данными из API
            // Создаем временную замену констант
            const originalStandard = window.STANDARD_PRICES;
            const originalDecember = window.DECEMBER_PRICES;
            
            // Временно заменяем константы на данные из API (если доступны)
            if (window.PricingDataAPI && window.PricingDataAPI.converted) {
                const converted = window.PricingDataAPI.converted;
                if (converted.halls[hallId]) {
                    // Данные уже есть в hallPricing, используем их напрямую
                }
            }
            
            // Выполняем расчет используя оригинальную функцию
            // Но нужно подменить данные перед расчетом
            return originalCalculate({
                ...params,
                _hallPricing: hallPricing // Передаем прайс напрямую
            });
        }
        
        // Обертка для синхронной функции расчета
        function calculateRentalPriceWrapper(params) {
            // Если есть данные из API, используем их
            if (window.PricingDataAPI && window.PricingDataAPI.isLoaded) {
                const { hallId, date, startTime, endTime, guestsCount, extraServices = [] } = params;
                
                // Валидация
                if (!hallId || !date || !startTime || !endTime || !guestsCount) {
                    return {
                        error: 'Не все обязательные поля заполнены',
                        valid: false
                    };
                }
                
                const bookingDate = new Date(date);
                if (isNaN(bookingDate.getTime())) {
                    return {
                        error: 'Некорректная дата',
                        valid: false
                    };
                }
                
                // Получаем данные из API
                const apiData = window.PricingDataAPI.raw;
                const converted = window.PricingDataAPI.converted;
                const hall = converted.halls[hallId];
                
                if (!hall) {
                    return {
                        error: 'Зал не найден',
                        valid: false
                    };
                }
                
                // Определяем прайс-сет по дате
                const priceSetCode = window.PricingDataAPI.getPriceSetForDate(bookingDate);
                
                console.log('💰 Расчет цены:', {
                    hallId,
                    date: bookingDate.toISOString().split('T')[0],
                    priceSetCode,
                    availablePriceSets: hall.priceSets ? Object.keys(hall.priceSets) : []
                });
                
                // Используем все доступные прайс-сеты
                let priceSet = null;
                if (hall.priceSets && hall.priceSets[priceSetCode]) {
                    priceSet = hall.priceSets[priceSetCode];
                    console.log('✅ Используется прайс-сет:', priceSetCode, priceSet);
                } else if (priceSetCode === 'december' && hall.december) {
                    priceSet = hall.december;
                    console.log('✅ Используется прайс-сет december (fallback)');
                } else if (hall.standard) {
                    priceSet = hall.standard;
                    console.log('⚠️ Используется прайс-сет standard (fallback), запрошен был:', priceSetCode);
                } else if (hall.priceSets && Object.keys(hall.priceSets).length > 0) {
                    // Fallback на первый доступный прайс-сет
                    const firstPriceSetCode = Object.keys(hall.priceSets)[0];
                    priceSet = Object.values(hall.priceSets)[0];
                    console.log('⚠️ Используется первый доступный прайс-сет:', firstPriceSetCode);
                }
                
                if (!priceSet) {
                    console.error('❌ Прайс для данного периода не найден');
                    return {
                        error: 'Прайс для данного периода не найден',
                        valid: false
                    };
                }
                
                // Определяем категорию дня (используем оригинальную функцию)
                const dayCategory = window.getDayCategoryWithDecemberRules ? 
                    window.getDayCategoryWithDecemberRules(bookingDate, startTime) : 'weekday';
                
                // Вычисляем часы (используем оригинальную функцию)
                const hours = window.PricingCalculator.calculateHours ? 
                    window.PricingCalculator.calculateHours(startTime, endTime) : 
                    calculateHours(startTime, endTime);
                
                if (hours < 2) {
                    return {
                        error: 'Минимальная аренда 2 часа',
                        valid: false
                    };
                }
                
                // Определяем базовую цену
                let basePrice;
                switch (dayCategory) {
                    case 'weekday':
                        // Используем разные цены в зависимости от времени начала
                        const [startHour, startMin] = startTime.split(':').map(Number);
                        if (priceSet.weekday_10_22 !== undefined || priceSet.weekday_22_00 !== undefined) {
                            // Используем новые поля с разделением по времени
                            if (startHour >= 22) {
                                basePrice = priceSet.weekday_22_00 || priceSet.weekday_price;
                            } else {
                                basePrice = priceSet.weekday_10_22 || priceSet.weekday_price;
                            }
                        } else {
                            // Используем старое поле для обратной совместимости
                            basePrice = priceSet.weekday_price;
                        }
                        break;
                    case 'fri_sat':
                        basePrice = priceSet.fri_sat_price;
                        break;
                    case 'sunday':
                        basePrice = priceSet.sunday_price;
                        break;
                    default:
                        basePrice = priceSet.weekday_price;
                }
                
                console.log('💰 Базовая цена определена:', {
                    dayCategory,
                    startTime,
                    basePrice,
                    weekday_10_22: priceSet.weekday_10_22,
                    weekday_22_00: priceSet.weekday_22_00,
                    weekday_price: priceSet.weekday_price
                });
                
                // Расчёт компонентов
                const baseCost = basePrice * hours;
                const cleaningCost = guestsCount <= 30 ? 
                    priceSet.cleaning_under_30 : 
                    priceSet.cleaning_over_30;
                
                const afterHoursFee = window.calculateAfterHoursFee ? 
                    window.calculateAfterHoursFee(dayCategory, startTime, endTime, priceSet.after_hours_rate) :
                    0;
                
                // Расчёт доп. услуг
                const extras = converted.extras || {};
                let extraServicesCost = 0;
                extraServices.forEach(serviceId => {
                    const service = extras[serviceId];
                    if (!service) return;
                    
                    if (service.type === 'fixed') {
                        extraServicesCost += service.price;
                    } else if (service.type === 'per_person' && service.per) {
                        const units = Math.ceil(guestsCount / service.per);
                        extraServicesCost += units * service.price;
                    }
                });
                
                const total = baseCost + cleaningCost + afterHoursFee + extraServicesCost;
                
                return {
                    valid: true,
                    base_price: basePrice,
                    hours: hours,
                    base_cost: baseCost,
                    cleaning_cost: cleaningCost,
                    after_hours_fee: afterHoursFee,
                    extra_services: extraServicesCost,
                    total: total,
                    details: {
                        day_category: dayCategory,
                        season: priceSetCode,
                        hall_name: hall.name || hallId,
                        warnings: []
                    },
                    breakdown: {
                        base: `${basePrice} руб/час × ${hours} ч = ${baseCost} руб`,
                        cleaning: `${cleaningCost} руб`,
                        after_hours: afterHoursFee > 0 ? `${afterHoursFee} руб` : '0 руб',
                        extra_services: extraServicesCost > 0 ? `${extraServicesCost} руб` : '0 руб',
                        total: `${total} руб`
                    }
                };
            }
            
            // Fallback на оригинальную функцию
            return originalCalculate(params);
        }
        
        function calculateHours(startTime, endTime) {
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            const [endHours, endMinutes] = endTime.split(':').map(Number);
            
            const start = new Date(1970, 0, 1, startHours, startMinutes || 0);
            let end = new Date(1970, 0, 1, endHours, endMinutes || 0);
            
            if (end < start) {
                end = new Date(1970, 0, 2, endHours, endMinutes || 0);
            }
            
            const diffMs = end - start;
            const diffHours = diffMs / (1000 * 60 * 60);
            
            return Math.max(2, diffHours);
        }
        
        // Обновляем экспорт калькулятора
        window.PricingCalculator = {
            ...window.PricingCalculator,
            calculate: calculateRentalPriceWrapper,
            getExtraServices: () => {
                const apiExtras = getExtraServicesFromAPI();
                return apiExtras && Object.keys(apiExtras).length > 0 ? apiExtras : originalGetExtraServices();
            },
            useAPI: true // Флаг использования API
        };
        
        console.log('Pricing calculator API integration initialized');
    }
    
    // Запускаем инициализацию
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApiCalculator);
    } else {
        initApiCalculator();
    }
})();

