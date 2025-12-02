/**
 * Динамическое меню услуг для шапки сайта
 * Загружает активные услуги из API и вставляет их в меню
 */

(function() {
    'use strict';
    
    /**
     * Загружает список услуг для меню
     */
    async function loadServicesMenu() {
        try {
            console.log('Fetching services from /api/services/public');
            const response = await fetch('/api/services/public');
            if (!response.ok) {
                console.warn('Не удалось загрузить услуги для меню. Status:', response.status);
                return;
            }
            
            const services = await response.json();
            console.log('Loaded services:', services);
            
            // Находим элемент меню "Услуги"
            const servicesNavItem = findServicesNavItem();
            if (!servicesNavItem) {
                console.warn('Элемент меню "Услуги" не найден. Trying alternative search...');
                // Альтернативный поиск
                const allNavItems = document.querySelectorAll('.nav-item');
                for (const item of allNavItems) {
                    const link = item.querySelector('.nav-link');
                    if (link && link.textContent.trim() === 'Услуги') {
                        console.log('Found services menu item via alternative search');
                        const foundItem = item;
                        populateMenu(foundItem, services);
                        return;
                    }
                }
                console.error('Services menu item not found at all');
                return;
            }
            
            populateMenu(servicesNavItem, services);
        } catch (error) {
            console.error('Ошибка загрузки меню услуг:', error);
        }
    }
    
    /**
     * Заполняет меню услугами
     */
    function populateMenu(servicesNavItem, services) {
            
        // Всегда показываем меню, даже если услуг нет
        servicesNavItem.style.display = '';
        servicesNavItem.classList.add('has-dropdown');
        
        // Находим существующий dropdown (ul.dropdown) или создаем новый
        let dropdown = servicesNavItem.querySelector('ul.dropdown');
        if (!dropdown) {
            console.log('Creating new dropdown element');
            dropdown = document.createElement('ul');
            dropdown.className = 'dropdown';
            servicesNavItem.appendChild(dropdown);
        }
        
        // Очищаем старое содержимое
        dropdown.innerHTML = '';
        
        // Если услуг нет, оставляем dropdown пустым (но меню видно)
        if (services.length === 0) {
            console.log('No services to display');
            return;
        }
        
        console.log(`Populating menu with ${services.length} services`);
        
        // Заполняем dropdown услугами
        services.forEach(service => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `/services/${service.slug}`;
            a.className = 'dropdown-item';
            a.textContent = service.hero_title || service.slug;
            li.appendChild(a);
            dropdown.appendChild(li);
        });
        
        console.log('Services menu populated successfully');
    }
    
    /**
     * Находит элемент меню "Услуги" в DOM
     */
    function findServicesNavItem() {
        // Ищем по тексту "Услуги" в nav-link
        const navLinks = document.querySelectorAll('.nav-link');
        for (const link of navLinks) {
            const text = link.textContent.trim();
            if (text === 'Услуги' || (text.includes('Услуги') && !text.includes('Дополнительные'))) {
                const navItem = link.closest('.nav-item');
                if (navItem) {
                    return navItem;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Инициализация при загрузке DOM
     */
    function init() {
        // Ждем полной загрузки DOM и небольшой задержки для гарантии
        const loadMenu = () => {
            console.log('Loading services menu...');
            setTimeout(() => {
                loadServicesMenu();
            }, 300); // Увеличена задержка для гарантии загрузки
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadMenu);
        } else {
            loadMenu();
        }
    }
    
    // Запускаем инициализацию
    init();
    
    // Также перезагружаем меню при изменении фокуса (на случай если страница была открыта до создания услуг)
    window.addEventListener('focus', () => {
        setTimeout(loadServicesMenu, 300);
    });
    
    // Перезагружаем меню после полной загрузки страницы
    window.addEventListener('load', () => {
        setTimeout(loadServicesMenu, 500);
    });
})();

