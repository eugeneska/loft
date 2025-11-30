/**
 * Модуль расчета стоимости для главной страницы
 * Обрабатывает форму на главной странице и отображает цены на карточках залов
 */

(function() {
    'use strict';

    // Маппинг ID залов из формы на реальные ID
    const hallIdMap = {
        'armaloft': 'armaloft',
        'mercury': 'merkuri',
        'airplane': 'samolet',
        'rufer': 'rufer',
        'pulka': 'pulka'
    };

    // Маппинг ID залов на страницы
    const hallPagesMap = {
        'armaloft': 'armaloft.html',
        'merkuri': 'merkuri.html',
        'mercury': 'merkuri.html',
        'samolet': 'samolet.html',
        'airplane': 'samolet.html',
        'rufer': 'rufer.html',
        'pulka': 'pulka.html'
    };

    // Список всех залов (ID для расчета)
    const allHallIds = ['armaloft', 'merkuri', 'samolet', 'rufer', 'pulka'];

    // Маппинг ID для расчета на ID карточек в HTML (data-hall-id)
    const hallIdToCardIdMap = {
        'armaloft': 'armaloft',
        'merkuri': 'mercury',
        'samolet': 'airplane',
        'rufer': 'rufer',
        'pulka': 'pulka'
    };

    /**
     * Получение ID карточки по ID зала для расчета
     */
    function getCardHallId(calculationHallId) {
        return hallIdToCardIdMap[calculationHallId] || calculationHallId;
    }

    /**
     * Получение данных формы
     */
    function getFormData() {
        const date = document.getElementById('hero-event-date')?.value || '';
        const timeFrom = document.getElementById('hero-time-from')?.value || '';
        const timeTo = document.getElementById('hero-time-to')?.value || '';
        const guests = document.getElementById('hero-guests-count')?.value || '';
        const hall = document.getElementById('hero-hall-select')?.value || 'all';

        // Парсинг количества гостей (может быть в формате "3-12", "12-18" и т.д.)
        let guestsCount = 0;
        if (guests) {
            if (guests.includes('-')) {
                const parts = guests.split('-');
                guestsCount = parseInt(parts[parts.length - 1]) || 0;
            } else {
                guestsCount = parseInt(guests) || 0;
            }
        }

        return {
            date,
            timeFrom,
            timeTo,
            guests: guestsCount,
            hall
        };
    }

    /**
     * Получение выбранного зала
     */
    function getSelectedHall() {
        return document.getElementById('hero-hall-select')?.value || 'all';
    }

    /**
     * Получение реального ID зала
     */
    function getRealHallId(formHallId) {
        return hallIdMap[formHallId] || formHallId;
    }

    /**
     * Обновление цены на карточке зала
     */
    function updateHallPrice(calculationHallId, calculationResult) {
        const cardHallId = getCardHallId(calculationHallId);
        const roomCard = document.querySelector(`.room-card[data-hall-id="${cardHallId}"]`);
        if (!roomCard) {
            console.warn(`Карточка зала не найдена: calculationId=${calculationHallId}, cardId=${cardHallId}`);
            return;
        }

        const priceBlock = roomCard.querySelector('.room-price');
        if (!priceBlock) return;

        if (calculationResult && calculationResult.valid) {
            const priceAmount = priceBlock.querySelector('.price-amount');
            if (priceAmount) {
                // Показываем стоимость за 2 часа
                const basePrice = calculationResult.base_price || 0;
                const twoHoursPrice = basePrice * 2;
                priceAmount.textContent = twoHoursPrice.toLocaleString('ru-RU');
            }
            priceBlock.style.display = 'block';
            roomCard.classList.add('calculated');
        } else {
            priceBlock.style.display = 'none';
            roomCard.classList.remove('calculated');
        }
    }

    /**
     * Показ ошибки на карточке зала
     */
    function showHallError(calculationHallId) {
        const cardHallId = getCardHallId(calculationHallId);
        const roomCard = document.querySelector(`.room-card[data-hall-id="${cardHallId}"]`);
        if (!roomCard) {
            console.warn(`Карточка зала не найдена для ошибки: calculationId=${calculationHallId}, cardId=${cardHallId}`);
            return;
        }

        const priceBlock = roomCard.querySelector('.room-price');
        if (!priceBlock) return;

        const priceAmount = priceBlock.querySelector('.price-amount');
        if (priceAmount) {
            priceAmount.textContent = 'недоступно';
        }
        priceBlock.style.display = 'block';
        roomCard.classList.remove('calculated');
        priceBlock.classList.add('error');
    }

    /**
     * Скрытие всех цен на карточках
     */
    function clearAllPrices() {
        const roomCards = document.querySelectorAll('.room-card');
        roomCards.forEach(card => {
            const priceBlock = card.querySelector('.room-price');
            if (priceBlock) {
                priceBlock.style.display = 'none';
                priceBlock.classList.remove('error');
            }
            card.classList.remove('calculated');
        });
    }

    /**
     * Расчет стоимости для всех залов
     */
    async function calculateAllHallsPrices(formData) {
        // Сначала очищаем все цены
        clearAllPrices();

        // Проверяем, что все поля заполнены
        if (!formData.date || !formData.timeFrom || !formData.timeTo || !formData.guests) {
            return;
        }

        // Проверяем, что модуль расчета загружен
        if (!window.PricingCalculator) {
            console.error('Модуль PricingCalculator не загружен');
            return;
        }

        // Рассчитываем для каждого зала
        allHallIds.forEach((hallId) => {
            try {
                const result = window.PricingCalculator.calculate({
                    hallId: hallId,
                    date: formData.date,
                    startTime: formData.timeFrom,
                    endTime: formData.timeTo,
                    guestsCount: formData.guests,
                    extraServices: [] // без дополнительных услуг
                });

                if (result && result.valid) {
                    updateHallPrice(hallId, result);
                } else {
                    showHallError(hallId);
                }
            } catch (error) {
                console.error(`Ошибка расчета для зала ${hallId}:`, error);
                showHallError(hallId);
            }
        });

        // Фильтруем залы по доступности (проверяем занятость через API)
        if (window.filterHallsByAvailability && typeof window.filterHallsByAvailability === 'function') {
            await window.filterHallsByAvailability(
                formData.date,
                formData.timeFrom,
                formData.timeTo,
                'all', // показываем все залы
                formData.guests
            );
        }

        // Прокручиваем к секции с залами
        const roomsSection = document.getElementById('rooms');
        if (roomsSection) {
            setTimeout(() => {
                roomsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }
    }

    /**
     * Редирект на страницу зала с параметрами (с проверкой доступности)
     */
    async function redirectToHallPage(hallId, formData) {
        // Получаем реальный ID зала для расчета
        const realHallId = getRealHallId(hallId);
        
        // Получаем ID зала для проверки доступности (может отличаться от ID для расчета)
        const cardHallId = hallId; // ID из формы может быть 'mercury' или 'airplane'
        
        // Проверяем доступность зала ПЕРЕД редиректом
        if (window.checkHallAvailability && typeof window.checkHallAvailability === 'function') {
            const isAvailable = await window.checkHallAvailability(
                cardHallId,
                formData.date,
                formData.timeFrom,
                formData.timeTo
            );
            
            if (!isAvailable) {
                alert(`Зал "${getHallDisplayName(hallId)}" занят в выбранное время (${formData.timeFrom} - ${formData.timeTo}). Пожалуйста, выберите другое время.`);
                return;
            }
        }
        
        // Проверяем вместимость зала
        if (window.hallCapacity && window.hallCapacity[cardHallId]) {
            const maxCapacity = window.hallCapacity[cardHallId];
            if (formData.guests > maxCapacity) {
                alert(`Зал "${getHallDisplayName(hallId)}" вмещает до ${maxCapacity} человек. Вы выбрали ${formData.guests} гостей. Пожалуйста, выберите другой зал или уменьшите количество гостей.`);
                return;
            }
        }
        
        const page = hallPagesMap[realHallId] || hallPagesMap[hallId];

        if (!page) {
            console.error('Страница зала не найдена:', hallId);
            return;
        }

        // Формируем параметры URL
        const params = new URLSearchParams();
        if (formData.date) params.set('date', formData.date);
        if (formData.timeFrom) params.set('timeFrom', formData.timeFrom);
        if (formData.timeTo) params.set('timeTo', formData.timeTo);
        if (formData.guests) params.set('guests', formData.guests);

        // Выполняем редирект только если зал доступен
        const url = `${page}?${params.toString()}`;
        window.location.href = url;
    }

    /**
     * Получение отображаемого имени зала
     */
    function getHallDisplayName(hallId) {
        const hallNames = {
            'armaloft': 'АРМАЛОФТ',
            'mercury': 'МЕРКУРИ',
            'merkuri': 'МЕРКУРИ',
            'airplane': 'САМОЛЕТ',
            'samolet': 'САМОЛЕТ',
            'rufer': 'РУФЕР',
            'pulka': 'ПУЛЬКА'
        };
        return hallNames[hallId] || hallId.toUpperCase();
    }

    /**
     * Обработка отправки формы на главной странице
     */
    async function handleHeroFormSubmission(e) {
        e.preventDefault();

        const formData = getFormData();
        const selectedHall = getSelectedHall();

        // Валидация
        if (!formData.date || !formData.timeFrom || !formData.timeTo || !formData.guests) {
            alert('Пожалуйста, заполните все поля формы');
            return;
        }

        if (selectedHall === 'all') {
            // Расчет для всех залов
            await calculateAllHallsPrices(formData);
        } else {
            // Редирект на страницу конкретного зала (с проверкой доступности)
            await redirectToHallPage(selectedHall, formData);
        }
    }

    /**
     * Отключение занятых часов в селектах времени
     */
    async function updateTimeSelectsAvailability() {
        const hallSelect = document.getElementById('hero-hall-select');
        const dateInput = document.getElementById('hero-event-date');
        const timeFromSelect = document.getElementById('hero-time-from');
        const timeToSelect = document.getElementById('hero-time-to');

        if (!hallSelect || !dateInput || !timeFromSelect || !timeToSelect) {
            return;
        }

        const selectedHall = hallSelect.value;
        const selectedDate = dateInput.value;

        // Если выбран "Все залы" или дата не выбрана, включаем все опции времени
        if (selectedHall === 'all' || !selectedDate) {
            [timeFromSelect, timeToSelect].forEach(select => {
                if (select) {
                    select.querySelectorAll('option').forEach(option => {
                        option.disabled = false;
                    });
                }
            });
            return;
        }

        // Получаем ID зала для проверки (может отличаться от ID формы)
        const cardHallId = selectedHall; // ID из формы может быть 'mercury' или 'airplane'

        // Отключаем селекты на время загрузки
        timeFromSelect.disabled = true;
        timeToSelect.disabled = true;

        try {
            // Получаем занятые часы для выбранного зала
            if (window.getBusyHours && typeof window.getBusyHours === 'function') {
                const busyHours = await window.getBusyHours(cardHallId, selectedDate);

                // Сохраняем текущие выбранные значения
                const selectedFrom = timeFromSelect.value;
                const selectedTo = timeToSelect.value;

                // Отключаем занятые часы
                if (window.disableBusyHoursInHeroForm && typeof window.disableBusyHoursInHeroForm === 'function') {
                    window.disableBusyHoursInHeroForm(busyHours);
                } else {
                    // Fallback - отключаем вручную
                    [timeFromSelect, timeToSelect].forEach(select => {
                        if (!select) return;
                        select.querySelectorAll('option').forEach(option => {
                            if (option.value && option.value !== '') {
                                option.disabled = false;
                                const hour = parseInt(option.value.split(':')[0]);
                                if (busyHours.includes(hour)) {
                                    option.disabled = true;
                                }
                            }
                        });
                    });
                }

                // Сбрасываем выбранное время, если оно стало недоступным
                if (selectedFrom) {
                    const selectedHour = parseInt(selectedFrom.split(':')[0]);
                    if (busyHours.includes(selectedHour)) {
                        timeFromSelect.value = '';
                    }
                }
                if (selectedTo) {
                    const selectedHour = parseInt(selectedTo.split(':')[0]);
                    if (busyHours.includes(selectedHour)) {
                        timeToSelect.value = '';
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка при обновлении доступности времени:', error);
        } finally {
            // Включаем селекты обратно
            timeFromSelect.disabled = false;
            timeToSelect.disabled = false;
        }
    }

    /**
     * Автоматическая фильтрация при изменении полей формы
     */
    let filterTimeout = null;
    function setupAutoFilter() {
        const dateInput = document.getElementById('hero-event-date');
        const timeFromSelect = document.getElementById('hero-time-from');
        const timeToSelect = document.getElementById('hero-time-to');
        const guestsSelect = document.getElementById('hero-guests-count');
        const hallSelect = document.getElementById('hero-hall-select');

        // Обработчик изменения зала или даты - обновляем доступность времени
        if (hallSelect) {
            hallSelect.addEventListener('change', () => {
                updateTimeSelectsAvailability();
            });
        }

        if (dateInput) {
            dateInput.addEventListener('change', () => {
                updateTimeSelectsAvailability();
            });
        }

        const fields = [dateInput, timeFromSelect, timeToSelect, guestsSelect, hallSelect];

        fields.forEach(field => {
            if (field) {
                field.addEventListener('change', () => {
                    // Очищаем предыдущий таймаут
                    if (filterTimeout) {
                        clearTimeout(filterTimeout);
                    }

                    // Задержка перед фильтрацией (debounce)
                    filterTimeout = setTimeout(async () => {
                        const formData = getFormData();
                        const selectedHall = getSelectedHall();

                        // Проверяем, что все необходимые поля заполнены
                        if (formData.date && formData.timeFrom && formData.timeTo && formData.guests) {
                            if (selectedHall === 'all') {
                                // Если выбран "Все залы", запускаем расчет цен и фильтрацию
                                await calculateAllHallsPrices(formData);
                            } else {
                                // Для конкретного зала только фильтруем
                                if (window.filterHallsByAvailability && typeof window.filterHallsByAvailability === 'function') {
                                    await window.filterHallsByAvailability(
                                        formData.date,
                                        formData.timeFrom,
                                        formData.timeTo,
                                        selectedHall,
                                        formData.guests
                                    );
                                }
                            }
                        } else {
                            // Если не все поля заполнены, очищаем фильтрацию - показываем все залы
                            const roomCards = document.querySelectorAll('.room-card');
                            roomCards.forEach(card => {
                                card.style.display = 'block';
                                card.style.opacity = '1';
                                card.style.transform = 'scale(1)';
                                const indicator = card.querySelector('.availability-indicator');
                                if (indicator) {
                                    indicator.remove();
                                }
                            });
                            clearAllPrices();
                        }
                    }, 500); // Задержка 500мс
                });
            }
        });
    }

    /**
     * Инициализация модуля
     */
    function init() {
        const heroForm = document.getElementById('heroForm');
        if (!heroForm) {
            console.warn('Форма heroForm не найдена');
            return;
        }

        // Удаляем предыдущий обработчик, если есть
        heroForm.removeEventListener('submit', handleHeroFormSubmission);
        
        // Добавляем новый обработчик
        heroForm.addEventListener('submit', handleHeroFormSubmission);

        // Настраиваем автоматическую фильтрацию
        setupAutoFilter();
        
        // Проверяем доступность времени при загрузке, если зал и дата уже выбраны
        const hallSelect = document.getElementById('hero-hall-select');
        const dateInput = document.getElementById('hero-event-date');
        if (hallSelect && dateInput && hallSelect.value !== 'all' && dateInput.value) {
            setTimeout(() => {
                updateTimeSelectsAvailability();
            }, 500);
        }

        console.log('Модуль hero-pricing инициализирован');
    }

    // Инициализация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Экспорт для использования в других модулях
    if (typeof window !== 'undefined') {
        window.HeroPricing = {
            calculateAllHallsPrices,
            redirectToHallPage,
            updateHallPrice,
            clearAllPrices
        };
    }
})();

