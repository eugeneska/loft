/**
 * T-Bank Payment Integration Initialization
 * Loads configuration from API and initializes payment system
 */

let initConfig = null;
let paymentIntegrationReady = false;

/**
 * Load merchant configuration from API
 */
async function loadMerchantConfig() {
    try {
        console.log('Loading merchant config from /api/merchant/config');
        const response = await fetch('/api/merchant/config');
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to load merchant config:', response.status, errorText);
            throw new Error(`Failed to load merchant config: ${response.status}`);
        }
        
        const config = await response.json();
        console.log('Merchant config received:', config);
        
        if (!config.terminalKey) {
            console.error('Terminal key not found in config:', config);
            throw new Error('Terminal key not found in configuration');
        }
        
        initConfig = {
            terminalKey: config.terminalKey,
            product: config.product || 'eacq',
            features: {
                payment: {
                    // paymentStartCallback будет установлен динамически при инициализации платежа
                    // container будет установлен в момент открытия модального окна оплаты
                },
                iframe: {},
                addcardIframe: {}
            }
        };
        
        console.log('T-Bank payment config loaded successfully:', {
            terminalKey: initConfig.terminalKey,
            product: initConfig.product,
            features: Object.keys(initConfig.features)
        });
        return initConfig;
    } catch (error) {
        console.error('Error loading merchant configuration:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Initialize T-Bank payment integration
 * Called when the integration script loads
 */
async function onPaymentIntegrationLoad() {
    try {
        console.log('onPaymentIntegrationLoad called');
        
        // Check if PaymentIntegration is available
        if (typeof PaymentIntegration === 'undefined') {
            console.error('PaymentIntegration is not available');
            // Retry after a short delay
            setTimeout(() => {
                if (typeof PaymentIntegration !== 'undefined') {
                    console.log('PaymentIntegration found after retry');
                    onPaymentIntegrationLoad();
                } else {
                    console.error('PaymentIntegration still not available after retry');
                }
            }, 500);
            return;
        }
        
        console.log('PaymentIntegration is available');
        console.log('PaymentIntegration structure:', PaymentIntegration);
        
        // Get the actual Integration instance (ES module support)
        let IntegrationModule = PaymentIntegration.Integration || PaymentIntegration.default || PaymentIntegration;
        console.log('IntegrationModule:', IntegrationModule);
        
        // Если это ES модуль, извлекаем реальный Integration
        let Integration = IntegrationModule;
        if (IntegrationModule && IntegrationModule.__esModule && IntegrationModule.Integration) {
            Integration = IntegrationModule.Integration;
            console.log('Using IntegrationModule.Integration (ES module detected)');
            
            // Если Integration тоже ES модуль, извлекаем еще глубже
            if (Integration && Integration.__esModule && Integration.Integration) {
                Integration = Integration.Integration;
                console.log('Using Integration.Integration (nested ES module)');
            }
        } else if (IntegrationModule && typeof IntegrationModule.Integration === 'function') {
            Integration = IntegrationModule.Integration;
            console.log('Using IntegrationModule.Integration');
        }
        
        console.log('Final Integration for init:', Integration);
        console.log('Integration keys:', Object.keys(Integration || {}));
        
        // Load configuration from API
        if (!initConfig) {
            console.log('Loading merchant config from API...');
            await loadMerchantConfig();
        }
        
        // Initialize payment integration
        if (initConfig) {
            console.log('Initializing PaymentIntegration with config:', initConfig);
            
            // Initialize with promise handling
            // init() может быть статическим методом класса или методом экземпляра
            console.log('Calling Integration.init() - Integration type:', typeof Integration);
            const initResult = await Integration.init(initConfig);
            console.log('PaymentIntegration.init result:', initResult);
            console.log('initResult type:', typeof initResult);
            console.log('initResult keys:', initResult ? Object.keys(initResult) : 'null');
            
            // Проверяем, что изменилось после init()
            console.log('Integration after init - has features:', !!Integration.features);
            console.log('Integration after init - has payments:', !!Integration.payments);
            console.log('Integration after init - has payment method:', typeof Integration.payment);
            
            // init() может вернуть экземпляр или модифицировать текущий объект
            // Проверяем результат init()
            let IntegrationInstance = Integration;
            if (initResult && (initResult.features || initResult.payments || typeof initResult.payment === 'function')) {
                // init() вернул экземпляр
                IntegrationInstance = initResult;
                console.log('init() returned instance');
            } else if (Integration.features || Integration.payments || typeof Integration.payment === 'function') {
                // init() модифицировал текущий объект (статические свойства класса)
                IntegrationInstance = Integration;
                console.log('init() modified Integration object (static properties)');
            } else {
                // Возможно init() создал экземпляр внутри класса, используем класс напрямую
                IntegrationInstance = Integration;
                console.log('Using Integration class directly (methods may be static)');
            }
            
            // Store both the module and the instance globally
            window.PaymentIntegrationModule = IntegrationModule;
            window.PaymentIntegrationInstance = IntegrationInstance;
            
            console.log('Stored IntegrationInstance:', IntegrationInstance);
            console.log('IntegrationInstance type:', typeof IntegrationInstance);
            console.log('IntegrationInstance has features:', !!IntegrationInstance.features);
            console.log('IntegrationInstance has payments:', !!IntegrationInstance.payments);
            
            paymentIntegrationReady = true;
            console.log('T-Bank payment integration initialized successfully');
            
            // Dispatch custom event for other scripts
            window.dispatchEvent(new CustomEvent('tbankPaymentReady', { 
                detail: { config: initConfig, integration: IntegrationInstance } 
            }));
        } else {
            console.error('initConfig is null or undefined');
        }
    } catch (error) {
        console.error('Error initializing T-Bank payment integration:', error);
        console.error('Error stack:', error.stack);
        paymentIntegrationReady = false;
        
        // Dispatch error event
        window.dispatchEvent(new CustomEvent('tbankPaymentError', { 
            detail: { error: error.message } 
        }));
    }
}

/**
 * Initialize payment system when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    // Load config immediately (before script loads)
    console.log('DOMContentLoaded - preloading merchant config');
    loadMerchantConfig().then(config => {
        console.log('Merchant config preloaded:', config);
    }).catch(error => {
        console.error('Failed to preload merchant config:', error);
    });
});

// Also try to initialize if PaymentIntegration is already loaded
if (typeof PaymentIntegration !== 'undefined') {
    console.log('PaymentIntegration already available, initializing...');
    onPaymentIntegrationLoad();
}

// Helper function to get Integration instance
function getPaymentIntegration() {
    if (window.PaymentIntegrationInstance) {
        return window.PaymentIntegrationInstance;
    }
    if (typeof PaymentIntegration !== 'undefined') {
        let IntegrationModule = PaymentIntegration.Integration || PaymentIntegration.default || PaymentIntegration;
        // Если это ES модуль, извлекаем реальный Integration
        if (IntegrationModule && IntegrationModule.__esModule && IntegrationModule.Integration) {
            return IntegrationModule.Integration;
        } else if (IntegrationModule && typeof IntegrationModule.Integration === 'function') {
            return IntegrationModule.Integration;
        }
        return IntegrationModule;
    }
    return null;
}

// Export for global access
window.tbankPaymentInit = {
    loadConfig: loadMerchantConfig,
    isReady: () => paymentIntegrationReady,
    getConfig: () => initConfig,
    getIntegration: getPaymentIntegration
};

