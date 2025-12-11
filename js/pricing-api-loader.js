/**
 * Модуль загрузки данных о ценах из PHP API
 * Заменяет захардкоженные константы в pricing-calculator.js
 */

const PRICING_API_URL = '/api/pricing/halls-pricing';

let pricingDataCache = null;
let pricingDataPromise = null;

/**
 * Загрузка данных о ценах из API
 */
async function loadPricingData() {
    // Если уже загружаем, вернуть тот же промис
    if (pricingDataPromise) {
        return pricingDataPromise;
    }
    
    // Если есть кэш, вернуть его
    if (pricingDataCache) {
        return pricingDataCache;
    }
    
    pricingDataPromise = fetch(PRICING_API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            pricingDataCache = data;
            pricingDataPromise = null;
            return data;
        })
        .catch(error => {
            console.error('Error loading pricing data from API:', error);
            pricingDataPromise = null;
            // Fallback на захардкоженные данные
            return getFallbackData();
        });
    
    return pricingDataPromise;
}

/**
 * Получить данные о ценах (с кэшированием)
 */
async function getPricingData() {
    if (pricingDataCache) {
        return pricingDataCache;
    }
    return await loadPricingData();
}

/**
 * Конвертация данных из API в формат, совместимый с существующим калькулятором
 */
function convertApiDataToCalculatorFormat(apiData) {
    const halls = {};
    const extras = {};
    
    // Конвертация залов
    apiData.halls.forEach(hall => {
        halls[hall.code] = {
            name: hall.name,
            capacity: hall.capacity,
            // Для обратной совместимости создаем объекты standard и december
            standard: hall.prices.standard ? {
                weekday_price: hall.prices.standard.weekday || hall.prices.standard.weekday_10_22,
                weekday_10_22: hall.prices.standard.weekday_10_22 || hall.prices.standard.weekday,
                weekday_22_00: hall.prices.standard.weekday_22_00 || hall.prices.standard.weekday,
                fri_sat_price: hall.prices.standard.friSat,
                sunday_price: hall.prices.standard.sun,
                cleaning_under_30: hall.prices.standard.cleaningUpTo30,
                cleaning_over_30: hall.prices.standard.cleaningOver30,
                after_hours_rate: hall.prices.standard.afterHoursFee,
                min_hours: hall.prices.standard.minHours,
                min_hours_saturday: hall.prices.standard.minHoursSaturday || hall.prices.standard.minHours,
                food_alcohol_allowed: true
            } : null,
            december: hall.prices.december ? {
                weekday_price: hall.prices.december.weekday || hall.prices.december.weekday_10_22,
                weekday_10_22: hall.prices.december.weekday_10_22 || hall.prices.december.weekday,
                weekday_22_00: hall.prices.december.weekday_22_00 || hall.prices.december.weekday,
                fri_sat_price: hall.prices.december.friSat,
                sunday_price: hall.prices.december.sun,
                cleaning_under_30: hall.prices.december.cleaningUpTo30,
                cleaning_over_30: hall.prices.december.cleaningOver30,
                after_hours_rate: hall.prices.december.afterHoursFee,
                min_hours: hall.prices.december.minHours,
                min_hours_saturday: hall.prices.december.minHoursSaturday || hall.prices.december.minHours,
                food_alcohol_allowed: true
            } : null
        };
    });
    
    // Конвертация дополнительных услуг
    // Сохраняем все прайс-сеты, выбор будет происходить динамически при расчете
    Object.entries(apiData.extras || {}).forEach(([code, extra]) => {
        // Сохраняем все прайс-сеты для этой услуги
        extras[code] = {
            name: extra.name,
            pricingType: extra.pricingType,
            priceSets: extra.priceSets || {}
        };
        
        // Для обратной совместимости используем standard как fallback
        const standardPrice = extra.priceSets?.standard;
        
        if (!standardPrice && Object.keys(extra.priceSets || {}).length === 0) return;
        
        if (extra.pricingType === 'fixed' && standardPrice) {
            const basePrice = standardPrice.basePrice != null ? parseFloat(standardPrice.basePrice) : 0;
            if (basePrice > 0) {
                extras[code] = {
                    name: extra.name,
                    price: basePrice,
                    type: 'fixed'
                };
            }
        } else if (extra.pricingType === 'per_unit') {
            // Для per_unit нужно определить per (например, из unitDescription "за каждые 10 человек")
            const unitDesc = (standardPrice.unitDescription || '').toLowerCase();
            
            // Проверяем, не является ли это на самом деле fixed услугой
            // "за бокал", "за штуку" и т.п. должны быть fixed
            if (unitDesc.includes('бокал') || 
                unitDesc.includes('за штуку') || 
                unitDesc.includes('за единицу') ||
                unitDesc.includes('за экземпляр') ||
                (!unitDesc.includes('человек') && !unitDesc.includes('чел'))) {
                // Обрабатываем как fixed
                const basePrice = standardPrice.basePrice != null ? parseFloat(standardPrice.basePrice) : 0;
                if (basePrice > 0) {
                    extras[code] = {
                        name: extra.name,
                        price: basePrice,
                        type: 'fixed'
                    };
                }
                return;
            }
            
            // Ищем число в описании, которое относится к количеству людей
            // Ищем паттерны: "за каждые N человек", "за N человек", "+ N чел", "по N человек" и т.д.
            // НЕ берем число, если перед ним есть "руб", "₽", "цена" и т.д.
            let perMatch = null;
            const unitDesc = standardPrice.unitDescription || '';
            
            // Вариант 1: Ищем число перед словами "человек" или "чел"
            // Это самый надежный способ - число должно быть непосредственно перед словом о людях
            perMatch = unitDesc.match(/(\d+)\s*(?:человек|чел)/i);
            
            // Вариант 2: Если не нашли, ищем паттерн "за каждые N" или "+ N"
            if (!perMatch) {
                perMatch = unitDesc.match(/(?:за\s+каждые|за|по|\+)\s*(\d+)/i);
            }
            
            // Вариант 3: Если все еще не нашли, ищем любое число, но НЕ если перед ним цена
            if (!perMatch) {
                // Исключаем числа, которые идут после слов о цене
                const pricePattern = /(?:руб|₽|цена|стоимость|price)\s*(\d+)/i;
                const priceMatch = unitDesc.match(pricePattern);
                
                // Если есть паттерн с ценой, ищем число в другой части строки
                if (priceMatch) {
                    // Убираем часть с ценой и ищем число в остатке
                    const withoutPrice = unitDesc.replace(pricePattern, '');
                    perMatch = withoutPrice.match(/(\d+)/);
                } else {
                    // Если нет паттерна с ценой, берем первое число
                    perMatch = unitDesc.match(/(\d+)/);
                }
            }
            
            const basePrice = standardPrice.basePrice != null ? parseFloat(standardPrice.basePrice) : 0;
            
            if (!perMatch) {
                // Если не нашли число, но это per_unit для людей - по умолчанию per = 1
                console.warn(`Не найдено число для per_unit услуги ${code} в описании "${unitDesc}", используем per=1`);
                if (basePrice > 0) {
                    extras[code] = {
                        name: extra.name,
                        price: basePrice,
                        per: 1,
                        type: 'per_person'
                    };
                }
                return;
            }
            
            const per = parseInt(perMatch[1]);
            
            // Логируем для отладки
            console.log(`Услуга ${code}: из описания "${unitDesc}" извлечено per=${per}`);
            
            if (basePrice > 0) {
                extras[code] = {
                    name: extra.name,
                    price: basePrice,
                    per: per,
                    type: 'per_person'
                };
            }
        } else if (extra.pricingType === 'complex') {
            // Для complex создаем hookah_1 и hookah_2
            if (code === 'hookah' && standardPrice) {
                const basePrice = standardPrice.basePrice != null ? parseFloat(standardPrice.basePrice) : 0;
                const additionalPrice = standardPrice.additionalUnitPrice != null ? parseFloat(standardPrice.additionalUnitPrice) : null;
                
                if (basePrice > 0) {
                    extras['hookah_1'] = {
                        name: `${extra.name} (первый)`,
                        price: basePrice,
                        type: 'fixed'
                    };
                }
                
                if (additionalPrice != null && additionalPrice > 0) {
                    extras['hookah_2'] = {
                        name: `${extra.name} (второй)`,
                        price: additionalPrice,
                        type: 'fixed'
                    };
                }
            } else if (standardPrice) {
                const basePrice = standardPrice.basePrice != null ? parseFloat(standardPrice.basePrice) : 0;
                if (basePrice > 0) {
                    extras[code] = {
                        name: extra.name,
                        price: basePrice,
                        type: 'fixed'
                    };
                }
            }
        }
    });
    
    return {
        halls,
        extras,
        seasonRules: apiData.seasonRules || []
    };
}

/**
 * Определение прайс-сета по дате и правилам сезонности
 */
function getPriceSetForDate(date, seasonRules) {
    if (!seasonRules || seasonRules.length === 0) {
        return 'standard'; // По умолчанию
    }
    
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    // Фильтруем правила, которые подходят для этой даты
    const matchingRules = seasonRules.filter(rule => {
        if (dateStr < rule.startDate || dateStr > rule.endDate) {
            return false;
        }
        
        if (!rule.daysOfWeek.includes(dayOfWeek)) {
            return false;
        }
        
        return true;
    });
    
    if (matchingRules.length === 0) {
        return 'standard';
    }
    
    // Выбираем правило с максимальным приоритетом
    const bestRule = matchingRules.reduce((best, current) => {
        return current.priority > best.priority ? current : best;
    });
    
    return bestRule.priceSetCode;
}

/**
 * Fallback данные (на случай если API недоступен)
 */
function getFallbackData() {
    // Вернуть пустой объект - калькулятор использует захардкоженные данные
    return {
        halls: [],
        extras: {},
        seasonRules: []
    };
}

/**
 * Инициализация модуля
 */
async function initPricingApiLoader() {
    try {
        const apiData = await loadPricingData();
        
        if (apiData && apiData.halls && apiData.halls.length > 0) {
            const convertedData = convertApiDataToCalculatorFormat(apiData);
            
            // Сохраняем API данные для использования
            if (typeof window !== 'undefined') {
                window.PricingDataAPI = {
                    raw: apiData,
                    converted: convertedData,
                    getPriceSetForDate: (date) => getPriceSetForDate(date, apiData.seasonRules),
                    isLoaded: true
                };
                
                // Обновляем калькулятор, если он уже загружен
                if (window.PricingCalculator && window.PricingCalculator.updateFromAPI) {
                    window.PricingCalculator.updateFromAPI({ converted: convertedData });
                }
            }
            
            return convertedData;
        } else {
            console.warn('No pricing data received from API, using fallback');
            return getFallbackData();
        }
    } catch (error) {
        console.error('Failed to initialize pricing API loader:', error);
        return getFallbackData();
    }
}

// Экспорт
if (typeof window !== 'undefined') {
    window.PricingApiLoader = {
        load: loadPricingData,
        get: getPricingData,
        convert: convertApiDataToCalculatorFormat,
        getPriceSetForDate,
        init: initPricingApiLoader
    };
}

// Автоматическая инициализация при загрузке
if (typeof window !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPricingApiLoader);
} else if (typeof window !== 'undefined') {
    initPricingApiLoader();
}

