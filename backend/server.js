/**
 * Express server for pricing admin panel and API
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import routes
const hallsRoutes = require('./routes/halls');
const priceSetsRoutes = require('./routes/priceSets');
const hallPricesRoutes = require('./routes/hallPrices');
const extrasRoutes = require('./routes/extras');
const extrasPricesRoutes = require('./routes/extrasPrices');
const seasonRulesRoutes = require('./routes/seasonRules');
const pricingApiRoutes = require('./routes/pricingApi');
const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const servicePageRoutes = require('./routes/servicePage');

// API routes (должны быть перед статическими файлами)
app.use('/api/halls', hallsRoutes);
app.use('/api/price-sets', priceSetsRoutes);
app.use('/api/hall-prices', hallPricesRoutes);
app.use('/api/extras', extrasRoutes);
app.use('/api/extras-prices', extrasPricesRoutes);
app.use('/api/season-rules', seasonRulesRoutes);
app.use('/api/pricing', pricingApiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);

// Public service pages (важно: ДО статических файлов)
app.use('/services', servicePageRoutes);

// Admin panel routes (важно: ДО статических файлов)
app.get('/admin/login.html', (req, res) => {
    const filePath = path.join(__dirname, 'admin', 'login.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error serving login.html:', err);
            res.status(500).send('Error loading login page: ' + err.message);
        }
    });
});

app.get('/admin', (req, res) => {
    const filePath = path.join(__dirname, 'admin', 'index.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error serving index.html:', err);
            res.status(500).send('Error loading admin panel: ' + err.message);
        }
    });
});

// Serve admin static files (CSS, JS) - после роутов
app.use('/backend/admin', express.static(path.join(__dirname, 'admin')));

// Serve static files from project root (после всех специфичных роутов)
app.use(express.static(path.join(__dirname, '..')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`API endpoint: http://localhost:${PORT}/api/pricing/halls-pricing`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    process.exit(0);
});

module.exports = app;

