const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const UserProgressController = require('../controllers/UserProgressController');

// All routes require authentication
router.use(authenticate);

// GET /api/user/dictionaries - Get user's progress across all dictionaries
router.get('/dictionaries', UserProgressController.getUserDictionaries);

// POST /api/user/dictionaries/:id/start - Start learning a dictionary
router.post('/dictionaries/:id/start', UserProgressController.startDictionary);

// GET /api/user/dictionaries/:id/current-word - Get current word for learning
router.get('/dictionaries/:id/current-word', UserProgressController.getCurrentWord);

// GET /api/user/dictionaries/:id/progress - Get detailed progress for specific dictionary
router.get('/dictionaries/:id/progress', UserProgressController.getDictionaryProgress);

// PUT /api/user/dictionaries/:id/progress - Update learning progress
router.put('/dictionaries/:id/progress', UserProgressController.updateProgress);

// POST /api/user/word-answer - Submit answer for a word
router.post('/word-answer', UserProgressController.submitWordAnswer);

module.exports = router; 