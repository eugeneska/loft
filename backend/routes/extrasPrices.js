const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

/**
 * GET /api/extras-prices
 * Get all extra prices, optionally filtered by extra_id or price_set_id
 */
router.get('/', (req, res) => {
    try {
        const { extra_id, price_set_id } = req.query;
        const db = getDatabase();
        
        let query = `
            SELECT ep.*, 
                   e.code as extra_code, e.name as extra_name, e.pricing_type,
                   ps.code as price_set_code, ps.name as price_set_name
            FROM extras_prices ep
            JOIN extras e ON ep.extra_id = e.id
            JOIN price_sets ps ON ep.price_set_id = ps.id
            WHERE 1=1
        `;
        const params = [];
        
        if (extra_id) {
            query += ' AND ep.extra_id = ?';
            params.push(extra_id);
        }
        
        if (price_set_id) {
            query += ' AND ep.price_set_id = ?';
            params.push(price_set_id);
        }
        
        query += ' ORDER BY e.name, ps.code';
        
        const prices = db.prepare(query).all(...params);
        res.json(prices);
    } catch (error) {
        console.error('Error fetching extra prices:', error);
        res.status(500).json({ error: 'Failed to fetch extra prices' });
    }
});

/**
 * GET /api/extras-prices/:id
 * Get extra price by ID
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const price = db.prepare(`
            SELECT ep.*, 
                   e.code as extra_code, e.name as extra_name, e.pricing_type,
                   ps.code as price_set_code, ps.name as price_set_name
            FROM extras_prices ep
            JOIN extras e ON ep.extra_id = e.id
            JOIN price_sets ps ON ep.price_set_id = ps.id
            WHERE ep.id = ?
        `).get(req.params.id);
        
        if (!price) {
            return res.status(404).json({ error: 'Extra price not found' });
        }
        
        res.json(price);
    } catch (error) {
        console.error('Error fetching extra price:', error);
        res.status(500).json({ error: 'Failed to fetch extra price' });
    }
});

/**
 * POST /api/extras-prices
 * Create new extra price
 */
router.post('/', (req, res) => {
    try {
        const { extra_id, price_set_id, base_price, additional_unit_price, unit_description } = req.body;
        
        if (!extra_id || !price_set_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const db = getDatabase();
        const result = db.prepare(`
            INSERT INTO extras_prices (extra_id, price_set_id, base_price, additional_unit_price, unit_description)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            extra_id,
            price_set_id,
            base_price !== undefined ? base_price : null,
            additional_unit_price !== undefined ? additional_unit_price : null,
            unit_description || null
        );
        
        const price = db.prepare(`
            SELECT ep.*, 
                   e.code as extra_code, e.name as extra_name, e.pricing_type,
                   ps.code as price_set_code, ps.name as price_set_name
            FROM extras_prices ep
            JOIN extras e ON ep.extra_id = e.id
            JOIN price_sets ps ON ep.price_set_id = ps.id
            WHERE ep.id = ?
        `).get(result.lastInsertRowid);
        
        res.status(201).json(price);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Price for this extra and price set already exists' });
        }
        console.error('Error creating extra price:', error);
        res.status(500).json({ error: 'Failed to create extra price' });
    }
});

/**
 * PUT /api/extras-prices/:id
 * Update extra price
 */
router.put('/:id', (req, res) => {
    try {
        const { base_price, additional_unit_price, unit_description } = req.body;
        const db = getDatabase();
        
        const update = db.prepare(`
            UPDATE extras_prices 
            SET base_price = ?,
                additional_unit_price = ?,
                unit_description = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        update.run(
            base_price !== undefined ? base_price : null,
            additional_unit_price !== undefined ? additional_unit_price : null,
            unit_description !== undefined ? unit_description : null,
            req.params.id
        );
        
        const price = db.prepare(`
            SELECT ep.*, 
                   e.code as extra_code, e.name as extra_name, e.pricing_type,
                   ps.code as price_set_code, ps.name as price_set_name
            FROM extras_prices ep
            JOIN extras e ON ep.extra_id = e.id
            JOIN price_sets ps ON ep.price_set_id = ps.id
            WHERE ep.id = ?
        `).get(req.params.id);
        
        if (!price) {
            return res.status(404).json({ error: 'Extra price not found' });
        }
        
        res.json(price);
    } catch (error) {
        console.error('Error updating extra price:', error);
        res.status(500).json({ error: 'Failed to update extra price' });
    }
});

/**
 * DELETE /api/extras-prices/:id
 * Delete extra price
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const result = db.prepare('DELETE FROM extras_prices WHERE id = ?').run(req.params.id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Extra price not found' });
        }
        
        res.json({ message: 'Extra price deleted successfully' });
    } catch (error) {
        console.error('Error deleting extra price:', error);
        res.status(500).json({ error: 'Failed to delete extra price' });
    }
});

module.exports = router;

