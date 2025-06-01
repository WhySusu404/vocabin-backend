const WrongWords = require('../models/WrongWords');
const UserWordProgress = require('../models/UserWordProgress');
const DictionaryService = require('../services/DictionaryService');

// Get user's wrong words across all dictionaries or specific dictionary
const getWrongWords = async (req, res) => {
  try {
    const userId = req.user._id;
    const { dictionaryId, includeResolved = false, limit = 50, sortBy = 'urgency' } = req.query;

    let wrongWords;
    let query = { user_id: userId };

    // Add dictionary filter if specified
    if (dictionaryId) {
      if (!dictionaryId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          error: 'Invalid dictionary ID format'
        });
      }
      query.dictionary_id = dictionaryId;
    }

    // Add resolved filter
    if (includeResolved !== 'true') {
      query.is_resolved = false;
    }

    const limitNum = Math.min(parseInt(limit) || 50, 100);

    if (sortBy === 'urgency') {
      // Use aggregation pipeline for urgency sorting
      wrongWords = await WrongWords.findByUrgency(userId, limitNum);
      
      // Populate dictionary data
      await WrongWords.populate(wrongWords, { path: 'dictionary_id' });
    } else {
      // Use regular query with other sorting options
      let sortOptions = {};
      
      switch (sortBy) {
        case 'recent':
          sortOptions = { last_wrong_date: -1 };
          break;
        case 'priority':
          sortOptions = { review_priority: -1, last_wrong_date: -1 };
          break;
        case 'error_count':
          sortOptions = { error_count: -1 };
          break;
        case 'alphabetical':
          sortOptions = { word: 1 };
          break;
        default:
          sortOptions = { last_wrong_date: -1 };
      }

      wrongWords = await WrongWords.find(query)
        .populate('dictionary_id')
        .sort(sortOptions)
        .limit(limitNum);
    }

    // Calculate summary statistics
    const summaryStats = await WrongWords.aggregate([
      { $match: { user_id: userId, is_resolved: false } },
      { $group: {
        _id: null,
        total_wrong_words: { $sum: 1 },
        high_priority_words: { 
          $sum: { $cond: [{ $gte: ['$review_priority', 4] }, 1, 0] } 
        },
        total_errors: { $sum: '$error_count' },
        avg_priority: { $avg: '$review_priority' }
      }}
    ]);

    const summary = summaryStats[0] || {
      total_wrong_words: 0,
      high_priority_words: 0,
      total_errors: 0,
      avg_priority: 0
    };

    res.json({
      message: 'Wrong words retrieved successfully',
      summary: {
        total_wrong_words: summary.total_wrong_words,
        high_priority_words: summary.high_priority_words,
        total_errors: summary.total_errors,
        average_priority: Math.round(summary.avg_priority * 100) / 100
      },
      wrong_words: wrongWords.map(word => ({
        id: word._id,
        word: word.word,
        word_data: word.word_data,
        error_count: word.error_count,
        review_priority: word.review_priority,
        last_wrong_date: word.last_wrong_date,
        first_wrong_date: word.first_wrong_date,
        is_resolved: word.is_resolved,
        resolved_date: word.resolved_date,
        days_since_last_error: word.days_since_last_error,
        urgency_score: word.urgency_score,
        review_status: word.review_status,
        successful_review_rate: word.successful_review_rate,
        total_review_attempts: word.total_review_attempts,
        dictionary: word.dictionary_id ? {
          id: word.dictionary_id._id,
          name: word.dictionary_id.name,
          display_name: word.dictionary_id.display_name,
          category: word.dictionary_id.category
        } : null,
        learning_notes: word.learning_notes,
        recent_errors: word.error_details.slice(-3) // Last 3 errors
      }))
    });

  } catch (error) {
    console.error('Get wrong words error:', error);
    res.status(500).json({
      error: 'Failed to retrieve wrong words',
      message: error.message
    });
  }
};

// Get wrong words for specific dictionary
const getDictionaryWrongWords = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: dictionaryId } = req.params;
    const { includeResolved = false, limit = 50 } = req.query;

    if (!dictionaryId || !dictionaryId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    // Verify dictionary exists
    await DictionaryService.getDictionaryById(dictionaryId);

    const wrongWords = await WrongWords.findByDictionary(
      userId, 
      dictionaryId, 
      includeResolved === 'true'
    ).limit(parseInt(limit) || 50);

    // Get dictionary-specific stats
    const stats = await WrongWords.aggregate([
      { 
        $match: { 
          user_id: userId, 
          dictionary_id: dictionaryId,
          is_resolved: false 
        } 
      },
      { $group: {
        _id: null,
        total_wrong_words: { $sum: 1 },
        total_errors: { $sum: '$error_count' },
        avg_priority: { $avg: '$review_priority' },
        recent_errors: {
          $sum: {
            $cond: [
              { $gte: ['$last_wrong_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        }
      }}
    ]);

    const dictionaryStats = stats[0] || {
      total_wrong_words: 0,
      total_errors: 0,
      avg_priority: 0,
      recent_errors: 0
    };

    res.json({
      message: 'Dictionary wrong words retrieved successfully',
      dictionary_id: dictionaryId,
      stats: {
        total_wrong_words: dictionaryStats.total_wrong_words,
        total_errors: dictionaryStats.total_errors,
        average_priority: Math.round(dictionaryStats.avg_priority * 100) / 100,
        recent_errors: dictionaryStats.recent_errors
      },
      wrong_words: wrongWords
    });

  } catch (error) {
    console.error('Get dictionary wrong words error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Dictionary not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to retrieve dictionary wrong words',
      message: error.message
    });
  }
};

// Get high priority wrong words for review
const getHighPriorityWords = async (req, res) => {
  try {
    const userId = req.user._id;
    const { minPriority = 4, limit = 20 } = req.query;

    const wrongWords = await WrongWords.findHighPriority(
      userId, 
      parseInt(minPriority)
    )
    .limit(parseInt(limit) || 20)
    .sort({ review_priority: -1, last_wrong_date: -1 });

    res.json({
      message: 'High priority wrong words retrieved successfully',
      criteria: {
        min_priority: parseInt(minPriority),
        limit: parseInt(limit) || 20
      },
      wrong_words: wrongWords
    });

  } catch (error) {
    console.error('Get high priority words error:', error);
    res.status(500).json({
      error: 'Failed to retrieve high priority words',
      message: error.message
    });
  }
};

// Mark wrong word review attempt
const reviewWrongWord = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: wrongWordId } = req.params;
    const { 
      wasSuccessful, 
      reviewMethod = 'study', 
      responseTime = 0, 
      confidenceLevel = 3 
    } = req.body;

    if (!wrongWordId || !wrongWordId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid wrong word ID format'
      });
    }

    if (typeof wasSuccessful !== 'boolean') {
      return res.status(400).json({
        error: 'wasSuccessful field is required and must be boolean'
      });
    }

    const wrongWord = await WrongWords.findOne({
      _id: wrongWordId,
      user_id: userId
    }).populate('dictionary_id');

    if (!wrongWord) {
      return res.status(404).json({
        error: 'Wrong word not found'
      });
    }

    // Add review attempt
    await wrongWord.addReview(wasSuccessful, reviewMethod, responseTime, confidenceLevel);

    // If successful, also update the word progress
    if (wasSuccessful) {
      const wordProgress = await UserWordProgress.findOne({
        user_id: userId,
        dictionary_id: wrongWord.dictionary_id._id,
        word: wrongWord.word
      });

      if (wordProgress) {
        await wordProgress.recordAttempt(true, responseTime);
      }
    }

    res.json({
      message: 'Review attempt recorded successfully',
      wrong_word: {
        id: wrongWord._id,
        word: wrongWord.word,
        review_status: wrongWord.review_status,
        is_resolved: wrongWord.is_resolved,
        successful_review_rate: wrongWord.successful_review_rate,
        total_review_attempts: wrongWord.total_review_attempts
      }
    });

  } catch (error) {
    console.error('Review wrong word error:', error);
    res.status(500).json({
      error: 'Failed to record review attempt',
      message: error.message
    });
  }
};

// Manually mark wrong word as resolved
const markAsResolved = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: wrongWordId } = req.params;

    if (!wrongWordId || !wrongWordId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid wrong word ID format'
      });
    }

    const wrongWord = await WrongWords.findOne({
      _id: wrongWordId,
      user_id: userId
    });

    if (!wrongWord) {
      return res.status(404).json({
        error: 'Wrong word not found'
      });
    }

    await wrongWord.markAsResolved();

    res.json({
      message: 'Wrong word marked as resolved successfully',
      wrong_word: {
        id: wrongWord._id,
        word: wrongWord.word,
        is_resolved: wrongWord.is_resolved,
        resolved_date: wrongWord.resolved_date
      }
    });

  } catch (error) {
    console.error('Mark as resolved error:', error);
    res.status(500).json({
      error: 'Failed to mark wrong word as resolved',
      message: error.message
    });
  }
};

// Mark wrong word as unresolved (reopen for review)
const markAsUnresolved = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: wrongWordId } = req.params;

    if (!wrongWordId || !wrongWordId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid wrong word ID format'
      });
    }

    const wrongWord = await WrongWords.findOne({
      _id: wrongWordId,
      user_id: userId
    });

    if (!wrongWord) {
      return res.status(404).json({
        error: 'Wrong word not found'
      });
    }

    await wrongWord.markAsUnresolved();

    res.json({
      message: 'Wrong word marked as unresolved successfully',
      wrong_word: {
        id: wrongWord._id,
        word: wrongWord.word,
        is_resolved: wrongWord.is_resolved,
        resolved_date: wrongWord.resolved_date
      }
    });

  } catch (error) {
    console.error('Mark as unresolved error:', error);
    res.status(500).json({
      error: 'Failed to mark wrong word as unresolved',
      message: error.message
    });
  }
};

// Update learning notes for wrong word
const updateLearningNotes = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: wrongWordId } = req.params;
    const { userNotes, mnemonic, difficultyReason, personalExample } = req.body;

    if (!wrongWordId || !wrongWordId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid wrong word ID format'
      });
    }

    const wrongWord = await WrongWords.findOne({
      _id: wrongWordId,
      user_id: userId
    });

    if (!wrongWord) {
      return res.status(404).json({
        error: 'Wrong word not found'
      });
    }

    const updates = {};
    if (userNotes !== undefined) updates.user_notes = userNotes;
    if (mnemonic !== undefined) updates.mnemonic = mnemonic;
    if (difficultyReason !== undefined) updates.difficulty_reason = difficultyReason;
    if (personalExample !== undefined) updates.personal_example = personalExample;

    await wrongWord.updateLearningNotes(updates);

    res.json({
      message: 'Learning notes updated successfully',
      learning_notes: wrongWord.learning_notes
    });

  } catch (error) {
    console.error('Update learning notes error:', error);
    res.status(500).json({
      error: 'Failed to update learning notes',
      message: error.message
    });
  }
};

// Delete wrong word (remove from collection)
const deleteWrongWord = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: wrongWordId } = req.params;

    if (!wrongWordId || !wrongWordId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid wrong word ID format'
      });
    }

    const wrongWord = await WrongWords.findOne({
      _id: wrongWordId,
      user_id: userId
    });

    if (!wrongWord) {
      return res.status(404).json({
        error: 'Wrong word not found'
      });
    }

    await WrongWords.findByIdAndDelete(wrongWordId);

    res.json({
      message: 'Wrong word deleted successfully',
      deleted_word: {
        id: wrongWordId,
        word: wrongWord.word
      }
    });

  } catch (error) {
    console.error('Delete wrong word error:', error);
    res.status(500).json({
      error: 'Failed to delete wrong word',
      message: error.message
    });
  }
};

// Get wrong words analytics
const getWrongWordsAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeframe = '30' } = req.query; // days

    const days = parseInt(timeframe);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Analytics aggregation
    const analytics = await WrongWords.aggregate([
      { $match: { user_id: userId } },
      {
        $facet: {
          // Overall stats
          overall: [
            {
              $group: {
                _id: null,
                total_wrong_words: { $sum: 1 },
                resolved_words: { $sum: { $cond: ['$is_resolved', 1, 0] } },
                unresolved_words: { $sum: { $cond: ['$is_resolved', 0, 1] } },
                total_errors: { $sum: '$error_count' },
                avg_priority: { $avg: '$review_priority' }
              }
            }
          ],
          
          // Recent activity
          recent: [
            { $match: { last_wrong_date: { $gte: startDate } } },
            {
              $group: {
                _id: null,
                recent_wrong_words: { $sum: 1 },
                recent_errors: { $sum: '$error_count' }
              }
            }
          ],
          
          // By dictionary
          by_dictionary: [
            { $match: { is_resolved: false } },
            {
              $group: {
                _id: '$dictionary_id',
                wrong_words_count: { $sum: 1 },
                total_errors: { $sum: '$error_count' },
                avg_priority: { $avg: '$review_priority' }
              }
            },
            { $sort: { wrong_words_count: -1 } }
          ],
          
          // Priority distribution
          priority_distribution: [
            { $match: { is_resolved: false } },
            {
              $group: {
                _id: '$review_priority',
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    const result = analytics[0];

    res.json({
      message: 'Wrong words analytics retrieved successfully',
      timeframe_days: days,
      analytics: {
        overall: result.overall[0] || {
          total_wrong_words: 0,
          resolved_words: 0,
          unresolved_words: 0,
          total_errors: 0,
          avg_priority: 0
        },
        recent_activity: result.recent[0] || {
          recent_wrong_words: 0,
          recent_errors: 0
        },
        by_dictionary: result.by_dictionary,
        priority_distribution: result.priority_distribution
      }
    });

  } catch (error) {
    console.error('Get wrong words analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve wrong words analytics',
      message: error.message
    });
  }
};

module.exports = {
  getWrongWords,
  getDictionaryWrongWords,
  getHighPriorityWords,
  reviewWrongWord,
  markAsResolved,
  markAsUnresolved,
  updateLearningNotes,
  deleteWrongWord,
  getWrongWordsAnalytics
}; 