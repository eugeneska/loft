/**
 * Динамическое меню услуг для шапки сайта
 * Загружает активные услуги из PHP API и вставляет их в меню
 */

(function() {
    'use strict';
    
    /**
     * Определяет текущий slug услуги из URL
     */
    function getCurrentServiceSlug() {
        const path = window.location.pathname;
        const match = path.match(/\/services\/([^\/]+)/);
        return match ? match[1] : null;
    }
    
    /**
     * Загружает текущую услугу по slug (если мы на странице услуги)
     */
    async function loadCurrentService(slug) {
        try {
            const response = await fetch(`/api/services/${slug}`);
            if (response.ok) {
                const service = await response.json();
                return service;
            }
        } catch (error) {
            console.warn('[services-menu] Не удалось загрузить текущую услугу:', error);
        }
        return null;
    }
    
    /**
     * Загружает список услуг для меню
     */
    async function loadServicesMenu() {
        try {
            console.log('[services-menu] Fetching services from /api/services/public');
            const response = await fetch('/api/services/public');
            
            if (!response.ok) {
                console.warn('[services-menu] Не удалось загрузить услуги для меню. Status:', response.status);
                const text = await response.text();
                console.warn('[services-menu] Response text:', text);
                
                // Если API не работает, но мы на странице услуги, попробуем загрузить текущую услугу
                const currentSlug = getCurrentServiceSlug();
                if (currentSlug) {
                    console.log('[services-menu] API failed, but we are on a service page. Loading current service...');
                    const currentService = await loadCurrentService(currentSlug);
                    if (currentService && currentService.is_active) {
                        const servicesNavItem = findServicesNavItem();
                        if (servicesNavItem) {
                            populateMenu(servicesNavItem, [{
                                id: currentService.id,
                                slug: currentService.slug,
                                hero_title: currentService.hero_title,
                                menu_sort: currentService.menu_sort || 0
                            }]);
                        }
                    }
                }
                return;
            }
            
            let services = await response.json();
            console.log('[services-menu] Loaded services from API:', services);
            console.log('[services-menu] Services count:', services ? services.length : 0);
            console.log('[services-menu] Services type:', typeof services);
            
            if (!Array.isArray(services)) {
                console.error('[services-menu] Services is not an array:', typeof services, services);
                if (services && typeof services === 'object') {
                    console.error('[services-menu] Services object keys:', Object.keys(services));
                }
                return;
            }
            
            if (services.length === 0) {
                console.warn('[services-menu] API returned empty array. This might mean:');
                console.warn('[services-menu] - No services exist in database');
                console.warn('[services-menu] - No services have is_active=1 AND show_in_menu=1');
                console.warn('[services-menu] - All services are deleted (deleted_at IS NOT NULL)');
            }
            
            // Определяем текущий slug услуги
            const currentSlug = getCurrentServiceSlug();
            console.log('[services-menu] Current service slug:', currentSlug);
            
            // Если мы на странице услуги, проверяем, есть ли она в списке
            if (currentSlug) {
                console.log('[services-menu] Checking if current service is in menu list...');
                const currentServiceInList = services.find(s => s.slug === currentSlug);
                
                // Если текущей услуги нет в списке, загружаем её отдельно
                if (!currentServiceInList) {
                    console.log('[services-menu] Current service not in menu list, loading it separately...');
                    const currentService = await loadCurrentService(currentSlug);
                    
                    if (currentService) {
                        console.log('[services-menu] Loaded current service:', currentService);
                        console.log('[services-menu] Current service is_active:', currentService.is_active);
                        
                        if (currentService.is_active) {
                            // Добавляем текущую услугу в начало списка
                            services = [{
                                id: currentService.id,
                                slug: currentService.slug,
                                hero_title: currentService.hero_title,
                                menu_sort: currentService.menu_sort || 0
                            }, ...services];
                            console.log('[services-menu] Added current service to menu list');
                        } else {
                            console.warn('[services-menu] Current service is not active, not adding to menu');
                        }
                    } else {
                        console.warn('[services-menu] Failed to load current service');
                    }
                } else {
                    console.log('[services-menu] Current service already in menu list');
                }
            } else {
                console.log('[services-menu] Not on a service page (no slug in URL)');
            }
            
            // Если после всех проверок список услуг всё ещё пуст, но мы на странице услуги,
            // попробуем загрузить текущую услугу ещё раз (на случай если она не загрузилась ранее)
            if (services.length === 0 && currentSlug) {
                console.warn('[services-menu] Services list is still empty after checks. Trying to load current service again...');
                const currentService = await loadCurrentService(currentSlug);
                if (currentService && currentService.is_active) {
                    services = [{
                        id: currentService.id,
                        slug: currentService.slug,
                        hero_title: currentService.hero_title,
                        menu_sort: currentService.menu_sort || 0
                    }];
                    console.log('[services-menu] Added current service as fallback');
                }
            }
            
            // Находим элемент меню "Услуги"
            const servicesNavItem = findServicesNavItem();
            if (!servicesNavItem) {
                console.warn('[services-menu] Элемент меню "Услуги" не найден. Trying alternative search...');
                // Альтернативный поиск
                const allNavItems = document.querySelectorAll('.nav-item');
                for (const item of allNavItems) {
                    const link = item.querySelector('.nav-link');
                    if (link && link.textContent.trim() === 'Услуги') {
                        console.log('[services-menu] Found services menu item via alternative search');
                        populateMenu(item, services);
                        return;
                    }
                }
                console.error('[services-menu] Services menu item not found at all');
                return;
            }
            
            console.log('[services-menu] Found services nav item, populating menu...');
            populateMenu(servicesNavItem, services);
        } catch (error) {
            console.error('[services-menu] Ошибка загрузки меню услуг:', error);
            console.error('[services-menu] Error stack:', error.stack);
        }
    }
    
    /**
     * Заполняет меню услугами
     */
    function populateMenu(servicesNavItem, services) {
        console.log('[services-menu] populateMenu called with', services ? services.length : 0, 'services');
        console.log('[services-menu] Services data:', services);
        
        if (!servicesNavItem) {
            console.error('[services-menu] servicesNavItem is null!');
            return;
        }
            
        // Всегда показываем меню, даже если услуг нет
        servicesNavItem.style.display = '';
        servicesNavItem.classList.add('has-dropdown');
        
        // Находим существующий dropdown (ul.dropdown) или создаем новый
        let dropdown = servicesNavItem.querySelector('ul.dropdown');
        if (!dropdown) {
            console.log('[services-menu] Creating new dropdown element');
            dropdown = document.createElement('ul');
            dropdown.className = 'dropdown';
            servicesNavItem.appendChild(dropdown);
        }
        
        // Очищаем старое содержимое
        dropdown.innerHTML = '';
        
        // Если услуг нет, оставляем dropdown пустым (но меню видно)
        if (!services || services.length === 0) {
            console.warn('[services-menu] No services to display (services array is empty or null)');
            console.warn('[services-menu] This might mean:');
            console.warn('[services-menu] 1. No services exist in database');
            console.warn('[services-menu] 2. No services have is_active=1 AND show_in_menu=1');
            console.warn('[services-menu] 3. API endpoint /api/services/public is not working');
            return;
        }
        
        console.log(`[services-menu] Populating menu with ${services.length} services`);
        
        // Сортируем услуги по menu_sort
        const sortedServices = [...services].sort((a, b) => {
            const sortA = a.menu_sort || 999;
            const sortB = b.menu_sort || 999;
            return sortA - sortB;
        });
        
        // Заполняем dropdown услугами
        sortedServices.forEach((service, index) => {
            if (!service || !service.slug) {
                console.warn(`[services-menu] Skipping invalid service at index ${index}:`, service);
                return;
            }
            
            console.log(`[services-menu] Adding service ${index + 1}:`, service);
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `/services/${service.slug}`;
            a.className = 'dropdown-item';
            a.textContent = service.hero_title || service.slug || 'Без названия';
            li.appendChild(a);
            dropdown.appendChild(li);
            console.log(`[services-menu] Added menu item: "${a.textContent}" -> ${a.href}`);
        });
        
        console.log('[services-menu] Services menu populated successfully. Total items:', dropdown.children.length);
        
        // Проверяем, что элементы действительно добавлены
        if (dropdown.children.length === 0) {
            console.error('[services-menu] WARNING: Dropdown is empty after population!');
            console.error('[services-menu] Services were:', services);
        }
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
        console.log('[services-menu] Initializing services menu loader...');
        console.log('[services-menu] Document ready state:', document.readyState);
        
        // Ждем полной загрузки DOM и небольшой задержки для гарантии
        const loadMenu = () => {
            console.log('[services-menu] DOM ready, loading services menu...');
            // Пробуем загрузить сразу
            loadServicesMenu();
            // И еще раз через небольшую задержку на случай если DOM еще не полностью готов
            setTimeout(() => {
                console.log('[services-menu] Retrying menu load after delay...');
                loadServicesMenu();
            }, 500);
        };
        
        if (document.readyState === 'loading') {
            console.log('[services-menu] Waiting for DOMContentLoaded...');
            document.addEventListener('DOMContentLoaded', loadMenu);
        } else {
            console.log('[services-menu] DOM already loaded, loading menu immediately...');
            loadMenu();
        }
    }
    
    // Запускаем инициализацию
    console.log('[services-menu] Script loaded, starting initialization...');
    init();
    
    // Также перезагружаем меню при изменении фокуса (на случай если страница была открыта до создания услуг)
    window.addEventListener('focus', () => {
        console.log('[services-menu] Window focused, reloading menu...');
        setTimeout(loadServicesMenu, 300);
    });
    
    // Перезагружаем меню после полной загрузки страницы
    window.addEventListener('load', () => {
        console.log('[services-menu] Window loaded, reloading menu...');
        setTimeout(loadServicesMenu, 500);
    });
    
    // Также пробуем загрузить через небольшую задержку после загрузки скрипта
    setTimeout(() => {
        console.log('[services-menu] Final retry after script load...');
        loadServicesMenu();
    }, 1000);
})();

