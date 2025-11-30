/**
 * Script to create default admin user
 * Usage: node backend/create-user.js
 */

const bcrypt = require('bcryptjs');
const { initDatabase } = require('./database');

async function createDefaultUser() {
    const db = initDatabase();
    
    // Check if admin user exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    
    if (existing) {
        console.log('Admin user already exists');
        return;
    }
    
    // Create default admin user (username: admin, password: admin123)
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    const result = db.prepare(`
        INSERT INTO users (username, password_hash, role)
        VALUES (?, ?, ?)
    `).run('admin', passwordHash, 'admin');
    
    console.log('Default admin user created!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Please change the password after first login!');
}

createDefaultUser().catch(console.error);

