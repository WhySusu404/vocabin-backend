const express = require('express');
const { register, login, logout, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// @route   POST /auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', register);

// @route   POST /auth/login
// @desc    Login user
// @access  Public
router.post('/login', login);

// @route   POST /auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, logout);

// @route   GET /auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', authenticate, getProfile);

// @route   GET /auth/test
// @desc    Test authentication
// @access  Private
router.get('/test', authenticate, (req, res) => {
  res.json({
    message: 'Authentication successful',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 