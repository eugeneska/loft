const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

/**
 * GET /api/season-rules
 * Get all season rules
 */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const rules = db.prepare(`
            SELECT sr.*, 
                   ps.code as price_set_code, ps.name as price_set_name
            FROM season_rules sr
            JOIN price_sets ps ON sr.price_set_id = ps.id
            ORDER BY sr.priority DESC, sr.start_date
        `).all();
        
        res.json(rules);
    } catch (error) {
        console.error('Error fetching season rules:', error);
        res.status(500).json({ error: 'Failed to fetch season rules' });
    }
});

/**
 * GET /api/season-rules/:id
 * Get season rule by ID
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const rule = db.prepare(`
            SELECT sr.*, 
                   ps.code as price_set_code, ps.name as price_set_name
            FROM season_rules sr
            JOIN price_sets ps ON sr.price_set_id = ps.id
            WHERE sr.id = ?
        `).get(req.params.id);
        
        if (!rule) {
            return res.status(404).json({ error: 'Season rule not found' });
        }
        
        res.json(rule);
    } catch (error) {
        console.error('Error fetching season rule:', error);
        res.status(500).json({ error: 'Failed to fetch season rule' });
    }
});

/**
 * POST /api/season-rules
 * Create new season rule
 */
router.post('/', (req, res) => {
    try {
        const { price_set_id, start_date, end_date, days_of_week_mask, priority = 1, description } = req.body;
        
        if (!price_set_id || !start_date || !end_date || !days_of_week_mask) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ error: 'Start date must be before or equal to end date' });
        }
        
        const db = getDatabase();
        const result = db.prepare(`
            INSERT INTO season_rules (price_set_id, start_date, end_date, days_of_week_mask, priority, description)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(price_set_id, start_date, end_date, days_of_week_mask, priority, description || null);
        
        const rule = db.prepare(`
            SELECT sr.*, 
                   ps.code as price_set_code, ps.name as price_set_name
            FROM season_rules sr
            JOIN price_sets ps ON sr.price_set_id = ps.id
            WHERE sr.id = ?
        `).get(result.lastInsertRowid);
        
        res.status(201).json(rule);
    } catch (error) {
        console.error('Error creating season rule:', error);
        res.status(500).json({ error: 'Failed to create season rule' });
    }
});

/**
 * PUT /api/season-rules/:id
 * Update season rule
 */
router.put('/:id', (req, res) => {
    try {
        const { price_set_id, start_date, end_date, days_of_week_mask, priority, description } = req.body;
        const db = getDatabase();
        
        if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
            return res.status(400).json({ error: 'Start date must be before or equal to end date' });
        }
        
        const update = db.prepare(`
            UPDATE season_rules 
            SET price_set_id = COALESCE(?, price_set_id),
                start_date = COALESCE(?, start_date),
                end_date = COALESCE(?, end_date),
                days_of_week_mask = COALESCE(?, days_of_week_mask),
                priority = COALESCE(?, priority),
                description = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        update.run(
            price_set_id,
            start_date,
            end_date,
            days_of_week_mask,
            priority,
            description !== undefined ? description : null,
            req.params.id
        );
        
        const rule = db.prepare(`
            SELECT sr.*, 
                   ps.code as price_set_code, ps.name as price_set_name
            FROM season_rules sr
            JOIN price_sets ps ON sr.price_set_id = ps.id
            WHERE sr.id = ?
        `).get(req.params.id);
        
        if (!rule) {
            return res.status(404).json({ error: 'Season rule not found' });
        }
        
        res.json(rule);
    } catch (error) {
        console.error('Error updating season rule:', error);
        res.status(500).json({ error: 'Failed to update season rule' });
    }
});

/**
 * DELETE /api/season-rules/:id
 * Delete season rule
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const result = db.prepare('DELETE FROM season_rules WHERE id = ?').run(req.params.id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Season rule not found' });
        }
        
        res.json({ message: 'Season rule deleted successfully' });
    } catch (error) {
        console.error('Error deleting season rule:', error);
        res.status(500).json({ error: 'Failed to delete season rule' });
    }
});

module.exports = router;

