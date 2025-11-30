const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

/**
 * GET /api/price-sets
 * Get all price sets
 */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const priceSets = db.prepare('SELECT * FROM price_sets ORDER BY code').all();
        res.json(priceSets);
    } catch (error) {
        console.error('Error fetching price sets:', error);
        res.status(500).json({ error: 'Failed to fetch price sets' });
    }
});

/**
 * GET /api/price-sets/:id
 * Get price set by ID
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const priceSet = db.prepare('SELECT * FROM price_sets WHERE id = ?').get(req.params.id);
        
        if (!priceSet) {
            return res.status(404).json({ error: 'Price set not found' });
        }
        
        res.json(priceSet);
    } catch (error) {
        console.error('Error fetching price set:', error);
        res.status(500).json({ error: 'Failed to fetch price set' });
    }
});

/**
 * POST /api/price-sets
 * Create new price set
 */
router.post('/', (req, res) => {
    try {
        const { code, name, description } = req.body;
        
        if (!code || !name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const db = getDatabase();
        const result = db.prepare(`
            INSERT INTO price_sets (code, name, description)
            VALUES (?, ?, ?)
        `).run(code, name, description || null);
        
        const priceSet = db.prepare('SELECT * FROM price_sets WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(priceSet);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Price set with this code already exists' });
        }
        console.error('Error creating price set:', error);
        res.status(500).json({ error: 'Failed to create price set' });
    }
});

/**
 * PUT /api/price-sets/:id
 * Update price set
 */
router.put('/:id', (req, res) => {
    try {
        const { name, description } = req.body;
        const db = getDatabase();
        
        const update = db.prepare(`
            UPDATE price_sets 
            SET name = COALESCE(?, name),
                description = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        update.run(name, description !== undefined ? description : null, req.params.id);
        
        const priceSet = db.prepare('SELECT * FROM price_sets WHERE id = ?').get(req.params.id);
        if (!priceSet) {
            return res.status(404).json({ error: 'Price set not found' });
        }
        
        res.json(priceSet);
    } catch (error) {
        console.error('Error updating price set:', error);
        res.status(500).json({ error: 'Failed to update price set' });
    }
});

/**
 * DELETE /api/price-sets/:id
 * Delete price set
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const result = db.prepare('DELETE FROM price_sets WHERE id = ?').run(req.params.id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Price set not found' });
        }
        
        res.json({ message: 'Price set deleted successfully' });
    } catch (error) {
        console.error('Error deleting price set:', error);
        res.status(500).json({ error: 'Failed to delete price set' });
    }
});

module.exports = router;

