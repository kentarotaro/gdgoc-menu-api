const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment
dotenv.config();

// Import utilities
const { getRealIP } = require('./src/middleware/rateLimiter');
const log = require('./src/utils/logger');

// Import routes
const menuRoutes = require('./src/routes/menuRoutes');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: " Menu API Server Running",
        version: "3.0.0 (MVC Architecture)",
        endpoints: {
            menu: "/menu",
            ai: "/menu/ai",
            docs: "/debug/ip-info"
        }
    });
});

// Debug endpoint
app.get('/debug/ip-info', (req, res) => {
    res.json({
        detected_ip: getRealIP(req),
        headers: {
            'cf-connecting-ip': req.headers['cf-connecting-ip'],
            'x-real-ip': req.headers['x-real-ip'],
            'x-forwarded-for': req.headers['x-forwarded-for']
        }
    });
});

// Use routes
app.use('/menu', menuRoutes);

// error handling for unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Endpoint tidak ditemukan",
        requested_url: req.originalUrl
    });
});

// start server
app.listen(PORT, () => {
    log.success(`Server running on http://localhost:${PORT}`);
    log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});