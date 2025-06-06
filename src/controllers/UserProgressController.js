const UserDictionary = require('../models/UserDictionary');
const UserWordProgress = require('../models/UserWordProgress');
const WrongWords = require('../models/WrongWords');
const DictionaryService = require('../services/DictionaryService');

// Get user's progress across all dictionaries
const getUserDictionaries = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user's dictionary progress
    const userDictionaries = await UserDictionary.findByUser(userId);
    
    // Get all available dictionaries for comparison
    const allDictionaries = await DictionaryService.getAllDictionaries();
    
    // Create a map of user's progress
    const progressMap = new Map();
    userDictionaries.forEach(userDict => {
      progressMap.set(userDict.dictionary_id._id.toString(), userDict);
    });
    
    // Combine all dictionaries with user progress
    const dictionariesWithProgress = allDictionaries.map(dict => {
      const userProgress = progressMap.get(dict._id.toString());
      
      return {
        dictionary: {
          id: dict._id,
          name: dict.name,
          display_name: dict.display_name,
          description: dict.description,
          total_words: dict.total_words,
          difficulty_level: dict.difficulty_level,
          category: dict.category,
          estimated_study_time: dict.estimatedStudyTime
        },
        progress: userProgress ? {
          id: userProgress._id,
          completed_words: userProgress.completed_words,
          correct_answers: userProgress.correct_answers,
          wrong_answers: userProgress.wrong_answers,
          current_position: userProgress.current_position,
          status: userProgress.status,
          accuracy_rate: userProgress.accuracy_rate,
          completion_percentage: userProgress.completion_percentage,
          progress_status: userProgress.progress_status,
          last_accessed: userProgress.last_accessed,
          started_at: userProgress.started_at,
          completed_at: userProgress.completed_at,
          session_stats: userProgress.session_stats
        } : null
      };
    });
    
    // Calculate summary statistics
    const summary = {
      total_dictionaries: allDictionaries.length,
      started_dictionaries: userDictionaries.length,
      completed_dictionaries: userDictionaries.filter(d => d.status === 'completed').length,
      in_progress_dictionaries: userDictionaries.filter(d => d.status === 'in_progress').length,
      total_words_learned: userDictionaries.reduce((sum, d) => sum + d.completed_words, 0),
      total_correct_answers: userDictionaries.reduce((sum, d) => sum + d.correct_answers, 0),
      total_wrong_answers: userDictionaries.reduce((sum, d) => sum + d.wrong_answers, 0),
      overall_accuracy: 0
    };
    
    const totalAttempts = summary.total_correct_answers + summary.total_wrong_answers;
    if (totalAttempts > 0) {
      summary.overall_accuracy = Math.round((summary.total_correct_answers / totalAttempts) * 100 * 100) / 100;
    }

    res.json({
      message: 'User dictionaries retrieved successfully',
      summary,
      dictionaries: dictionariesWithProgress
    });

  } catch (error) {
    console.error('Get user dictionaries error:', error);
    res.status(500).json({
      error: 'Failed to retrieve user dictionaries',
      message: error.message
    });
  }
};

// Start or resume learning a dictionary
const startDictionary = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: dictionaryId } = req.params;
    
    if (!dictionaryId || !dictionaryId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    // Verify dictionary exists and is active
    const dictionary = await DictionaryService.getDictionaryById(dictionaryId);
    
    // Use findOneAndUpdate with upsert to avoid duplicate key errors
    let userDictionary = await UserDictionary.findOneAndUpdate(
      {
        user_id: userId,
        dictionary_id: dictionaryId
      },
      {
        $setOnInsert: {
          user_id: userId,
          dictionary_id: dictionaryId,
          total_words: dictionary.total_words,
          status: 'in_progress',
          started_at: new Date(),
          completed_words: 0,
          correct_answers: 0,
          wrong_answers: 0,
          current_position: 0
        },
        $set: {
          last_accessed: new Date()
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ).populate('dictionary_id');

    // If the record was just created and no dictionary_id populated, do it manually
    if (!userDictionary.dictionary_id) {
      userDictionary = await UserDictionary.findById(userDictionary._id).populate('dictionary_id');
    }

    // For existing records, update status to in_progress if needed
    if (userDictionary.status !== 'in_progress' && userDictionary.status !== 'completed') {
      userDictionary.status = 'in_progress';
      await userDictionary.save();
    }

    res.json({
      message: 'Dictionary started successfully',
      userDictionary: {
        id: userDictionary._id,
        dictionary: {
          id: dictionary._id,
          name: dictionary.name,
          display_name: dictionary.display_name,
          total_words: dictionary.total_words,
          difficulty_level: dictionary.difficulty_level,
          category: dictionary.category
        },
        progress: {
          completed_words: userDictionary.completed_words,
          current_position: userDictionary.current_position,
          status: userDictionary.status,
          accuracy_rate: userDictionary.accuracy_rate,
          completion_percentage: userDictionary.completion_percentage,
          started_at: userDictionary.started_at
        }
      }
    });

  } catch (error) {
    console.error('Start dictionary error:', error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      // Race condition occurred, try to find the existing record
      try {
        const existingUserDictionary = await UserDictionary.findOne({
          user_id: req.user._id,
          dictionary_id: req.params.id
        }).populate('dictionary_id');
        
        if (existingUserDictionary) {
          // Update the existing record and return it
          existingUserDictionary.status = 'in_progress';
          existingUserDictionary.last_accessed = new Date();
          await existingUserDictionary.save();
          
          const dictionary = await DictionaryService.getDictionaryById(req.params.id);
          
          return res.json({
            message: 'Dictionary resumed successfully',
            userDictionary: {
              id: existingUserDictionary._id,
              dictionary: {
                id: dictionary._id,
                name: dictionary.name,
                display_name: dictionary.display_name,
                total_words: dictionary.total_words,
                difficulty_level: dictionary.difficulty_level,
                category: dictionary.category
              },
              progress: {
                completed_words: existingUserDictionary.completed_words,
                current_position: existingUserDictionary.current_position,
                status: existingUserDictionary.status,
                accuracy_rate: existingUserDictionary.accuracy_rate,
                completion_percentage: existingUserDictionary.completion_percentage,
                started_at: existingUserDictionary.started_at
              }
            }
          });
        }
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
      }
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Dictionary not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to start dictionary',
      message: error.message
    });
  }
};

// Get current word for learning
const getCurrentWord = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: dictionaryId } = req.params;
    
    console.log('🔍 DEBUG: getCurrentWord called', { userId, dictionaryId });
    
    if (!dictionaryId || !dictionaryId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ Invalid dictionary ID format:', dictionaryId);
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    // First, check if dictionary exists
    let dictionary;
    try {
      dictionary = await DictionaryService.getDictionaryById(dictionaryId);
      console.log('✅ Dictionary found:', dictionary.display_name);
    } catch (error) {
      console.log('❌ Dictionary not found:', error.message);
      return res.status(404).json({
        error: 'Dictionary not found',
        message: error.message
      });
    }

    // Get user's progress for this dictionary
    let userDictionary = await UserDictionary.findOne({
      user_id: userId,
      dictionary_id: dictionaryId
    }).populate('dictionary_id');

    // **CRITICAL FIX**: If no progress exists for fresh user, auto-initialize it
    if (!userDictionary) {
      console.log('🔧 No UserDictionary found, auto-initializing for fresh user');
      
      // Create new UserDictionary record for fresh user
      userDictionary = new UserDictionary({
        user_id: userId,
        dictionary_id: dictionaryId,
        total_words: dictionary.total_words,
        status: 'in_progress',
        started_at: new Date(),
        completed_words: 0,
        correct_answers: 0,
        wrong_answers: 0,
        current_position: 0,
        last_accessed: new Date()
      });
      
      await userDictionary.save();
      
      // Populate the dictionary_id field
      userDictionary = await UserDictionary.findById(userDictionary._id).populate('dictionary_id');
      
      console.log('✅ Auto-initialized UserDictionary for fresh user:', userId, 'dictionary:', dictionaryId);
    }

    if (userDictionary.status === 'completed') {
      console.log('⚠️ Dictionary already completed');
      return res.status(400).json({
        error: 'Dictionary already completed',
        message: 'All words in this dictionary have been completed'
      });
    }

    // Get the current word with better error handling
    const currentWordIndex = userDictionary.current_position;
    console.log('🔍 Getting word at index:', currentWordIndex);
    
    let word;
    try {
      word = await DictionaryService.getWordByIndex(dictionaryId, currentWordIndex);
      console.log('✅ Word retrieved:', word.name);
    } catch (error) {
      console.log('❌ Failed to get word by index:', error.message);
      return res.status(404).json({
        error: 'Word not found',
        message: `Word at index ${currentWordIndex} not found: ${error.message}`
      });
    }
    
    // Check if user has previous progress with this word
    const wordProgress = await UserWordProgress.findOne({
      user_id: userId,
      dictionary_id: dictionaryId,
      word: word.name
    });

    console.log('✅ getCurrentWord success for user:', userId);
    
    res.json({
      message: 'Current word retrieved successfully',
      word: {
        ...word,
        progress: wordProgress ? {
          correct_attempts: wordProgress.correct_attempts,
          wrong_attempts: wordProgress.wrong_attempts,
          mastery_level: wordProgress.mastery_level,
          is_mastered: wordProgress.is_mastered,
          learning_status: wordProgress.learning_status
        } : null
      },
      dictionary_progress: {
        current_position: userDictionary.current_position,
        total_words: userDictionary.total_words,
        completed_words: userDictionary.completed_words,
        completion_percentage: userDictionary.completion_percentage,
        overall: {
          completed_words: userDictionary.completed_words,
          accuracy_rate: userDictionary.accuracy_rate || 0,
          correct_answers: userDictionary.correct_answers || 0,
          wrong_answers: userDictionary.wrong_answers || 0,
          status: userDictionary.status,
          current_position: userDictionary.current_position
        }
      }
    });

  } catch (error) {
    console.error('❌ Get current word error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // More specific error handling
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Resource not found',
        message: error.message
      });
    }
    
    if (error.message.includes('out of range')) {
      return res.status(404).json({
        error: 'Word index out of range',
        message: error.message
      });
    }
    
    if (error.message.includes('ENOENT') || error.message.includes('file')) {
      return res.status(500).json({
        error: 'Dictionary file not found',
        message: 'Dictionary file is missing or inaccessible'
      });
    }
    
    res.status(500).json({
      error: 'Failed to get current word',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Submit answer for a word
const submitWordAnswer = async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      dictionaryId, 
      word, 
      wordIndex,
      isCorrect, 
      userAnswer, 
      responseTime = 0,
      userDifficulty = null 
    } = req.body;

    // Validation
    if (!dictionaryId || !word || typeof isCorrect !== 'boolean') {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['dictionaryId', 'word', 'isCorrect']
      });
    }

    if (!dictionaryId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    // Get user's dictionary progress
    const userDictionary = await UserDictionary.findOne({
      user_id: userId,
      dictionary_id: dictionaryId
    });

    if (!userDictionary) {
      return res.status(404).json({
        error: 'Dictionary progress not found',
        message: 'Please start the dictionary first'
      });
    }

    // Update user dictionary progress
    await userDictionary.updateProgress(isCorrect, responseTime);

    // Create or update word progress
    let wordProgress = await UserWordProgress.findOne({
      user_id: userId,
      dictionary_id: dictionaryId,
      word: word
    });

    if (wordProgress) {
      await wordProgress.recordAttempt(isCorrect, responseTime, userDifficulty);
    } else {
      wordProgress = new UserWordProgress({
        user_id: userId,
        dictionary_id: dictionaryId,
        word: word,
        word_index: wordIndex || userDictionary.current_position,
        correct_attempts: isCorrect ? 1 : 0,
        wrong_attempts: isCorrect ? 0 : 1,
        difficulty_rating: userDifficulty || 3
      });
      
      await wordProgress.recordAttempt(isCorrect, responseTime, userDifficulty);
    }

    // If answer is wrong, add to wrong words collection
    if (!isCorrect) {
      const wordData = await DictionaryService.getWordByIndex(dictionaryId, wordIndex || userDictionary.current_position);
      
      let wrongWord = await WrongWords.findOne({
        user_id: userId,
        dictionary_id: dictionaryId,
        word: word
      });

      if (wrongWord) {
        await wrongWord.addError(userAnswer, wordData.trans ? wordData.trans[0] : '', 'meaning');
      } else {
        wrongWord = new WrongWords({
          user_id: userId,
          dictionary_id: dictionaryId,
          word: word,
          word_data: wordData
        });
        
        await wrongWord.addError(userAnswer, wordData.trans ? wordData.trans[0] : '', 'meaning');
      }
    }

    // Advance to next word
    await userDictionary.advancePosition();

    // Get next word (if available)
    let nextWord = null;
    if (userDictionary.current_position < userDictionary.total_words) {
      try {
        nextWord = await DictionaryService.getWordByIndex(dictionaryId, userDictionary.current_position);
      } catch (error) {
        // End of dictionary reached
        nextWord = null;
      }
    }

    res.json({
      message: 'Answer submitted successfully',
      result: {
        correct: isCorrect,
        word_progress: {
          mastery_level: wordProgress.mastery_level,
          is_mastered: wordProgress.is_mastered,
          total_attempts: wordProgress.total_attempts,
          accuracy_percentage: wordProgress.accuracy_percentage
        },
        dictionary_progress: {
          current_position: userDictionary.current_position,
          completed_words: userDictionary.completed_words,
          completion_percentage: userDictionary.completion_percentage,
          accuracy_rate: userDictionary.accuracy_rate,
          status: userDictionary.status
        },
        next_word: nextWord
      }
    });

  } catch (error) {
    console.error('Submit word answer error:', error);
    res.status(500).json({
      error: 'Failed to submit answer',
      message: error.message
    });
  }
};

// Get detailed progress for specific dictionary
const getDictionaryProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: dictionaryId } = req.params;
    
    if (!dictionaryId || !dictionaryId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    // Get user's dictionary progress
    let userDictionary = await UserDictionary.findOne({
      user_id: userId,
      dictionary_id: dictionaryId
    }).populate('dictionary_id');

    // **CRITICAL FIX**: If no progress exists for fresh user, return default progress instead of 404
    if (!userDictionary) {
      // Get dictionary info to create default progress
      const dictionary = await DictionaryService.getDictionaryById(dictionaryId);
      
      // Return default/empty progress structure
      return res.json({
        message: 'No progress found - returning default progress for fresh user',
        progress: {
          dictionary: {
            id: dictionary._id,
            name: dictionary.name,
            display_name: dictionary.display_name,
            total_words: dictionary.total_words
          },
          overall: {
            status: 'not_started',
            current_position: 0,
            completed_words: 0,
            completion_percentage: 0,
            accuracy_rate: 0,
            correct_answers: 0,
            wrong_answers: 0,
            started_at: null,
            completed_at: null,
            last_accessed: null
          },
          session_stats: {
            session_count: 0,
            total_session_time: 0,
            average_session_time: 0,
            last_session_date: null
          },
          word_level_stats: {
            words_attempted: 0,
            mastered_words: 0,
            average_mastery_level: 0,
            wrong_words_count: 0
          },
          settings: {
            difficulty_preference: 'medium',
            study_mode: 'normal',
            auto_advance: true,
            show_hints: false
          }
        }
      });
    }

    // Get word-level progress statistics
    const wordProgressStats = await UserWordProgress.aggregate([
      { $match: { user_id: userId, dictionary_id: userDictionary.dictionary_id._id } },
      { $group: {
        _id: null,
        total_words_attempted: { $sum: 1 },
        mastered_words: { $sum: { $cond: ['$is_mastered', 1, 0] } },
        average_mastery_level: { $avg: '$mastery_level' },
        total_correct: { $sum: '$correct_attempts' },
        total_wrong: { $sum: '$wrong_attempts' }
      }}
    ]);

    // Get wrong words count
    const wrongWordsCount = await WrongWords.countDocuments({
      user_id: userId,
      dictionary_id: dictionaryId,
      is_resolved: false
    });

    const stats = wordProgressStats[0] || {
      total_words_attempted: 0,
      mastered_words: 0,
      average_mastery_level: 0,
      total_correct: 0,
      total_wrong: 0
    };

    res.json({
      message: 'Dictionary progress retrieved successfully',
      progress: {
        dictionary: {
          id: userDictionary.dictionary_id._id,
          name: userDictionary.dictionary_id.name,
          display_name: userDictionary.dictionary_id.display_name,
          total_words: userDictionary.dictionary_id.total_words
        },
        overall: {
          status: userDictionary.status,
          current_position: userDictionary.current_position,
          completed_words: userDictionary.completed_words,
          completion_percentage: userDictionary.completion_percentage,
          accuracy_rate: userDictionary.accuracy_rate,
          correct_answers: userDictionary.correct_answers,
          wrong_answers: userDictionary.wrong_answers,
          started_at: userDictionary.started_at,
          completed_at: userDictionary.completed_at,
          last_accessed: userDictionary.last_accessed
        },
        session_stats: userDictionary.session_stats,
        word_level_stats: {
          words_attempted: stats.total_words_attempted,
          mastered_words: stats.mastered_words,
          average_mastery_level: Math.round(stats.average_mastery_level * 100) / 100,
          wrong_words_count: wrongWordsCount
        },
        settings: userDictionary.settings
      }
    });

  } catch (error) {
    console.error('Get dictionary progress error:', error);
    res.status(500).json({
      error: 'Failed to retrieve dictionary progress',
      message: error.message
    });
  }
};

// Update learning progress manually
const updateProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: dictionaryId } = req.params;
    const { currentPosition, settings } = req.body;
    
    if (!dictionaryId || !dictionaryId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid dictionary ID format'
      });
    }

    const userDictionary = await UserDictionary.findOne({
      user_id: userId,
      dictionary_id: dictionaryId
    });

    if (!userDictionary) {
      return res.status(404).json({
        error: 'Dictionary progress not found'
      });
    }

    // Update position if provided
    if (currentPosition !== undefined) {
      if (currentPosition < 0 || currentPosition > userDictionary.total_words) {
        return res.status(400).json({
          error: 'Invalid current position'
        });
      }
      
      userDictionary.current_position = currentPosition;
      userDictionary.completed_words = Math.max(userDictionary.completed_words, currentPosition);
    }

    // Update settings if provided
    if (settings) {
      userDictionary.settings = { ...userDictionary.settings, ...settings };
    }

    userDictionary.last_accessed = new Date();
    await userDictionary.save();

    res.json({
      message: 'Progress updated successfully',
      progress: {
        current_position: userDictionary.current_position,
        completed_words: userDictionary.completed_words,
        completion_percentage: userDictionary.completion_percentage,
        settings: userDictionary.settings
      }
    });

  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({
      error: 'Failed to update progress',
      message: error.message
    });
  }
};

module.exports = {
  getUserDictionaries,
  startDictionary,
  getCurrentWord,
  submitWordAnswer,
  getDictionaryProgress,
  updateProgress
}; 