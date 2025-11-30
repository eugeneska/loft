const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

/**
 * GET /api/halls
 * Get all halls
 */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const halls = db.prepare(`
            SELECT * FROM halls 
            ORDER BY sort_order, name
        `).all();
        
        res.json(halls.map(hall => ({
            ...hall,
            is_active: Boolean(hall.is_active)
        })));
    } catch (error) {
        console.error('Error fetching halls:', error);
        res.status(500).json({ error: 'Failed to fetch halls' });
    }
});

/**
 * GET /api/halls/:id
 * Get hall by ID
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const hall = db.prepare('SELECT * FROM halls WHERE id = ?').get(req.params.id);
        
        if (!hall) {
            return res.status(404).json({ error: 'Hall not found' });
        }
        
        res.json({
            ...hall,
            is_active: Boolean(hall.is_active)
        });
    } catch (error) {
        console.error('Error fetching hall:', error);
        res.status(500).json({ error: 'Failed to fetch hall' });
    }
});

/**
 * POST /api/halls
 * Create new hall
 */
router.post('/', (req, res) => {
    try {
        const { code, name, capacity, is_active = true, sort_order = 0 } = req.body;
        
        if (!code || !name || !capacity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const db = getDatabase();
        const result = db.prepare(`
            INSERT INTO halls (code, name, capacity, is_active, sort_order)
            VALUES (?, ?, ?, ?, ?)
        `).run(code, name, capacity, is_active ? 1 : 0, sort_order);
        
        const hall = db.prepare('SELECT * FROM halls WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({
            ...hall,
            is_active: Boolean(hall.is_active)
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Hall with this code already exists' });
        }
        console.error('Error creating hall:', error);
        res.status(500).json({ error: 'Failed to create hall' });
    }
});

/**
 * PUT /api/halls/:id
 * Update hall
 */
router.put('/:id', (req, res) => {
    try {
        const { name, capacity, is_active, sort_order } = req.body;
        const db = getDatabase();
        
        const update = db.prepare(`
            UPDATE halls 
            SET name = COALESCE(?, name),
                capacity = COALESCE(?, capacity),
                is_active = COALESCE(?, is_active),
                sort_order = COALESCE(?, sort_order),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        update.run(name, capacity, is_active !== undefined ? (is_active ? 1 : 0) : null, sort_order, req.params.id);
        
        const hall = db.prepare('SELECT * FROM halls WHERE id = ?').get(req.params.id);
        if (!hall) {
            return res.status(404).json({ error: 'Hall not found' });
        }
        
        res.json({
            ...hall,
            is_active: Boolean(hall.is_active)
        });
    } catch (error) {
        console.error('Error updating hall:', error);
        res.status(500).json({ error: 'Failed to update hall' });
    }
});

/**
 * DELETE /api/halls/:id
 * Delete hall
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const result = db.prepare('DELETE FROM halls WHERE id = ?').run(req.params.id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Hall not found' });
        }
        
        res.json({ message: 'Hall deleted successfully' });
    } catch (error) {
        console.error('Error deleting hall:', error);
        res.status(500).json({ error: 'Failed to delete hall' });
    }
});

module.exports = router;

