/**
 * Скрипт для проверки всех данных в БД
 */

const { initDatabase } = require('./database');

const db = initDatabase();

console.log('=== ПРОВЕРКА ДАННЫХ В БАЗЕ ===\n');

// Проверяем залы
console.log('Залы:');
const halls = db.prepare('SELECT * FROM halls ORDER BY code').all();
halls.forEach(h => {
    console.log(`  ${h.code}: ${h.name}, вместимость: ${h.capacity}, активен: ${h.is_active}`);
});

// Проверяем прайс-сеты
console.log('\nПрайс-сеты:');
const priceSets = db.prepare('SELECT * FROM price_sets ORDER BY code').all();
priceSets.forEach(ps => {
    console.log(`  ${ps.code}: ${ps.name}`);
});

// Проверяем цены залов
console.log('\nЦены залов:');
const hallPrices = db.prepare(`
    SELECT h.code as hall_code, ps.code as price_set_code, 
           hp.weekday_10_22, hp.weekday_22_00, hp.fri_sat_price, hp.sun_price,
           hp.cleaning_up_to_30, hp.cleaning_over_30
    FROM hall_prices hp
    JOIN halls h ON hp.hall_id = h.id
    JOIN price_sets ps ON hp.price_set_id = ps.id
    ORDER BY h.code, ps.code
`).all();
hallPrices.forEach(hp => {
    console.log(`  ${hp.hall_code} (${hp.price_set_code}):`);
    console.log(`    Будни 10-22: ${hp.weekday_10_22 || 'NULL'}, Будни 22-00: ${hp.weekday_22_00 || 'NULL'}`);
    console.log(`    Пт/Сб: ${hp.fri_sat_price}, Вс: ${hp.sun_price}`);
});

// Проверяем дополнительные услуги
console.log('\nДополнительные услуги:');
const extras = db.prepare(`
    SELECT e.code, e.name, e.pricing_type, 
           ep.base_price, ep.additional_unit_price, ep.unit_description
    FROM extras e
    LEFT JOIN extras_prices ep ON e.id = ep.extra_id
    WHERE ep.price_set_id = (SELECT id FROM price_sets WHERE code = 'standard')
    ORDER BY e.code
`).all();
extras.forEach(e => {
    console.log(`  ${e.code}: ${e.name}`);
    console.log(`    Тип: ${e.pricing_type}`);
    console.log(`    Базовая цена: ${e.base_price || 'NULL'}`);
    console.log(`    Доп. цена: ${e.additional_unit_price || 'NULL'}`);
    console.log(`    Описание: "${e.unit_description || ''}"`);
});

// Проверяем сезонные правила
console.log('\nСезонные правила:');
const rules = db.prepare(`
    SELECT sr.*, ps.code as price_set_code
    FROM season_rules sr
    JOIN price_sets ps ON sr.price_set_id = ps.id
    ORDER BY sr.priority DESC, sr.start_date
`).all();
rules.forEach(r => {
    console.log(`  ${r.description || 'Без описания'}`);
    console.log(`    Прайс-сет: ${r.price_set_code}, ${r.start_date} - ${r.end_date}`);
    console.log(`    Дни: ${r.days_of_week_mask}, приоритет: ${r.priority}`);
});

console.log('\n=== ПРОВЕРКА ЗАВЕРШЕНА ===');

