/**
 * Универсальный скрипт инициализации модуля расчёта стоимости
 * Автоматически определяет зал по URL и инициализирует модуль
 */

(function() {
    'use strict';
    
    // Маппинг страниц на ID залов
    const pageToHallMap = {
        'armaloft.html': 'armaloft',
        'armaloft': 'armaloft',
        'merkuri.html': 'merkuri',
        'merkuri': 'merkuri',
        'pulka.html': 'pulka',
        'pulka': 'pulka',
        'rufer.html': 'rufer',
        'rufer': 'rufer',
        'samolet.html': 'samolet',
        'samolet': 'samolet'
    };
    
    /**
     * Определение ID зала по текущей странице
     */
    function getHallIdFromPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        const pageKey = filename.replace('.html', '');
        
        return pageToHallMap[filename] || pageToHallMap[pageKey] || null;
    }
    
    /**
     * Загрузка скриптов последовательно
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Ошибка загрузки скрипта: ${src}`));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Инициализация модуля расчёта стоимости
     */
    function initPricingModule() {
        const hallId = getHallIdFromPage();
        const bookingForm = document.getElementById('bookingForm');
        const priceContainer = document.getElementById('pricing-container');
        
        if (!bookingForm) {
            console.warn('Форма бронирования не найдена');
            return;
        }
        
        if (!priceContainer) {
            console.warn('Контейнер для стоимости не найден (id="pricing-container")');
            return;
        }
        
        if (!hallId) {
            console.warn('Не удалось определить ID зала для текущей страницы');
            return;
        }
        
        if (!window.PricingIntegration) {
            console.error('Модуль PricingIntegration не загружен');
            return;
        }
        
        // Инициализация модуля
        try {
            window.pricingIntegration = new PricingIntegration('#bookingForm', {
                hallId: hallId,
                priceContainerId: 'pricing-container',
                autoCalculate: true,
                showExtraServices: true,
                showBreakdown: true
            });
            
            // Обработчик отправки формы удален - теперь форма обрабатывается через booking-modal.js
            // Форма будет открывать модальное окно для ввода имени и телефона
            
            console.log('Модуль расчёта стоимости инициализирован для зала:', hallId);
        } catch (error) {
            console.error('Ошибка инициализации модуля расчёта стоимости:', error);
        }
    }
    
    /**
     * Загрузка всех необходимых скриптов и инициализация
     */
    async function loadAndInit() {
        try {
            // Загрузка скриптов последовательно
            await loadScript('js/pricing-calculator.js');
            
            // Загрузка API loader для получения данных из PHP API
            try {
                await loadScript('js/pricing-api-loader.js');
                // Ждем загрузку данных из API
                if (window.PricingApiLoader) {
                    await window.PricingApiLoader.init();
                }
            } catch (apiError) {
                console.warn('API loader не доступен, используются захардкоженные данные:', apiError);
            }
            
            await loadScript('js/pricing-ui.js');
            await loadScript('js/pricing-integration.js');
            
            // Инициализация после загрузки всех скриптов
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initPricingModule);
            } else {
                initPricingModule();
            }
        } catch (error) {
            console.error('Ошибка загрузки модуля расчёта стоимости:', error);
        }
    }
    
    // Запуск загрузки
    loadAndInit();
})();

