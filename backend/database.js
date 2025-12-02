/**
 * Database connection and initialization
 * Uses SQLite for simplicity
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
let db = null;

/**
 * Initialize database connection
 */
function initDatabase() {
    if (db) return db;
    
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    createTables();
    
    return db;
}

/**
 * Get database instance
 */
function getDatabase() {
    if (!db) {
        return initDatabase();
    }
    return db;
}

/**
 * Create all database tables
 */
function createTables() {
    // Таблица залов
    db.exec(`
        CREATE TABLE IF NOT EXISTS halls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица наборов прайсов
    db.exec(`
        CREATE TABLE IF NOT EXISTS price_sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица цен залов
    db.exec(`
        CREATE TABLE IF NOT EXISTS hall_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hall_id INTEGER NOT NULL,
            price_set_id INTEGER NOT NULL,
            weekday_10_22 DECIMAL(10,2) NOT NULL,
            weekday_22_00 DECIMAL(10,2) NOT NULL,
            fri_sat_price DECIMAL(10,2) NOT NULL,
            sun_price DECIMAL(10,2) NOT NULL,
            cleaning_up_to_30 DECIMAL(10,2) NOT NULL,
            cleaning_over_30 DECIMAL(10,2) NOT NULL,
            after_hours_fee DECIMAL(10,2) NOT NULL,
            min_hours INTEGER DEFAULT 2,
            min_hours_saturday INTEGER DEFAULT 2,
            allow_food_alcohol_from_hours INTEGER DEFAULT 2,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE,
            FOREIGN KEY (price_set_id) REFERENCES price_sets(id) ON DELETE CASCADE,
            UNIQUE(hall_id, price_set_id)
        )
    `);
    
    // Миграция: обновление структуры, если таблица уже существует
    try {
        db.exec(`
            ALTER TABLE hall_prices ADD COLUMN weekday_10_22 DECIMAL(10,2);
        `);
    } catch (e) {
        // Колонка уже существует
    }
    
    try {
        db.exec(`
            ALTER TABLE hall_prices ADD COLUMN weekday_22_00 DECIMAL(10,2);
        `);
    } catch (e) {
        // Колонка уже существует
    }
    
    try {
        db.exec(`
            ALTER TABLE hall_prices ADD COLUMN min_hours_saturday INTEGER DEFAULT 2;
        `);
    } catch (e) {
        // Колонка уже существует
    }
    
    // Миграция данных: копируем weekday_price в новые поля
    try {
        db.exec(`
            UPDATE hall_prices 
            SET weekday_10_22 = weekday_price,
                weekday_22_00 = weekday_price
            WHERE weekday_10_22 IS NULL OR weekday_22_00 IS NULL
        `);
    } catch (e) {
        // Игнорируем ошибки миграции
    }
    
    // Таблица дополнительных услуг
    db.exec(`
        CREATE TABLE IF NOT EXISTS extras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            pricing_type TEXT NOT NULL CHECK(pricing_type IN ('fixed', 'per_unit', 'complex')),
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица цен дополнительных услуг
    db.exec(`
        CREATE TABLE IF NOT EXISTS extras_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            extra_id INTEGER NOT NULL,
            price_set_id INTEGER NOT NULL,
            base_price DECIMAL(10,2),
            additional_unit_price DECIMAL(10,2),
            unit_description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (extra_id) REFERENCES extras(id) ON DELETE CASCADE,
            FOREIGN KEY (price_set_id) REFERENCES price_sets(id) ON DELETE CASCADE,
            UNIQUE(extra_id, price_set_id)
        )
    `);
    
    // Таблица правил сезонности
    db.exec(`
        CREATE TABLE IF NOT EXISTS season_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            price_set_id INTEGER NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            days_of_week_mask TEXT NOT NULL,
            priority INTEGER DEFAULT 1,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (price_set_id) REFERENCES price_sets(id) ON DELETE CASCADE,
            CHECK(start_date <= end_date)
        )
    `);
    
    // Таблица логов изменений цен
    db.exec(`
        CREATE TABLE IF NOT EXISTS price_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица пользователей для админки
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'manager' CHECK(role IN ('admin', 'manager')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица услуг
    db.exec(`
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            is_active INTEGER DEFAULT 0,
            show_in_menu INTEGER DEFAULT 0,
            menu_sort INTEGER DEFAULT 500,
            meta_title TEXT,
            meta_description TEXT,
            meta_keywords TEXT,
            hero_background_image TEXT,
            hero_title TEXT NOT NULL,
            hero_subtitle TEXT,
            hero_button_text TEXT,
            hero_button_link TEXT,
            intro_title TEXT,
            intro_text TEXT,
            intro_image TEXT,
            bottom_cta_title TEXT,
            bottom_cta_text TEXT,
            bottom_cta_button_text TEXT,
            bottom_cta_button_link TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_at DATETIME
        )
    `);
    
    // Таблица преимуществ услуг
    db.exec(`
        CREATE TABLE IF NOT EXISTS service_advantages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            text TEXT,
            icon TEXT,
            image TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
        )
    `);
    
    // Таблица фотографий услуг
    db.exec(`
        CREATE TABLE IF NOT EXISTS service_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_id INTEGER NOT NULL,
            image TEXT NOT NULL,
            caption TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
        )
    `);
    
    console.log('Database tables created successfully');
}

/**
 * Close database connection
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    closeDatabase
};

