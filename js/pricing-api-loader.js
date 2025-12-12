/**
 * Модуль загрузки данных о ценах из PHP API
 * Заменяет захардкоженные константы в pricing-calculator.js
 */

const PRICING_API_URL = '/api/pricing/halls-pricing';

let pricingDataCache = null;
let pricingDataPromise = null;

// Функция для очистки кэша (для отладки)
if (typeof window !== 'undefined') {
    window.clearPricingCache = function() {
        pricingDataCache = null;
        pricingDataPromise = null;
        console.log('Кэш данных о ценах очищен');
    };
}

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
    
    // Конвертация залов - сохраняем ВСЕ прайс-сеты
    apiData.halls.forEach(hall => {
        const priceSets = {};
        
        // Обрабатываем все прайс-сеты из API
        Object.entries(hall.prices || {}).forEach(([priceSetCode, priceData]) => {
            priceSets[priceSetCode] = {
                weekday_price: priceData.weekday || priceData.weekday_10_22,
                weekday_10_22: priceData.weekday_10_22 || priceData.weekday,
                weekday_22_00: priceData.weekday_22_00 || priceData.weekday,
                fri_sat_price: priceData.friSat,
                sunday_price: priceData.sun,
                cleaning_under_30: priceData.cleaningUpTo30,
                cleaning_over_30: priceData.cleaningOver30,
                after_hours_rate: priceData.afterHoursFee,
                min_hours: priceData.minHours,
                min_hours_saturday: priceData.minHoursSaturday || priceData.minHours,
                food_alcohol_allowed: true
            };
        });
        
        halls[hall.code] = {
            name: hall.name,
            capacity: hall.capacity,
            // Сохраняем все прайс-сеты
            priceSets: priceSets,
            // Для обратной совместимости оставляем standard и december
            standard: priceSets.standard || null,
            december: priceSets.december || null
        };
    });
    
    // Конвертация дополнительных услуг
    // Сохраняем все прайс-сеты, выбор будет происходить динамически при расчете
    console.log('📦 Начало обработки доп. услуг из API. Всего услуг:', Object.keys(apiData.extras || {}).length);
    console.log('📦 Коды всех услуг из API:', Object.keys(apiData.extras || {}));
    Object.entries(apiData.extras || {}).forEach(([code, extra]) => {
        console.log(`🔍 Обработка услуги: ${code} (${extra.name}), тип: ${extra.pricingType}`);
        
        // Специальная проверка для услуги "Стул"
        if (code === 'styl' || extra.name === 'Стул' || extra.name === 'стул') {
            console.log('🎯 ОБНАРУЖЕНА УСЛУГА СТУЛ! Детали:', { code, extra, priceSets: extra.priceSets });
        }
        
        // Проверяем, что есть хотя бы один прайс-сет с ценой
        const priceSets = extra.priceSets || {};
        console.log(`  Прайс-сеты:`, Object.keys(priceSets));
        
        const hasAnyPrice = Object.values(priceSets).some(priceSet => {
            const basePrice = priceSet?.basePrice != null ? parseFloat(priceSet.basePrice) : 0;
            const additionalPrice = priceSet?.additionalUnitPrice != null ? parseFloat(priceSet.additionalUnitPrice) : 0;
            const hasPrice = basePrice > 0 || additionalPrice > 0;
            if (hasPrice) {
                console.log(`  ✅ Найдена цена в прайс-сете: basePrice=${basePrice}, additionalPrice=${additionalPrice}`);
            }
            return hasPrice;
        });
        
        if (!hasAnyPrice) {
            console.warn(`❌ Услуга ${code} (${extra.name}) не имеет цен ни в одном прайс-сете, пропускаем`);
            console.warn(`  Доступные прайс-сеты:`, Object.keys(priceSets));
            Object.entries(priceSets).forEach(([psCode, ps]) => {
                console.warn(`    ${psCode}: basePrice=${ps?.basePrice}, additionalUnitPrice=${ps?.additionalUnitPrice}`);
            });
            return;
        }
        
        // Ищем прайс-сет с ценой (приоритет: standard, затем первый доступный с ценой)
        let selectedPriceSet = null;
        let selectedPriceSetKey = null;
        
        // Сначала пробуем найти 'standard'
        if (priceSets.standard) {
            const basePrice = priceSets.standard.basePrice != null ? parseFloat(priceSets.standard.basePrice) : 0;
            if (basePrice > 0) {
                selectedPriceSet = priceSets.standard;
                selectedPriceSetKey = 'standard';
                console.log(`  ✅ Найден прайс-сет 'standard' с ценой ${basePrice}`);
            }
        }
        
        // Если standard не подошел, ищем первый доступный прайс-сет с ценой > 0
        if (!selectedPriceSet) {
            for (const [psKey, ps] of Object.entries(priceSets)) {
                const basePrice = ps?.basePrice != null ? parseFloat(ps.basePrice) : 0;
                if (basePrice > 0) {
                    selectedPriceSet = ps;
                    selectedPriceSetKey = psKey;
                    console.log(`  ✅ Найден прайс-сет '${psKey}' с ценой ${basePrice} (используем вместо standard)`);
                    break;
                }
            }
        }
        
        if (!selectedPriceSet) {
            console.warn(`❌ Услуга ${code} (${extra.name}) не имеет цен в прайс-сетах, пропускаем`);
            console.warn(`  Доступные прайс-сеты:`, Object.keys(priceSets));
            Object.entries(priceSets).forEach(([psCode, ps]) => {
                console.warn(`    ${psCode}: basePrice=${ps?.basePrice}, additionalUnitPrice=${ps?.additionalUnitPrice}`);
            });
            return;
        }
        
        console.log(`  Используем прайс-сет '${selectedPriceSetKey}' для конвертации:`, selectedPriceSet);
        
        // Обработка fixed услуг
        if (extra.pricingType === 'fixed') {
            if (!selectedPriceSet) {
                console.warn(`⚠️ Услуга ${code} (${extra.name}) типа 'fixed' не имеет выбранного прайс-сета`);
                return;
            }
            
            const basePrice = selectedPriceSet.basePrice != null ? parseFloat(selectedPriceSet.basePrice) : 0;
            console.log(`  Проверка fixed услуги ${code}: basePrice=${basePrice}, selectedPriceSet=`, selectedPriceSet);
            
            if (basePrice > 0) {
                extras[code] = {
                    name: extra.name,
                    price: basePrice,
                    type: 'fixed'
                };
                console.log(`✅ Услуга ${code} (${extra.name}) добавлена: цена ${basePrice} руб из прайс-сета '${selectedPriceSetKey}'`);
            } else {
                console.warn(`⚠️ Услуга ${code} (${extra.name}) пропущена: цена = ${basePrice} (должна быть > 0) в прайс-сете '${selectedPriceSetKey}'`);
            }
        } else if (extra.pricingType === 'per_unit') {
            // Для per_unit нужно определить per (например, из unitDescription "за каждые 10 человек")
            const unitDesc = (selectedPriceSet.unitDescription || '').toLowerCase();
            
            // Проверяем, не является ли это на самом деле fixed услугой
            // "за бокал", "за штуку" и т.п. должны быть fixed
            if (unitDesc.includes('бокал') || 
                unitDesc.includes('за штуку') || 
                unitDesc.includes('за единицу') ||
                unitDesc.includes('за экземпляр') ||
                (!unitDesc.includes('человек') && !unitDesc.includes('чел'))) {
                // Обрабатываем как fixed
                const basePrice = selectedPriceSet.basePrice != null ? parseFloat(selectedPriceSet.basePrice) : 0;
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
            // unitDesc уже объявлена выше, используем её
            
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
            
            const basePrice = selectedPriceSet.basePrice != null ? parseFloat(selectedPriceSet.basePrice) : 0;
            
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
            if (code === 'hookah' && selectedPriceSet) {
                const basePrice = selectedPriceSet.basePrice != null ? parseFloat(selectedPriceSet.basePrice) : 0;
                const additionalPrice = selectedPriceSet.additionalUnitPrice != null ? parseFloat(selectedPriceSet.additionalUnitPrice) : null;
                
                if (basePrice > 0) {
                    extras['hookah_1'] = {
                        name: `${extra.name} (первый)`,
                        price: basePrice,
                        type: 'fixed'
                    };
                    console.log(`✅ Услуга hookah_1 добавлена: цена ${basePrice} руб из прайс-сета '${selectedPriceSetKey}'`);
                }
                
                if (additionalPrice != null && additionalPrice > 0) {
                    extras['hookah_2'] = {
                        name: `${extra.name} (второй)`,
                        price: additionalPrice,
                        type: 'fixed'
                    };
                    console.log(`✅ Услуга hookah_2 добавлена: цена ${additionalPrice} руб из прайс-сета '${selectedPriceSetKey}'`);
                }
            } else if (selectedPriceSet) {
                const basePrice = selectedPriceSet.basePrice != null ? parseFloat(selectedPriceSet.basePrice) : 0;
                if (basePrice > 0) {
                    extras[code] = {
                        name: extra.name,
                        price: basePrice,
                        type: 'fixed'
                    };
                    console.log(`✅ Услуга ${code} (${extra.name}) добавлена: цена ${basePrice} руб из прайс-сета '${selectedPriceSetKey}'`);
                }
            }
        } else {
            // Неизвестный тип ценообразования
            console.warn(`⚠️ Услуга ${code} (${extra.name}) имеет неизвестный тип ценообразования: ${extra.pricingType}`);
            // Пытаемся обработать как fixed, если есть цена
            if (selectedPriceSet) {
                const basePrice = selectedPriceSet.basePrice != null ? parseFloat(selectedPriceSet.basePrice) : 0;
                if (basePrice > 0) {
                    extras[code] = {
                        name: extra.name,
                        price: basePrice,
                        type: 'fixed'
                    };
                    console.log(`✅ Услуга ${code} (${extra.name}) добавлена как fixed (fallback): цена ${basePrice} руб`);
                }
            }
        }
    });
    
    console.log('📦 Обработка доп. услуг завершена. Итого обработано услуг:', Object.keys(extras).length);
    console.log('📦 Коды обработанных услуг:', Object.keys(extras));
    console.log('📦 Детали всех обработанных услуг:', extras);
    
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
        console.log('🔍 getPriceSetForDate: нет сезонных правил, возвращаю standard');
        return 'standard'; // По умолчанию
    }
    
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    console.log('🔍 getPriceSetForDate:', { date: dateStr, dayOfWeek, seasonRulesCount: seasonRules.length });
    
    // Фильтруем правила, которые подходят для этой даты
    const matchingRules = seasonRules.filter(rule => {
        const dateMatch = dateStr >= rule.startDate && dateStr <= rule.endDate;
        const dayMatch = rule.daysOfWeek && rule.daysOfWeek.includes(dayOfWeek);
        
        console.log(`  Проверка правила ${rule.priceSetCode}:`, {
            startDate: rule.startDate,
            endDate: rule.endDate,
            dateStr,
            dateMatch,
            dayOfWeek,
            ruleDays: rule.daysOfWeek,
            dayMatch
        });
        
        return dateMatch && dayMatch;
    });
    
    console.log('🔍 Подходящие правила:', matchingRules.length, matchingRules);
    
    if (matchingRules.length === 0) {
        console.log('🔍 Нет подходящих правил, возвращаю standard');
        return 'standard';
    }
    
    // Выбираем правило с максимальным приоритетом
    const bestRule = matchingRules.reduce((best, current) => {
        return current.priority > best.priority ? current : best;
    });
    
    console.log('🔍 Выбранное правило:', bestRule, 'код прайс-сета:', bestRule.priceSetCode);
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
            console.log('📊 Данные из API загружены:', {
                hallsCount: apiData.halls.length,
                seasonRulesCount: apiData.seasonRules?.length || 0,
                seasonRules: apiData.seasonRules
            });
            
            const convertedData = convertApiDataToCalculatorFormat(apiData);
            
            // Выводим информацию о доступных прайс-сетах для каждого зала
            Object.entries(convertedData.halls || {}).forEach(([hallCode, hall]) => {
                console.log(`🏛️ Зал ${hallCode} (${hall.name}):`, {
                    availablePriceSets: hall.priceSets ? Object.keys(hall.priceSets) : [],
                    priceSetsDetails: hall.priceSets
                });
            });
            
            // Сохраняем API данные для использования
            if (typeof window !== 'undefined') {
                window.PricingDataAPI = {
                    raw: apiData,
                    converted: convertedData,
                    getPriceSetForDate: (date) => {
                        const result = getPriceSetForDate(date, apiData.seasonRules);
                        console.log('🔍 getPriceSetForDate вызвана:', { date, result });
                        return result;
                    },
                    isLoaded: true
                };
                
                // Функция для очистки кэша (для отладки)
                window.PricingDataAPI.clearCache = function() {
                    pricingDataCache = null;
                    pricingDataPromise = null;
                    console.log('Кэш очищен, перезагрузите страницу');
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

