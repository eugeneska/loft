/**
 * Модуль предзаполнения форм на страницах залов из URL параметров
 * Вызывается автоматически при загрузке страницы
 */

(function() {
    'use strict';

    /**
     * Предзаполнение формы из URL параметров
     */
    function prefillFormFromURL() {
        const urlParams = new URLSearchParams(window.location.search);

        // Поля формы на страницах залов
        const formFields = {
            'date': 'booking-date',
            'timeFrom': 'booking-time-from',
            'timeTo': 'booking-time-to',
            'guests': 'booking-guests'
        };

        let hasParams = false;

        // Предзаполнение каждого поля
        Object.entries(formFields).forEach(([paramName, fieldId]) => {
            const value = urlParams.get(paramName);
            if (value) {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.value = value;
                    hasParams = true;
                    
                    // Триггерим событие change для обновления зависимых полей
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });

        // Если есть параметры и модуль расчета загружен, запускаем расчет
        if (hasParams && window.pricingIntegration) {
            setTimeout(() => {
                if (window.pricingIntegration.calculate) {
                    window.pricingIntegration.calculate();
                }
            }, 100);
        }

        return hasParams;
    }

    /**
     * Инициализация модуля
     */
    function init() {
        // Выполняем предзаполнение при загрузке DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', prefillFormFromURL);
        } else {
            prefillFormFromURL();
        }
    }

    // Запускаем инициализацию
    init();

    // Экспорт для использования в других модулях
    if (typeof window !== 'undefined') {
        window.FormPrefill = {
            prefill: prefillFormFromURL
        };
    }
})();

