/**
 * Simple authentication for admin panel
 * For production, use proper authentication (JWT, sessions, etc.)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database');

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        const db = getDatabase();
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // In production, use JWT or sessions
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/auth/create-user
 * Create default admin user (for initial setup)
 * In production, remove this or protect it properly
 */
router.post('/create-user', async (req, res) => {
    try {
        const { username, password, role = 'manager' } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        const db = getDatabase();
        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        const result = db.prepare(`
            INSERT INTO users (username, password_hash, role)
            VALUES (?, ?, ?)
        `).run(username, passwordHash, role);
        
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            userId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

module.exports = router;

