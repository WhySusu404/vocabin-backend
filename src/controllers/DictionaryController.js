const DictionaryService = require('../services/DictionaryService');
const { DictionaryLoader } = require('../scripts/loadDictionaries');

// Get all dictionaries
const getAllDictionaries = async (req, res) => {
  try {
    const { category, difficulty } = req.query;
    
    let dictionaries;
    
    if (category) {
      dictionaries = await DictionaryService.getDictionariesByCategory(category);
    } else if (difficulty) {
      dictionaries = await DictionaryService.getDictionariesByDifficulty(difficulty);
    } else {
      dictionaries = await DictionaryService.getAllDictionaries();
    }

    // Add summary statistics
    const summary = {
      total_dictionaries: dictionaries.length,
      total_words: dictionaries.reduce((sum, dict) => sum + dict.total_words, 0),
      categories: [...new Set(dictionaries.map(dict => dict.category))],
      difficulty_levels: [...new Set(dictionaries.map(dict => dict.difficulty_level))]
    };

    res.json({
      message: 'Dictionaries retrieved successfully',
      summary,
      dictionaries
    });

  } catch (error) {
    console.error('Get dictionaries error:', error);
    res.status(500).json({
      error: 'Failed to retrieve dictionaries',
      message: error.message
    });
  }
};

// Get specific dictionary by ID
const getDictionaryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    const dictionary = await DictionaryService.getDictionaryById(id);
    
    res.json({
      message: 'Dictionary retrieved successfully',
      dictionary
    });

  } catch (error) {
    console.error('Get dictionary error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Dictionary not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to retrieve dictionary',
      message: error.message
    });
  }
};

// Get dictionary statistics
const getDictionaryStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    const stats = await DictionaryService.getDictionaryStats(id);
    
    res.json({
      message: 'Dictionary statistics retrieved successfully',
      stats
    });

  } catch (error) {
    console.error('Get dictionary stats error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Dictionary not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to retrieve dictionary statistics',
      message: error.message
    });
  }
};

// Get words from dictionary with pagination
const getDictionaryWords = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 50, 
      start_index = null 
    } = req.query;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    // Validate query parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = start_index ? parseInt(start_index) : null;

    if (pageNum < 1) {
      return res.status(400).json({
        error: 'Page number must be greater than 0'
      });
    }

    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 100'
      });
    }

    if (startIndex !== null && startIndex < 0) {
      return res.status(400).json({
        error: 'Start index cannot be negative'
      });
    }

    const result = await DictionaryService.getDictionaryWords(
      id, 
      pageNum, 
      limitNum, 
      startIndex
    );
    
    res.json({
      message: 'Dictionary words retrieved successfully',
      ...result
    });

  } catch (error) {
    console.error('Get dictionary words error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Dictionary not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to retrieve dictionary words',
      message: error.message
    });
  }
};

// Get specific word by index
const getWordByIndex = async (req, res) => {
  try {
    const { id, index } = req.params;
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    const wordIndex = parseInt(index);
    if (isNaN(wordIndex) || wordIndex < 0) {
      return res.status(400).json({
        error: 'Invalid word index'
      });
    }

    const word = await DictionaryService.getWordByIndex(id, wordIndex);
    
    res.json({
      message: 'Word retrieved successfully',
      word
    });

  } catch (error) {
    console.error('Get word by index error:', error);
    
    if (error.message.includes('not found') || error.message.includes('out of range')) {
      return res.status(404).json({
        error: 'Word not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to retrieve word',
      message: error.message
    });
  }
};

// Search words in dictionary
const searchWords = async (req, res) => {
  try {
    const { id } = req.params;
    const { q: searchTerm, limit = 20 } = req.query;
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    if (!searchTerm || searchTerm.trim().length === 0) {
      return res.status(400).json({
        error: 'Search term is required'
      });
    }

    if (searchTerm.length < 2) {
      return res.status(400).json({
        error: 'Search term must be at least 2 characters long'
      });
    }

    const limitNum = parseInt(limit);
    if (limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 50'
      });
    }

    const result = await DictionaryService.searchWordsInDictionary(
      id, 
      searchTerm.trim(), 
      limitNum
    );
    
    res.json({
      message: 'Search completed successfully',
      ...result
    });

  } catch (error) {
    console.error('Search words error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Dictionary not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to search words',
      message: error.message
    });
  }
};

// Get random words from dictionary
const getRandomWords = async (req, res) => {
  try {
    const { id } = req.params;
    const { count = 10 } = req.query;
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    const countNum = parseInt(count);
    if (countNum < 1 || countNum > 50) {
      return res.status(400).json({
        error: 'Count must be between 1 and 50'
      });
    }

    const result = await DictionaryService.getRandomWords(id, countNum);
    
    res.json({
      message: 'Random words retrieved successfully',
      ...result
    });

  } catch (error) {
    console.error('Get random words error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Dictionary not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to retrieve random words',
      message: error.message
    });
  }
};

// Validate dictionary file
const validateDictionary = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    const validation = await DictionaryService.validateDictionaryFile(id);
    
    res.json({
      message: 'Dictionary validation completed',
      validation
    });

  } catch (error) {
    console.error('Validate dictionary error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Dictionary not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to validate dictionary',
      message: error.message
    });
  }
};

// Initialize/reload dictionaries (admin only)
const initializeDictionaries = async (req, res) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only admin users can initialize dictionaries'
      });
    }

    const loader = new DictionaryLoader();
    
    // Connect to database (reuse existing connection)
    const report = await loader.loadAllDictionaries();
    
    // Clear cache after reload
    DictionaryService.clearCache();
    
    res.json({
      message: 'Dictionaries initialized successfully',
      report
    });

  } catch (error) {
    console.error('Initialize dictionaries error:', error);
    res.status(500).json({
      error: 'Failed to initialize dictionaries',
      message: error.message
    });
  }
};

// Clear dictionary cache (admin only)
const clearCache = async (req, res) => {
  try {
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only admin users can clear cache'
      });
    }

    const { dictionary_name } = req.query;
    
    if (dictionary_name) {
      DictionaryService.clearDictionaryCache(dictionary_name);
    } else {
      DictionaryService.clearCache();
    }
    
    res.json({
      message: dictionary_name ? 
        `Cache cleared for dictionary: ${dictionary_name}` : 
        'All dictionary cache cleared',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
};

module.exports = {
  getAllDictionaries,
  getDictionaryById,
  getDictionaryStats,
  getDictionaryWords,
  getWordByIndex,
  searchWords,
  getRandomWords,
  validateDictionary,
  initializeDictionaries,
  clearCache
}; 