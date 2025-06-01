const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const WrongWordsController = require('../controllers/WrongWordsController');

// All routes require authentication
router.use(authenticate);

// GET /api/wrong-words - Get user's wrong words across all dictionaries
router.get('/', WrongWordsController.getWrongWords);

// GET /api/wrong-words/dictionaries/:id - Get wrong words for specific dictionary
router.get('/dictionaries/:id', WrongWordsController.getDictionaryWrongWords);

// GET /api/wrong-words/high-priority - Get high priority wrong words for review
router.get('/high-priority', WrongWordsController.getHighPriorityWords);

// GET /api/wrong-words/analytics - Get wrong words analytics
router.get('/analytics', WrongWordsController.getWrongWordsAnalytics);

// POST /api/wrong-words/:id/review - Mark wrong word review attempt
router.post('/:id/review', WrongWordsController.reviewWrongWord);

// PUT /api/wrong-words/:id/resolved - Mark wrong word as resolved
router.put('/:id/resolved', WrongWordsController.markAsResolved);

// PUT /api/wrong-words/:id/unresolved - Mark wrong word as unresolved
router.put('/:id/unresolved', WrongWordsController.markAsUnresolved);

// PUT /api/wrong-words/:id/notes - Update learning notes for wrong word
router.put('/:id/notes', WrongWordsController.updateLearningNotes);

// DELETE /api/wrong-words/:id - Delete wrong word
router.delete('/:id', WrongWordsController.deleteWrongWord);

module.exports = router; 