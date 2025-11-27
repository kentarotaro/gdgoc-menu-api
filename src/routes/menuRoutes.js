// File: src/routes/menuRoutes.js
const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { rateLimitAI } = require('../middleware/rateLimiter');

// GET routes
router.get('/', menuController.getAllMenus);
router.get('/stats/category-counts', menuController.getMenuStats);
router.get('/grouped', menuController.getMenuGrouped);
router.get('/search', menuController.searchMenu);
router.get('/group-by-category', menuController.getMenuByGroup);
router.get('/:id', menuController.getMenuById);

// POST routes
router.post('/', menuController.createMenu);

// PUT routes
router.put('/:id', menuController.updateMenu);

// DELETE routes
router.delete('/:id', menuController.deleteMenu);

// AI-powered routes with rate limiting
router.post('/ai/generate-description', rateLimitAI, menuController.generateDescription);
router.post('/ai/estimate-calories', rateLimitAI, menuController.generateCalories);
router.post('/ai/estimate-price', rateLimitAI, menuController.generatePrice);

module.exports = router;