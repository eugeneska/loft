const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

/**
 * GET /api/hall-prices
 * Get all hall prices, optionally filtered by hall_id or price_set_id
 */
router.get('/', (req, res) => {
    try {
        const { hall_id, price_set_id } = req.query;
        const db = getDatabase();
        
        let query = `
            SELECT hp.*, 
                   h.code as hall_code, h.name as hall_name,
                   ps.code as price_set_code, ps.name as price_set_name
            FROM hall_prices hp
            JOIN halls h ON hp.hall_id = h.id
            JOIN price_sets ps ON hp.price_set_id = ps.id
            WHERE 1=1
        `;
        const params = [];
        
        if (hall_id) {
            query += ' AND hp.hall_id = ?';
            params.push(hall_id);
        }
        
        if (price_set_id) {
            query += ' AND hp.price_set_id = ?';
            params.push(price_set_id);
        }
        
        query += ' ORDER BY h.name, ps.code';
        
        const prices = db.prepare(query).all(...params);
        res.json(prices);
    } catch (error) {
        console.error('Error fetching hall prices:', error);
        res.status(500).json({ error: 'Failed to fetch hall prices' });
    }
});

/**
 * GET /api/hall-prices/:id
 * Get hall price by ID
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const price = db.prepare(`
            SELECT hp.*, 
                   h.code as hall_code, h.name as hall_name,
                   ps.code as price_set_code, ps.name as price_set_name
            FROM hall_prices hp
            JOIN halls h ON hp.hall_id = h.id
            JOIN price_sets ps ON hp.price_set_id = ps.id
            WHERE hp.id = ?
        `).get(req.params.id);
        
        if (!price) {
            return res.status(404).json({ error: 'Hall price not found' });
        }
        
        res.json(price);
    } catch (error) {
        console.error('Error fetching hall price:', error);
        res.status(500).json({ error: 'Failed to fetch hall price' });
    }
});

/**
 * POST /api/hall-prices
 * Create new hall price
 */
router.post('/', (req, res) => {
    try {
        const {
            hall_id,
            price_set_id,
            weekday_10_22,
            weekday_22_00,
            weekday_price, // для обратной совместимости
            fri_sat_price,
            sun_price,
            cleaning_up_to_30,
            cleaning_over_30,
            after_hours_fee,
            min_hours = 2,
            min_hours_saturday = 2,
            allow_food_alcohol_from_hours = 2
        } = req.body;
        
        // Используем новые поля, если они есть, иначе старые
        const weekday10_22 = weekday_10_22 !== undefined ? weekday_10_22 : weekday_price;
        const weekday22_00 = weekday_22_00 !== undefined ? weekday_22_00 : weekday_price;
        
        if (!hall_id || !price_set_id || (!weekday_10_22 && !weekday_price) ||
            fri_sat_price === undefined || sun_price === undefined ||
            cleaning_up_to_30 === undefined || cleaning_over_30 === undefined ||
            after_hours_fee === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const db = getDatabase();
        const result = db.prepare(`
            INSERT INTO hall_prices (
                hall_id, price_set_id, weekday_10_22, weekday_22_00, fri_sat_price, sun_price,
                cleaning_up_to_30, cleaning_over_30, after_hours_fee,
                min_hours, min_hours_saturday, allow_food_alcohol_from_hours
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            hall_id, price_set_id, weekday10_22, weekday22_00, fri_sat_price, sun_price,
            cleaning_up_to_30, cleaning_over_30, after_hours_fee,
            min_hours, min_hours_saturday || min_hours, allow_food_alcohol_from_hours
        );
        
        const price = db.prepare(`
            SELECT hp.*, 
                   h.code as hall_code, h.name as hall_name,
                   ps.code as price_set_code, ps.name as price_set_name
            FROM hall_prices hp
            JOIN halls h ON hp.hall_id = h.id
            JOIN price_sets ps ON hp.price_set_id = ps.id
            WHERE hp.id = ?
        `).get(result.lastInsertRowid);
        
        res.status(201).json(price);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Price for this hall and price set already exists' });
        }
        console.error('Error creating hall price:', error);
        res.status(500).json({ error: 'Failed to create hall price' });
    }
});

/**
 * PUT /api/hall-prices/:id
 * Update hall price
 */
router.put('/:id', (req, res) => {
    try {
        const {
            weekday_10_22,
            weekday_22_00,
            weekday_price, // для обратной совместимости
            fri_sat_price,
            sun_price,
            cleaning_up_to_30,
            cleaning_over_30,
            after_hours_fee,
            min_hours,
            min_hours_saturday,
            allow_food_alcohol_from_hours
        } = req.body;
        
        const db = getDatabase();
        
        // Используем новые поля, если они есть, иначе старые
        const weekday10_22 = weekday_10_22 !== undefined ? weekday_10_22 : (weekday_price !== undefined ? weekday_price : null);
        const weekday22_00 = weekday_22_00 !== undefined ? weekday_22_00 : (weekday_price !== undefined ? weekday_price : null);
        
        const update = db.prepare(`
            UPDATE hall_prices 
            SET weekday_10_22 = COALESCE(?, weekday_10_22, weekday_price),
                weekday_22_00 = COALESCE(?, weekday_22_00, weekday_price),
                fri_sat_price = COALESCE(?, fri_sat_price),
                sun_price = COALESCE(?, sun_price),
                cleaning_up_to_30 = COALESCE(?, cleaning_up_to_30),
                cleaning_over_30 = COALESCE(?, cleaning_over_30),
                after_hours_fee = COALESCE(?, after_hours_fee),
                min_hours = COALESCE(?, min_hours),
                min_hours_saturday = COALESCE(?, min_hours_saturday, min_hours),
                allow_food_alcohol_from_hours = COALESCE(?, allow_food_alcohol_from_hours),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        update.run(
            weekday10_22, weekday22_00, fri_sat_price, sun_price,
            cleaning_up_to_30, cleaning_over_30, after_hours_fee,
            min_hours, min_hours_saturday, allow_food_alcohol_from_hours,
            req.params.id
        );
        
        const price = db.prepare(`
            SELECT hp.*, 
                   h.code as hall_code, h.name as hall_name,
                   ps.code as price_set_code, ps.name as price_set_name
            FROM hall_prices hp
            JOIN halls h ON hp.hall_id = h.id
            JOIN price_sets ps ON hp.price_set_id = ps.id
            WHERE hp.id = ?
        `).get(req.params.id);
        
        if (!price) {
            return res.status(404).json({ error: 'Hall price not found' });
        }
        
        res.json(price);
    } catch (error) {
        console.error('Error updating hall price:', error);
        res.status(500).json({ error: 'Failed to update hall price' });
    }
});

/**
 * DELETE /api/hall-prices/:id
 * Delete hall price
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const result = db.prepare('DELETE FROM hall_prices WHERE id = ?').run(req.params.id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Hall price not found' });
        }
        
        res.json({ message: 'Hall price deleted successfully' });
    } catch (error) {
        console.error('Error deleting hall price:', error);
        res.status(500).json({ error: 'Failed to delete hall price' });
    }
});

module.exports = router;

