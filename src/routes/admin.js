const express = require('express');
const AdminController = require('../controllers/AdminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Admin Routes using existing auth system
 */

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);

/**
 * Admin Routes
 */
// GET /api/admin/dashboard/stats
router.get('/dashboard/stats', AdminController.getDashboardStats);

// GET /api/admin/users
router.get('/users', AdminController.getUsers);

// PATCH /api/admin/users/:id/toggle-status
router.patch('/users/:id/toggle-status', AdminController.toggleUserStatus);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Admin routes are healthy',
    admin: req.user.email,
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 