const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const DictionaryController = require('../controllers/DictionaryController');

// Public routes (no authentication required)
// GET /api/dictionaries - Get all dictionaries
router.get('/', DictionaryController.getAllDictionaries);

// GET /api/dictionaries/:id - Get specific dictionary by ID
router.get('/:id', DictionaryController.getDictionaryById);

// GET /api/dictionaries/:id/stats - Get dictionary statistics
router.get('/:id/stats', DictionaryController.getDictionaryStats);

// GET /api/dictionaries/:id/words - Get words from dictionary (paginated)
router.get('/:id/words', DictionaryController.getDictionaryWords);

// GET /api/dictionaries/:id/words/:index - Get specific word by index
router.get('/:id/words/:index', DictionaryController.getWordByIndex);

// GET /api/dictionaries/:id/search - Search words in dictionary
router.get('/:id/search', DictionaryController.searchWords);

// GET /api/dictionaries/:id/random - Get random words from dictionary
router.get('/:id/random', DictionaryController.getRandomWords);

// Protected routes (authentication required)
// GET /api/dictionaries/:id/validate - Validate dictionary file structure
router.get('/:id/validate', authenticate, DictionaryController.validateDictionary);

// Admin only routes
// POST /api/dictionaries/initialize - Initialize/reload dictionaries from files
router.post('/initialize', authenticate, DictionaryController.initializeDictionaries);

// DELETE /api/dictionaries/cache - Clear dictionary cache
router.delete('/cache', authenticate, DictionaryController.clearCache);

module.exports = router; 