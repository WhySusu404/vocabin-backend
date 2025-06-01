const mongoose = require('mongoose');

const userWordProgressSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  dictionary_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dictionary',
    required: [true, 'Dictionary ID is required'],
    index: true
  },
  word: {
    type: String,
    required: [true, 'Word is required'],
    trim: true,
    index: true
  },
  word_index: {
    type: Number,
    required: [true, 'Word index is required'],
    min: [0, 'Word index cannot be negative']
  },
  correct_attempts: {
    type: Number,
    default: 0,
    min: [0, 'Correct attempts cannot be negative']
  },
  wrong_attempts: {
    type: Number,
    default: 0,
    min: [0, 'Wrong attempts cannot be negative']
  },
  mastery_level: {
    type: Number,
    default: 0,
    min: [0, 'Mastery level cannot be negative'],
    max: [5, 'Mastery level cannot exceed 5']
  },
  last_reviewed: {
    type: Date,
    default: Date.now
  },
  first_learned: {
    type: Date,
    default: Date.now
  },
  next_review: {
    type: Date,
    default: Date.now,
    index: true
  },
  is_mastered: {
    type: Boolean,
    default: false,
    index: true
  },
  difficulty_rating: {
    type: Number,
    min: [1, 'Difficulty rating must be at least 1'],
    max: [5, 'Difficulty rating cannot exceed 5'],
    default: 3
  },
  spaced_repetition: {
    interval: {
      type: Number, // days
      default: 1
    },
    ease_factor: {
      type: Number,
      default: 2.5,
      min: [1.3, 'Ease factor cannot be less than 1.3']
    },
    repetition: {
      type: Number,
      default: 0
    }
  },
  learning_history: [{
    attempt_date: {
      type: Date,
      default: Date.now
    },
    was_correct: {
      type: Boolean,
      required: true
    },
    response_time: {
      type: Number, // in milliseconds
      default: 0
    },
    difficulty_after: {
      type: Number,
      min: [1, 'Difficulty after must be at least 1'],
      max: [5, 'Difficulty after cannot exceed 5']
    }
  }],
  performance_metrics: {
    average_response_time: {
      type: Number, // in milliseconds
      default: 0
    },
    accuracy_rate: {
      type: Number,
      default: 0,
      min: [0, 'Accuracy rate cannot be negative'],
      max: [100, 'Accuracy rate cannot exceed 100']
    },
    consecutive_correct: {
      type: Number,
      default: 0
    },
    consecutive_wrong: {
      type: Number,
      default: 0
    },
    last_streak: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
userWordProgressSchema.index({ user_id: 1, dictionary_id: 1, word: 1 }, { unique: true });
userWordProgressSchema.index({ user_id: 1, next_review: 1 });
userWordProgressSchema.index({ user_id: 1, dictionary_id: 1, mastery_level: 1 });
userWordProgressSchema.index({ user_id: 1, dictionary_id: 1, is_mastered: 1 });

// Virtual for total attempts
userWordProgressSchema.virtual('total_attempts').get(function() {
  return this.correct_attempts + this.wrong_attempts;
});

// Virtual for accuracy percentage
userWordProgressSchema.virtual('accuracy_percentage').get(function() {
  const total = this.total_attempts;
  if (total === 0) return 0;
  return Math.round((this.correct_attempts / total) * 100 * 100) / 100;
});

// Virtual for days until next review
userWordProgressSchema.virtual('days_until_review').get(function() {
  const now = new Date();
  const reviewDate = new Date(this.next_review);
  const diffTime = reviewDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for is due for review
userWordProgressSchema.virtual('is_due_for_review').get(function() {
  return new Date() >= new Date(this.next_review);
});

// Virtual for learning status
userWordProgressSchema.virtual('learning_status').get(function() {
  if (this.is_mastered) return 'Mastered';
  if (this.mastery_level >= 4) return 'Nearly Mastered';
  if (this.mastery_level >= 2) return 'Learning';
  if (this.total_attempts === 0) return 'New';
  return 'Struggling';
});

// Static method to find words due for review
userWordProgressSchema.statics.findDueForReview = function(userId, dictionaryId = null) {
  const query = {
    user_id: userId,
    next_review: { $lte: new Date() },
    is_mastered: false
  };
  
  if (dictionaryId) {
    query.dictionary_id = dictionaryId;
  }
  
  return this.find(query).populate('dictionary_id');
};

// Static method to find mastered words
userWordProgressSchema.statics.findMastered = function(userId, dictionaryId = null) {
  const query = {
    user_id: userId,
    is_mastered: true
  };
  
  if (dictionaryId) {
    query.dictionary_id = dictionaryId;
  }
  
  return this.find(query).populate('dictionary_id');
};

// Static method to find struggling words (low mastery level)
userWordProgressSchema.statics.findStrugglingWords = function(userId, dictionaryId = null) {
  const query = {
    user_id: userId,
    mastery_level: { $lt: 2 },
    total_attempts: { $gt: 0 },
    is_mastered: false
  };
  
  if (dictionaryId) {
    query.dictionary_id = dictionaryId;
  }
  
  return this.find(query).populate('dictionary_id');
};

// Instance method to record attempt
userWordProgressSchema.methods.recordAttempt = function(isCorrect, responseTime = 0, userDifficulty = null) {
  // Update basic stats
  if (isCorrect) {
    this.correct_attempts += 1;
    this.performance_metrics.consecutive_correct += 1;
    this.performance_metrics.consecutive_wrong = 0;
  } else {
    this.wrong_attempts += 1;
    this.performance_metrics.consecutive_wrong += 1;
    this.performance_metrics.consecutive_correct = 0;
  }
  
  // Add to learning history
  this.learning_history.push({
    attempt_date: new Date(),
    was_correct: isCorrect,
    response_time: responseTime,
    difficulty_after: userDifficulty || this.difficulty_rating
  });
  
  // Update performance metrics
  this.updatePerformanceMetrics();
  
  // Update spaced repetition
  this.updateSpacedRepetition(isCorrect, userDifficulty);
  
  // Update mastery level
  this.updateMasteryLevel();
  
  this.last_reviewed = new Date();
  
  return this.save();
};

// Instance method to update performance metrics
userWordProgressSchema.methods.updatePerformanceMetrics = function() {
  const total = this.total_attempts;
  if (total > 0) {
    this.performance_metrics.accuracy_rate = (this.correct_attempts / total) * 100;
  }
  
  // Calculate average response time from learning history
  if (this.learning_history.length > 0) {
    const totalTime = this.learning_history.reduce((sum, entry) => sum + entry.response_time, 0);
    this.performance_metrics.average_response_time = totalTime / this.learning_history.length;
  }
  
  // Update last streak
  this.performance_metrics.last_streak = Math.max(
    this.performance_metrics.consecutive_correct,
    this.performance_metrics.consecutive_wrong
  );
};

// Instance method to update spaced repetition
userWordProgressSchema.methods.updateSpacedRepetition = function(isCorrect, userDifficulty = null) {
  const sr = this.spaced_repetition;
  
  if (isCorrect) {
    if (sr.repetition === 0) {
      sr.interval = 1;
    } else if (sr.repetition === 1) {
      sr.interval = 6;
    } else {
      sr.interval = Math.round(sr.interval * sr.ease_factor);
    }
    sr.repetition += 1;
  } else {
    sr.repetition = 0;
    sr.interval = 1;
  }
  
  // Adjust ease factor based on user difficulty rating
  if (userDifficulty) {
    const difficultyAdjustment = (3 - userDifficulty) * 0.15;
    sr.ease_factor = Math.max(1.3, sr.ease_factor + difficultyAdjustment);
  }
  
  // Set next review date
  this.next_review = new Date(Date.now() + sr.interval * 24 * 60 * 60 * 1000);
};

// Instance method to update mastery level
userWordProgressSchema.methods.updateMasteryLevel = function() {
  const accuracy = this.performance_metrics.accuracy_rate;
  const consecutiveCorrect = this.performance_metrics.consecutive_correct;
  const total = this.total_attempts;
  
  // Base mastery on accuracy and consecutive correct answers
  if (total >= 5 && accuracy >= 90 && consecutiveCorrect >= 3) {
    this.mastery_level = 5;
    this.is_mastered = true;
  } else if (total >= 4 && accuracy >= 80 && consecutiveCorrect >= 2) {
    this.mastery_level = 4;
  } else if (total >= 3 && accuracy >= 70) {
    this.mastery_level = 3;
  } else if (total >= 2 && accuracy >= 50) {
    this.mastery_level = 2;
  } else if (total >= 1) {
    this.mastery_level = 1;
  }
  
  // Decrease mastery level if struggling
  if (this.performance_metrics.consecutive_wrong >= 3) {
    this.mastery_level = Math.max(0, this.mastery_level - 1);
    this.is_mastered = false;
  }
};

// Instance method to reset progress
userWordProgressSchema.methods.resetProgress = function() {
  this.correct_attempts = 0;
  this.wrong_attempts = 0;
  this.mastery_level = 0;
  this.is_mastered = false;
  this.spaced_repetition.interval = 1;
  this.spaced_repetition.ease_factor = 2.5;
  this.spaced_repetition.repetition = 0;
  this.next_review = new Date();
  this.learning_history = [];
  this.performance_metrics = {
    average_response_time: 0,
    accuracy_rate: 0,
    consecutive_correct: 0,
    consecutive_wrong: 0,
    last_streak: 0
  };
  return this.save();
};

// Instance method to mark as mastered
userWordProgressSchema.methods.markAsMastered = function() {
  this.mastery_level = 5;
  this.is_mastered = true;
  this.next_review = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  return this.save();
};

module.exports = mongoose.model('UserWordProgress', userWordProgressSchema); 