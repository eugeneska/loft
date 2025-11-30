/**
 * Migration script: imports hardcoded data from pricing-calculator.js to database
 */

const { initDatabase } = require('./database');
const fs = require('fs');
const path = require('path');

const db = initDatabase();

// Данные из pricing-calculator.js (стандартные значения)
const STANDARD_PRICES = {
    'armaloft': {
        name: 'Арма Лофт студия 1',
        weekday_price: 2500,
        fri_sat_price: 3500,
        sunday_price: 3000,
        cleaning_under_30: 1500,
        cleaning_over_30: 2000,
        after_hours_rate: 500,
        capacity: 120
    },
    'merkuri': {
        name: 'Меркури',
        weekday_price: 2000,
        fri_sat_price: 2800,
        sunday_price: 2500,
        cleaning_under_30: 1200,
        cleaning_over_30: 1800,
        after_hours_rate: 500,
        capacity: 80
    },
    'pulka': {
        name: 'Пулька',
        weekday_price: 1500,
        fri_sat_price: 2000,
        sunday_price: 1800,
        cleaning_under_30: 1000,
        cleaning_over_30: 1500,
        after_hours_rate: 500,
        capacity: 50
    },
    'rufer': {
        name: 'Руфер',
        weekday_price: 1800,
        fri_sat_price: 2400,
        sunday_price: 2200,
        cleaning_under_30: 1100,
        cleaning_over_30: 1600,
        after_hours_rate: 500,
        capacity: 60
    },
    'samolet': {
        name: 'Самолёт',
        weekday_price: 1600,
        fri_sat_price: 2100,
        sunday_price: 1900,
        cleaning_under_30: 1050,
        cleaning_over_30: 1550,
        after_hours_rate: 500,
        capacity: 40
    }
};

const DECEMBER_PRICES = {
    'armaloft': {
        weekday_price: 2500,
        fri_sat_price: 4000,
        sunday_price: 3500,
        cleaning_under_30: 1500,
        cleaning_over_30: 2000,
        after_hours_rate: 400
    },
    'merkuri': {
        weekday_price: 2000,
        fri_sat_price: 3200,
        sunday_price: 2800,
        cleaning_under_30: 1200,
        cleaning_over_30: 1800,
        after_hours_rate: 400
    },
    'pulka': {
        weekday_price: 1500,
        fri_sat_price: 2300,
        sunday_price: 2100,
        cleaning_under_30: 1000,
        cleaning_over_30: 1500,
        after_hours_rate: 400
    },
    'rufer': {
        weekday_price: 1800,
        fri_sat_price: 2700,
        sunday_price: 2500,
        cleaning_under_30: 1100,
        cleaning_over_30: 1600,
        after_hours_rate: 400
    },
    'samolet': {
        weekday_price: 1600,
        fri_sat_price: 2400,
        sunday_price: 2200,
        cleaning_under_30: 1050,
        cleaning_over_30: 1550,
        after_hours_rate: 400
    }
};

const EXTRA_SERVICES = {
    'serving': {
        name: 'Сервировка / посуда',
        pricing_type: 'per_unit',
        base_price: 1000,
        unit_description: 'за каждые 10 человек'
    },
    'hookah': {
        name: 'Кальян',
        pricing_type: 'complex',
        base_price: 2500,
        additional_unit_price: 2200,
        unit_description: 'за кальян'
    },
    'ice': {
        name: 'Лёд',
        pricing_type: 'fixed',
        base_price: 350
    },
    'freezer': {
        name: 'Морозилка',
        pricing_type: 'fixed',
        base_price: 1000
    },
    'glass_breaking': {
        name: 'Бой бокала',
        pricing_type: 'per_unit',
        base_price: 500,
        unit_description: 'за бокал'
    },
    'pylon_installation': {
        name: 'Установка пилона',
        pricing_type: 'fixed',
        base_price: 1000
    },
    'furniture_move': {
        name: 'Перенос мебели',
        pricing_type: 'fixed',
        base_price: 2000
    }
};

function migrate() {
    console.log('Starting migration...');
    
    const insertHall = db.prepare(`
        INSERT OR REPLACE INTO halls (code, name, capacity, is_active, sort_order)
        VALUES (?, ?, ?, 1, ?)
    `);
    
    const insertPriceSet = db.prepare(`
        INSERT OR REPLACE INTO price_sets (code, name, description)
        VALUES (?, ?, ?)
    `);
    
    const insertHallPrice = db.prepare(`
        INSERT OR REPLACE INTO hall_prices (
            hall_id, price_set_id, weekday_price, fri_sat_price, sun_price,
            cleaning_up_to_30, cleaning_over_30, after_hours_fee, min_hours, allow_food_alcohol_from_hours
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 2, 2)
    `);
    
    const insertExtra = db.prepare(`
        INSERT OR REPLACE INTO extras (code, name, pricing_type, is_active, sort_order)
        VALUES (?, ?, ?, 1, ?)
    `);
    
    const insertExtraPrice = db.prepare(`
        INSERT OR REPLACE INTO extras_prices (extra_id, price_set_id, base_price, additional_unit_price, unit_description)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    const insertSeasonRule = db.prepare(`
        INSERT OR REPLACE INTO season_rules (price_set_id, start_date, end_date, days_of_week_mask, priority, description)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const getHallId = db.prepare('SELECT id FROM halls WHERE code = ?');
    const getPriceSetId = db.prepare('SELECT id FROM price_sets WHERE code = ?');
    const getExtraId = db.prepare('SELECT id FROM extras WHERE code = ?');
    
    const transaction = db.transaction(() => {
        // 1. Создаем price sets
        insertPriceSet.run('standard', 'Обычный прайс', 'Стандартный прайс-лист');
        insertPriceSet.run('december', 'Декабрьский прайс', 'Прайс-лист для декабря (8-31 число)');
        
        // 2. Создаем залы
        let sortOrder = 0;
        for (const [code, data] of Object.entries(STANDARD_PRICES)) {
            insertHall.run(code, data.name, data.capacity, sortOrder++);
        }
        
        // 3. Создаем цены залов для стандартного прайса
        const standardPriceSetId = getPriceSetId.get('standard').id;
        for (const [code, data] of Object.entries(STANDARD_PRICES)) {
            const hallId = getHallId.get(code).id;
            insertHallPrice.run(
                hallId,
                standardPriceSetId,
                data.weekday_price,
                data.fri_sat_price,
                data.sunday_price,
                data.cleaning_under_30,
                data.cleaning_over_30,
                data.after_hours_rate
            );
        }
        
        // 4. Создаем цены залов для декабрьского прайса
        const decemberPriceSetId = getPriceSetId.get('december').id;
        for (const [code, data] of Object.entries(DECEMBER_PRICES)) {
            const hallId = getHallId.get(code).id;
            insertHallPrice.run(
                hallId,
                decemberPriceSetId,
                data.weekday_price,
                data.fri_sat_price,
                data.sunday_price,
                STANDARD_PRICES[code].cleaning_under_30,
                STANDARD_PRICES[code].cleaning_over_30,
                data.after_hours_rate
            );
        }
        
        // 5. Создаем дополнительные услуги
        sortOrder = 0;
        for (const [code, data] of Object.entries(EXTRA_SERVICES)) {
            insertExtra.run(code, data.name, data.pricing_type, sortOrder++);
        }
        
        // 6. Создаем цены дополнительных услуг (для стандартного прайса)
        for (const [code, data] of Object.entries(EXTRA_SERVICES)) {
            const extraId = getExtraId.get(code).id;
            insertExtraPrice.run(
                extraId,
                standardPriceSetId,
                data.base_price,
                data.additional_unit_price || null,
                data.unit_description || null
            );
        }
        
        // 7. Создаем правила сезонности
        // Стандартный прайс: весь год
        insertSeasonRule.run(
            standardPriceSetId,
            '2025-01-01',
            '2025-12-31',
            '0,1,2,3,4,5,6', // все дни
            1,
            'Обычный прайс по умолчанию'
        );
        
        // Декабрьский прайс: 8-31 декабря, Ср-Чт-Пт-Сб-Вс
        insertSeasonRule.run(
            decemberPriceSetId,
            '2025-12-08',
            '2025-12-31',
            '0,3,4,5,6', // Вс, Ср, Чт, Пт, Сб
            10,
            'Декабрьский прайс с 8 по 31 число (Ср-Вс)'
        );
    });
    
    transaction();
    
    console.log('Migration completed successfully!');
}

// Run migration
migrate();

