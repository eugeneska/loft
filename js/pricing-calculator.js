/**
 * Модуль автоматического расчёта стоимости аренды залов
 * Поддерживает стандартные и декабрьские тарифы
 */

// ============================================
// ПРАЙС-ЛИСТЫ
// ============================================

// Функция обновления данных из API (вызывается из pricing-api-loader.js)
function updatePricingDataFromAPI(apiData) {
    if (!apiData || !apiData.converted) return;
    
    const converted = apiData.converted;
    
    // Обновляем STANDARD_PRICES и DECEMBER_PRICES
    if (converted.halls) {
        Object.keys(converted.halls).forEach(hallCode => {
            const hall = converted.halls[hallCode];
            if (hall.standard) {
                if (!STANDARD_PRICES[hallCode]) {
                    STANDARD_PRICES[hallCode] = {};
                }
                Object.assign(STANDARD_PRICES[hallCode], {
                    name: hall.name,
                    ...hall.standard
                });
            }
            if (hall.december) {
                if (!DECEMBER_PRICES[hallCode]) {
                    DECEMBER_PRICES[hallCode] = {};
                }
                Object.assign(DECEMBER_PRICES[hallCode], {
                    name: hall.name,
                    ...hall.december
                });
            }
        });
    }
    
    // Обновляем EXTRA_SERVICES
    if (converted.extras && Object.keys(converted.extras).length > 0) {
        // Полностью очищаем EXTRA_SERVICES перед добавлением данных из API
        // API - это источник истины, захардкоженные данные используются только как fallback
        Object.keys(EXTRA_SERVICES).forEach(key => {
            delete EXTRA_SERVICES[key];
        });
        
        // Добавляем услуги из API
        Object.keys(converted.extras).forEach(extraCode => {
            const extra = converted.extras[extraCode];
            // Добавляем только если у услуги есть валидная цена
            if (extra && extra.price != null && extra.price !== undefined && !isNaN(extra.price) && extra.price > 0) {
                EXTRA_SERVICES[extraCode] = extra;
            }
        });
        
        console.log('EXTRA_SERVICES полностью заменены данными из API:', Object.keys(EXTRA_SERVICES));
    } else {
        console.log('Нет данных из API для доп. услуг, используем захардкоженные');
    }
    
    console.log('Pricing data updated from API');
}

// Стандартный прайс-лист 2025 (может быть обновлен из API)
const STANDARD_PRICES = {
    'armaloft': {
        name: 'Арма Лофт студия 1',
        weekday_price: 3500,        // Пн с 8-00 до Пт 17-00
        weekday_10_22: 3500,        // Пн с 8-00 до Пт 17-00
        weekday_22_00: 3500,        // Пн с 8-00 до Пт 17-00
        fri_sat_price: 4500,        // Пт 17-00 до Вс 8-00
        sunday_price: 3500,         // Вс 8-00 до Пн 8-00
        cleaning_under_30: 1500,    // Уборка до 30 чел
        cleaning_over_30: 2000,     // Уборка свыше 30 чел
        after_hours_rate: 400,      // Наценка за ночное время 22:00-10:00 (руб/час)
        food_alcohol_allowed: true  // Бронирование с едой/алкоголем разрешено
    },
    'merkuri': {
        name: 'Меркури',
        weekday_price: 2000,
        fri_sat_price: 2800,
        sunday_price: 2500,
        cleaning_under_30: 1200,
        cleaning_over_30: 1800,
        after_hours_rate: 500,
        food_alcohol_allowed: true
    },
    'pulka': {
        name: 'Пулька',
        weekday_price: 1500,
        fri_sat_price: 2000,
        sunday_price: 1800,
        cleaning_under_30: 1000,
        cleaning_over_30: 1500,
        after_hours_rate: 500,
        food_alcohol_allowed: true  // Только при аренде от 2 часов
    },
    'rufer': {
        name: 'Руфер',
        weekday_price: 1800,
        fri_sat_price: 2400,
        sunday_price: 2200,
        cleaning_under_30: 1100,
        cleaning_over_30: 1600,
        after_hours_rate: 500,
        food_alcohol_allowed: true  // Только при аренде от 2 часов
    },
    'samolet': {
        name: 'Самолёт',
        weekday_price: 1600,
        fri_sat_price: 2100,
        sunday_price: 1900,
        cleaning_under_30: 1050,
        cleaning_over_30: 1550,
        after_hours_rate: 500,
        food_alcohol_allowed: true  // Только при аренде от 2 часов
    }
};

// Декабрьский прайс-лист 2025
const DECEMBER_PRICES = {
    'armaloft': {
        name: 'Арма Лофт студия 1',
        weekday_price: 3500,        // Пн с 8-00 до Пт 17-00
        weekday_10_22: 3500,        // Пн с 8-00 до Пт 17-00
        weekday_22_00: 3500,        // Пн с 8-00 до Пт 17-00
        fri_sat_price: 4500,        // Пт 17-00 до Вс 8-00
        sunday_price: 3500,         // Вс 8-00 до Пн 8-00
        cleaning_under_30: 1500,
        cleaning_over_30: 2000,
        after_hours_rate: 400,      // Наценка за ночное время 22:00-10:00 (руб/час)
        food_alcohol_allowed: true
    },
    'merkuri': {
        name: 'Меркури',
        weekday_price: 2000,        // Пн-Вт
        fri_sat_price: 3200,        // Ср-Чт-Пт-Сб-Вс
        sunday_price: 2800,
        cleaning_under_30: 1200,
        cleaning_over_30: 1800,
        after_hours_rate: 400,
        food_alcohol_allowed: true
    },
    'pulka': {
        name: 'Пулька',
        weekday_price: 1500,        // Пн-Вт
        fri_sat_price: 2300,        // Ср-Чт-Пт-Сб-Вс
        sunday_price: 2100,
        cleaning_under_30: 1000,
        cleaning_over_30: 1500,
        after_hours_rate: 400,
        food_alcohol_allowed: true
    },
    'rufer': {
        name: 'Руфер',
        weekday_price: 1800,        // Пн-Вт
        fri_sat_price: 2700,        // Ср-Чт-Пт-Сб-Вс
        sunday_price: 2500,
        cleaning_under_30: 1100,
        cleaning_over_30: 1600,
        after_hours_rate: 400,
        food_alcohol_allowed: true
    },
    'samolet': {
        name: 'Самолёт',
        weekday_price: 1600,        // Пн-Вт
        fri_sat_price: 2400,        // Ср-Чт-Пт-Сб-Вс
        sunday_price: 2200,
        cleaning_under_30: 1050,
        cleaning_over_30: 1550,
        after_hours_rate: 400,
        food_alcohol_allowed: true
    }
};

// Дополнительные услуги
const EXTRA_SERVICES = {
    'servicing': {
        name: 'Сервировка / посуда',
        price: 1000,
        per: 10,  // за каждые 10 человек
        type: 'per_person'
    },
    'hookah_1': {
        name: 'Кальян (первый)',
        price: 2500,
        type: 'fixed'
    },
    'hookah_2': {
        name: 'Кальян (второй)',
        price: 2200,
        type: 'fixed'
    },
    'ice': {
        name: 'Лёд',
        price: 350,
        type: 'fixed'
    },
    'freezer': {
        name: 'Морозилка',
        price: 1000,
        type: 'fixed'
    },
    'glass_breaking': {
        name: 'Бой бокала',
        price: 500,
        type: 'fixed'
    },
    'pylon_installation': {
        name: 'Установка пилона',
        price: 1000,
        type: 'fixed'
    },
    'furniture_move': {
        name: 'Перенос мебели',
        price: 2000,
        type: 'fixed'
    }
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Определяет категорию дня с учетом перехода в 8:00
 * Правила: Пн 8:00-Пт 17:00 = weekday, Пт 17:00-Вс 8:00 = fri_sat, Вс 8:00-Пн 8:00 = sunday
 * @param {Date} date - Дата
 * @returns {string} 'weekday' | 'fri_sat' | 'sunday'
 */
function getDayCategory(date) {
    const dayOfWeek = date.getDay(); // 0=воскресенье, 1=понедельник, ..., 6=суббота
    const hour = date.getHours();
    
    // Воскресенье с 8:00 до понедельника 8:00
    if (dayOfWeek === 0 && hour >= 8) {
        return 'sunday';
    }
    if (dayOfWeek === 1 && hour < 8) {
        return 'sunday';
    }
    
    // Пятница с 17:00, суббота весь день, воскресенье до 8:00 -> fri_sat
    if (dayOfWeek === 5 && hour >= 17) {
        return 'fri_sat';
    }
    if (dayOfWeek === 6) {
        return 'fri_sat';
    }
    if (dayOfWeek === 0 && hour < 8) {
        return 'fri_sat';
    }
    
    // Все остальное - будни (Пн с 8:00 до Пт 17:00)
    return 'weekday';
}

/**
 * Проверяет, является ли дата декабрем
 * @param {Date} date - Дата
 * @returns {boolean}
 */
function isDecember(date) {
    return date.getMonth() === 11; // 11 = декабрь
}

/**
 * Проверяет, входит ли дата в период 1-7 декабря (обычные цены)
 * @param {Date} date - Дата
 * @returns {boolean}
 */
function isEarlyDecember(date) {
    if (!isDecember(date)) return false;
    const day = date.getDate();
    return day >= 1 && day <= 7;
}

/**
 * Определяет, какой прайс использовать
 * @param {Date} date - Дата
 * @returns {string} 'standard' | 'december' | и т.д.
 */
function getPricingSeason(date) {
    // Если есть данные из API, используем сезонные правила
    if (window.PricingDataAPI && window.PricingDataAPI.isLoaded) {
        try {
            const priceSetCode = window.PricingDataAPI.getPriceSetForDate(date);
            return priceSetCode || 'standard';
        } catch (e) {
            console.warn('Error getting price set from API rules:', e);
        }
    }
    
    // Fallback на старую логику
    if (isDecember(date) && !isEarlyDecember(date)) {
        return 'december';
    }
    return 'standard';
}

/**
 * Получает прайс для зала в зависимости от сезона
 * @param {string} hallId - ID зала
 * @param {Date} date - Дата
 * @returns {Object} Прайс зала
 */
function getHallPricing(hallId, date) {
    const season = getPricingSeason(date);
    
    // Если есть данные из API, используем их
    if (window.PricingDataAPI && window.PricingDataAPI.isLoaded && window.PricingDataAPI.converted) {
        const hall = window.PricingDataAPI.converted.halls[hallId];
        if (hall) {
            // Используем прайс для нужного сезона
            const priceSet = season === 'december' ? hall.december : hall.standard;
            if (priceSet) {
                return {
                    ...priceSet,
                    name: hall.name
                };
            }
        }
    }
    
    // Fallback на захардкоженные данные
    const prices = season === 'december' ? DECEMBER_PRICES : STANDARD_PRICES;
    return prices[hallId] || null;
}

/**
 * Определяет категорию дня с учетом декабрьских правил и переходов в 8:00
 * @param {Date} date - Дата начала бронирования
 * @param {string} startTime - Время начала (HH:MM)
 * @returns {string} 'weekday' | 'fri_sat' | 'sunday'
 */
function getDayCategoryWithDecemberRules(date, startTime) {
    // Для декабря: Пн-Вт используют weekday_price, остальные дни - fri_sat_price/sunday_price
    if (isDecember(date) && !isEarlyDecember(date)) {
        const [hours, minutes] = startTime.split(':').map(Number);
        const dayOfWeek = date.getDay();
        
        // Если время до 8:00, считаем что это предыдущий день
        let effectiveDay = dayOfWeek;
        if (hours < 8) {
            effectiveDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        }
        
        // Воскресенье декабря
        if (effectiveDay === 0 || (dayOfWeek === 1 && hours < 8)) {
            return 'sunday';
        }
        
        // Понедельник и вторник декабря - используем weekday_price
        if (effectiveDay === 1 || effectiveDay === 2) {
            return 'weekday';
        }
        
        // Остальные дни декабря (Ср-Чт-Пт-Сб) - используем fri_sat_price
        return 'fri_sat';
    }
    
    // Для стандартного периода используем обычную логику с переходами в 8:00
    const dateWithTime = new Date(date);
    const [hours, minutes] = startTime.split(':').map(Number);
    dateWithTime.setHours(hours, minutes || 0, 0, 0);
    
    return getDayCategory(dateWithTime);
}

/**
 * Вычисляет количество часов аренды
 * @param {string} startTime - Время начала (HH:MM)
 * @param {string} endTime - Время окончания (HH:MM)
 * @returns {number} Количество часов
 */
function calculateHours(startTime, endTime) {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const start = new Date(1970, 0, 1, startHours, startMinutes || 0);
    let end = new Date(1970, 0, 1, endHours, endMinutes || 0);
    
    // Если время окончания меньше времени начала, значит это следующий день
    if (end < start) {
        end = new Date(1970, 0, 2, endHours, endMinutes || 0);
    }
    
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return Math.max(2, diffHours); // Минимум 2 часа
}

/**
 * Вычисляет доплату за ночное время (22:00-10:00) для любого дня недели
 * @param {string} dayCategory - Категория дня
 * @param {string} startTime - Время начала (HH:MM)
 * @param {string} endTime - Время окончания (HH:MM)
 * @param {number} afterHoursRate - Ставка за ночной час (400р)
 * @returns {number} Доплата в рублях
 */
function calculateAfterHoursFee(dayCategory, startTime, endTime, afterHoursRate) {
    // Ночная наценка применяется к любому дню недели
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startDecimal = startHours + startMinutes / 60;
    let endDecimal = endHours + endMinutes / 60;
    
    // Если время окончания меньше времени начала, значит это следующий день
    if (endDecimal <= startDecimal) {
        endDecimal += 24;
    }
    
    let nightHours = 0;
    
    // Итерируем по каждому часу бронирования
    for (let hour = startDecimal; hour < endDecimal; hour += 1) {
        const currentHour = hour % 24;
        // Ночной период: с 22:00 до 10:00 (22, 23, 0, 1, 2, ..., 9)
        if (currentHour >= 22 || currentHour < 10) {
            // Определяем, сколько часов из этого часа попадает в бронирование
            const hourStart = Math.max(hour, startDecimal);
            const hourEnd = Math.min(hour + 1, endDecimal);
            const hoursInPeriod = Math.max(0, hourEnd - hourStart);
            nightHours += hoursInPeriod;
        }
    }
    
    return Math.max(0, nightHours) * afterHoursRate;
}

/**
 * Вычисляет стоимость уборки
 * @param {number} guestsCount - Количество гостей
 * @param {number} cleaningUnder30 - Стоимость уборки до 30 чел
 * @param {number} cleaningOver30 - Стоимость уборки свыше 30 чел
 * @returns {number} Стоимость уборки
 */
function calculateCleaningCost(guestsCount, cleaningUnder30, cleaningOver30) {
    return guestsCount <= 30 ? cleaningUnder30 : cleaningOver30;
}

/**
 * Вычисляет стоимость дополнительных услуг
 * @param {Array<string>} selectedServices - Массив ID выбранных услуг
 * @param {number} guestsCount - Количество гостей
 * @returns {number} Общая стоимость доп. услуг
 */
function calculateExtraServicesCost(selectedServices, guestsCount) {
    let total = 0;
    
    selectedServices.forEach(serviceId => {
        const service = EXTRA_SERVICES[serviceId];
        if (!service) return;
        
        if (service.type === 'fixed') {
            total += service.price;
        } else if (service.type === 'per_person' && service.per) {
            // Сервировка: 1000 руб за каждые 10 человек
            const units = Math.ceil(guestsCount / service.per);
            total += units * service.price;
        }
    });
    
    return total;
}

/**
 * Валидация бронирования с едой/алкоголем
 * @param {string} hallId - ID зала
 * @param {number} hours - Количество часов
 * @returns {Object} {valid: boolean, message: string}
 */
function validateFoodAlcohol(hallId, hours) {
    const hallsRequire2Hours = ['pulka', 'rufer', 'samolet'];
    
    if (hallsRequire2Hours.includes(hallId) && hours < 2) {
        return {
            valid: false,
            message: 'Бронирование с едой/алкоголем разрешено только при аренде от 2 часов'
        };
    }
    
    return { valid: true, message: '' };
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ РАСЧЁТА
// ============================================

/**
 * Основная функция расчёта стоимости аренды
 * @param {Object} params - Параметры бронирования
 * @param {string} params.hallId - ID зала
 * @param {string} params.date - Дата (YYYY-MM-DD)
 * @param {string} params.startTime - Время начала (HH:MM)
 * @param {string} params.endTime - Время окончания (HH:MM)
 * @param {number} params.guestsCount - Количество гостей
 * @param {Array<string>} params.extraServices - Массив ID дополнительных услуг
 * @returns {Object} Результат расчёта
 */
function calculateRentalPrice(params) {
    const {
        hallId,
        date,
        startTime,
        endTime,
        guestsCount,
        extraServices = []
    } = params;
    
    // Валидация входных данных
    if (!hallId || !date || !startTime || !endTime || !guestsCount) {
        return {
            error: 'Не все обязательные поля заполнены',
            valid: false
        };
    }
    
    // Парсинг даты
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
        return {
            error: 'Некорректная дата',
            valid: false
        };
    }
    
    // Получение прайса зала
    const hallPricing = getHallPricing(hallId, bookingDate);
    if (!hallPricing) {
        return {
            error: 'Зал не найден',
            valid: false
        };
    }
    
    // Определение категории дня
    const dayCategory = getDayCategoryWithDecemberRules(bookingDate, startTime);
    
    // Вычисление количества часов
    const hours = calculateHours(startTime, endTime);
    
    // Валидация минимального количества часов
    const dayOfWeek = bookingDate.getDay();
    const isSaturday = dayOfWeek === 6;
    const minHoursRequired = isSaturday && hallPricing.min_hours_saturday !== undefined 
        ? hallPricing.min_hours_saturday 
        : (hallPricing.min_hours !== undefined ? hallPricing.min_hours : 2);
    
    if (hours < minHoursRequired) {
        return {
            error: `Минимальная аренда ${minHoursRequired} ${minHoursRequired === 1 ? 'час' : minHoursRequired < 5 ? 'часа' : 'часов'}`,
            valid: false,
            details: {
                dayCategory,
                season: getPricingSeason(bookingDate),
                hours,
                minHours: minHoursRequired
            }
        };
    }
    
    // Определение базовой цены
    let basePrice;
    switch (dayCategory) {
        case 'weekday':
            // Для будней проверяем время для выбора правильной цены
            const [startHour] = startTime.split(':').map(Number);
            if (hallPricing.weekday_10_22 !== undefined || hallPricing.weekday_22_00 !== undefined) {
                // Используем новые поля с разделением по времени
                if (startHour >= 22) {
                    basePrice = hallPricing.weekday_22_00 || hallPricing.weekday_price;
                } else {
                    basePrice = hallPricing.weekday_10_22 || hallPricing.weekday_price;
                }
            } else {
                // Используем старое поле для обратной совместимости
                basePrice = hallPricing.weekday_price;
            }
            break;
        case 'fri_sat':
            basePrice = hallPricing.fri_sat_price;
            break;
        case 'sunday':
            basePrice = hallPricing.sunday_price;
            break;
        default:
            basePrice = hallPricing.weekday_price;
    }
    
    // Расчёт компонентов стоимости
    const baseCost = basePrice * hours;
    const cleaningCost = calculateCleaningCost(
        guestsCount,
        hallPricing.cleaning_under_30,
        hallPricing.cleaning_over_30
    );
    const afterHoursFee = calculateAfterHoursFee(
        dayCategory,
        startTime,
        endTime,
        hallPricing.after_hours_rate
    );
    const extraServicesCost = calculateExtraServicesCost(extraServices, guestsCount);
    
    // Итоговая стоимость
    const total = baseCost + cleaningCost + afterHoursFee + extraServicesCost;
    
    // Результат
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
            season: getPricingSeason(bookingDate),
            hall_name: hallPricing.name,
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

// ============================================
// ЭКСПОРТ
// ============================================

// Для использования в браузере
if (typeof window !== 'undefined') {
    window.PricingCalculator = {
        calculate: calculateRentalPrice,
        getExtraServices: () => EXTRA_SERVICES,
        getStandardPrices: () => STANDARD_PRICES,
        getDecemberPrices: () => DECEMBER_PRICES,
        validateFoodAlcohol,
        calculateHours,
        updateFromAPI: updatePricingDataFromAPI,
        getHallPricing: getHallPricing // Экспортируем функцию для получения настроек зала
    };
    
    // Если API данные уже загружены, обновляем константы
    if (window.PricingDataAPI && window.PricingDataAPI.converted) {
        setTimeout(() => {
            updatePricingDataFromAPI(window.PricingDataAPI);
        }, 100);
    }
}

// Экспорт для использования в других модулях (для совместимости)
// В браузере используется window.PricingCalculator
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculate: calculateRentalPrice,
        getExtraServices: () => EXTRA_SERVICES,
        getStandardPrices: () => STANDARD_PRICES,
        getDecemberPrices: () => DECEMBER_PRICES,
        validateFoodAlcohol,
        calculateHours
    };
}

