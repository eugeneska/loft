const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

/**
 * GET /api/extras
 * Get all extras
 */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const extras = db.prepare('SELECT * FROM extras ORDER BY sort_order, name').all();
        
        res.json(extras.map(extra => ({
            ...extra,
            is_active: Boolean(extra.is_active)
        })));
    } catch (error) {
        console.error('Error fetching extras:', error);
        res.status(500).json({ error: 'Failed to fetch extras' });
    }
});

/**
 * GET /api/extras/:id
 * Get extra by ID
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const extra = db.prepare('SELECT * FROM extras WHERE id = ?').get(req.params.id);
        
        if (!extra) {
            return res.status(404).json({ error: 'Extra not found' });
        }
        
        res.json({
            ...extra,
            is_active: Boolean(extra.is_active)
        });
    } catch (error) {
        console.error('Error fetching extra:', error);
        res.status(500).json({ error: 'Failed to fetch extra' });
    }
});

/**
 * POST /api/extras
 * Create new extra
 */
router.post('/', (req, res) => {
    try {
        const { code, name, description, pricing_type, is_active = true, sort_order = 0 } = req.body;
        
        if (!code || !name || !pricing_type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (!['fixed', 'per_unit', 'complex'].includes(pricing_type)) {
            return res.status(400).json({ error: 'Invalid pricing_type' });
        }
        
        const db = getDatabase();
        const result = db.prepare(`
            INSERT INTO extras (code, name, description, pricing_type, is_active, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(code, name, description || null, pricing_type, is_active ? 1 : 0, sort_order);
        
        const extra = db.prepare('SELECT * FROM extras WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({
            ...extra,
            is_active: Boolean(extra.is_active)
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Extra with this code already exists' });
        }
        console.error('Error creating extra:', error);
        res.status(500).json({ error: 'Failed to create extra' });
    }
});

/**
 * PUT /api/extras/:id
 * Update extra
 */
router.put('/:id', (req, res) => {
    try {
        const { name, description, pricing_type, is_active, sort_order } = req.body;
        const db = getDatabase();
        
        const update = db.prepare(`
            UPDATE extras 
            SET name = COALESCE(?, name),
                description = ?,
                pricing_type = COALESCE(?, pricing_type),
                is_active = COALESCE(?, is_active),
                sort_order = COALESCE(?, sort_order),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        update.run(
            name,
            description !== undefined ? description : null,
            pricing_type,
            is_active !== undefined ? (is_active ? 1 : 0) : null,
            sort_order,
            req.params.id
        );
        
        const extra = db.prepare('SELECT * FROM extras WHERE id = ?').get(req.params.id);
        if (!extra) {
            return res.status(404).json({ error: 'Extra not found' });
        }
        
        res.json({
            ...extra,
            is_active: Boolean(extra.is_active)
        });
    } catch (error) {
        console.error('Error updating extra:', error);
        res.status(500).json({ error: 'Failed to update extra' });
    }
});

/**
 * DELETE /api/extras/:id
 * Delete extra
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const result = db.prepare('DELETE FROM extras WHERE id = ?').run(req.params.id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Extra not found' });
        }
        
        res.json({ message: 'Extra deleted successfully' });
    } catch (error) {
        console.error('Error deleting extra:', error);
        res.status(500).json({ error: 'Failed to delete extra' });
    }
});

module.exports = router;

