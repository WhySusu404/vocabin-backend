const mongoose = require('mongoose');

const wrongWordsSchema = new mongoose.Schema({
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
  word_data: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Word data is required']
  },
  error_count: {
    type: Number,
    default: 1,
    min: [1, 'Error count must be at least 1']
  },
  last_wrong_date: {
    type: Date,
    default: Date.now,
    index: true
  },
  first_wrong_date: {
    type: Date,
    default: Date.now
  },
  review_priority: {
    type: Number,
    default: 1,
    min: [1, 'Review priority must be at least 1'],
    max: [5, 'Review priority cannot exceed 5']
  },
  is_resolved: {
    type: Boolean,
    default: false,
    index: true
  },
  resolved_date: {
    type: Date,
    default: null
  },
  error_details: [{
    error_date: {
      type: Date,
      default: Date.now
    },
    user_answer: {
      type: String,
      trim: true
    },
    correct_answer: {
      type: String,
      trim: true
    },
    error_type: {
      type: String,
      enum: ['spelling', 'meaning', 'pronunciation', 'usage', 'other'],
      default: 'meaning'
    },
    context: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  review_history: [{
    review_date: {
      type: Date,
      default: Date.now
    },
    was_successful: {
      type: Boolean,
      required: true
    },
    review_method: {
      type: String,
      enum: ['study', 'quiz', 'spaced_repetition', 'manual_review'],
      default: 'study'
    },
    response_time: {
      type: Number, // in milliseconds
      default: 0
    },
    confidence_level: {
      type: Number,
      min: [1, 'Confidence level must be at least 1'],
      max: [5, 'Confidence level cannot exceed 5'],
      default: 3
    }
  }],
  learning_notes: {
    user_notes: {
      type: String,
      trim: true,
      default: ''
    },
    mnemonic: {
      type: String,
      trim: true,
      default: ''
    },
    difficulty_reason: {
      type: String,
      trim: true,
      default: ''
    },
    personal_example: {
      type: String,
      trim: true,
      default: ''
    }
  },
  auto_generated_hints: [{
    hint_type: {
      type: String,
      enum: ['similar_words', 'etymology', 'usage_example', 'memory_technique'],
      required: true
    },
    hint_content: {
      type: String,
      required: true
    },
    effectiveness_rating: {
      type: Number,
      min: [1, 'Effectiveness rating must be at least 1'],
      max: [5, 'Effectiveness rating cannot exceed 5'],
      default: 3
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
wrongWordsSchema.index({ user_id: 1, dictionary_id: 1, word: 1 }, { unique: true });
wrongWordsSchema.index({ user_id: 1, review_priority: -1 });
wrongWordsSchema.index({ user_id: 1, last_wrong_date: -1 });
wrongWordsSchema.index({ user_id: 1, is_resolved: 1 });
wrongWordsSchema.index({ user_id: 1, dictionary_id: 1, is_resolved: 1 });

// Virtual for days since last error
wrongWordsSchema.virtual('days_since_last_error').get(function() {
  const now = new Date();
  const lastError = new Date(this.last_wrong_date);
  const diffTime = now - lastError;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for total review attempts
wrongWordsSchema.virtual('total_review_attempts').get(function() {
  return this.review_history.length;
});

// Virtual for successful review rate
wrongWordsSchema.virtual('successful_review_rate').get(function() {
  if (this.review_history.length === 0) return 0;
  const successfulReviews = this.review_history.filter(review => review.was_successful).length;
  return Math.round((successfulReviews / this.review_history.length) * 100 * 100) / 100;
});

// Virtual for urgency score (higher = more urgent)
wrongWordsSchema.virtual('urgency_score').get(function() {
  let score = this.review_priority * 20; // Base score from priority
  score += this.error_count * 10; // More errors = higher urgency
  score += Math.max(0, 7 - this.days_since_last_error) * 5; // Recent errors are more urgent
  score -= this.successful_review_rate; // Good reviews reduce urgency
  return Math.max(0, score);
});

// Virtual for review status
wrongWordsSchema.virtual('review_status').get(function() {
  if (this.is_resolved) return 'Resolved';
  if (this.successful_review_rate >= 80) return 'Nearly Resolved';
  if (this.total_review_attempts === 0) return 'Needs Review';
  if (this.successful_review_rate >= 50) return 'Improving';
  return 'Struggling';
});

// Static method to find by user
wrongWordsSchema.statics.findByUser = function(userId, includeResolved = false) {
  const query = { user_id: userId };
  if (!includeResolved) {
    query.is_resolved = false;
  }
  return this.find(query).populate('dictionary_id');
};

// Static method to find by dictionary
wrongWordsSchema.statics.findByDictionary = function(userId, dictionaryId, includeResolved = false) {
  const query = { user_id: userId, dictionary_id: dictionaryId };
  if (!includeResolved) {
    query.is_resolved = false;
  }
  return this.find(query).populate('dictionary_id');
};

// Static method to find high priority words
wrongWordsSchema.statics.findHighPriority = function(userId, minPriority = 4) {
  return this.find({ 
    user_id: userId, 
    review_priority: { $gte: minPriority },
    is_resolved: false 
  }).populate('dictionary_id');
};

// Static method to find by urgency
wrongWordsSchema.statics.findByUrgency = function(userId, limit = 10) {
  return this.aggregate([
    { $match: { user_id: mongoose.Types.ObjectId(userId), is_resolved: false } },
    { $addFields: {
      days_since_last_error: {
        $floor: {
          $divide: [
            { $subtract: [new Date(), '$last_wrong_date'] },
            1000 * 60 * 60 * 24
          ]
        }
      },
      successful_review_count: {
        $size: {
          $filter: {
            input: '$review_history',
            cond: { $eq: ['$$this.was_successful', true] }
          }
        }
      },
      total_review_count: { $size: '$review_history' }
    }},
    { $addFields: {
      successful_review_rate: {
        $cond: [
          { $eq: ['$total_review_count', 0] },
          0,
          { $multiply: [{ $divide: ['$successful_review_count', '$total_review_count'] }, 100] }
        ]
      }
    }},
    { $addFields: {
      urgency_score: {
        $subtract: [
          { $add: [
            { $multiply: ['$review_priority', 20] },
            { $multiply: ['$error_count', 10] },
            { $multiply: [{ $max: [0, { $subtract: [7, '$days_since_last_error'] }] }, 5] }
          ]},
          '$successful_review_rate'
        ]
      }
    }},
    { $sort: { urgency_score: -1 } },
    { $limit: limit }
  ]);
};

// Instance method to add error
wrongWordsSchema.methods.addError = function(userAnswer = '', correctAnswer = '', errorType = 'meaning', context = '') {
  this.error_count += 1;
  this.last_wrong_date = new Date();
  
  // Update review priority based on error frequency
  if (this.error_count >= 5) {
    this.review_priority = 5;
  } else if (this.error_count >= 3) {
    this.review_priority = 4;
  } else if (this.error_count >= 2) {
    this.review_priority = 3;
  }
  
  // Add error details
  this.error_details.push({
    error_date: new Date(),
    user_answer: userAnswer,
    correct_answer: correctAnswer,
    error_type: errorType,
    context: context
  });
  
  // Mark as unresolved if it was previously resolved
  if (this.is_resolved) {
    this.is_resolved = false;
    this.resolved_date = null;
  }
  
  return this.save();
};

// Instance method to add review
wrongWordsSchema.methods.addReview = function(wasSuccessful, reviewMethod = 'study', responseTime = 0, confidenceLevel = 3) {
  this.review_history.push({
    review_date: new Date(),
    was_successful: wasSuccessful,
    review_method: reviewMethod,
    response_time: responseTime,
    confidence_level: confidenceLevel
  });
  
  // Check if word should be marked as resolved
  this.checkResolutionStatus();
  
  return this.save();
};

// Instance method to check if word should be resolved
wrongWordsSchema.methods.checkResolutionStatus = function() {
  const recentReviews = this.review_history.slice(-5); // Last 5 reviews
  
  if (recentReviews.length >= 3) {
    const successfulReviews = recentReviews.filter(review => review.was_successful).length;
    const successRate = successfulReviews / recentReviews.length;
    
    // Mark as resolved if user has 80% success rate in recent reviews
    if (successRate >= 0.8) {
      this.is_resolved = true;
      this.resolved_date = new Date();
    }
  }
};

// Instance method to mark as resolved manually
wrongWordsSchema.methods.markAsResolved = function() {
  this.is_resolved = true;
  this.resolved_date = new Date();
  return this.save();
};

// Instance method to mark as unresolved
wrongWordsSchema.methods.markAsUnresolved = function() {
  this.is_resolved = false;
  this.resolved_date = null;
  return this.save();
};

// Instance method to update learning notes
wrongWordsSchema.methods.updateLearningNotes = function(notes) {
  this.learning_notes = { ...this.learning_notes, ...notes };
  return this.save();
};

// Instance method to add hint
wrongWordsSchema.methods.addHint = function(hintType, hintContent, effectivenessRating = 3) {
  this.auto_generated_hints.push({
    hint_type: hintType,
    hint_content: hintContent,
    effectiveness_rating: effectivenessRating
  });
  return this.save();
};

// Instance method to update hint effectiveness
wrongWordsSchema.methods.updateHintEffectiveness = function(hintIndex, rating) {
  if (this.auto_generated_hints[hintIndex]) {
    this.auto_generated_hints[hintIndex].effectiveness_rating = rating;
    return this.save();
  }
  return this;
};

// Pre-save middleware to ensure first_wrong_date is set
wrongWordsSchema.pre('save', function(next) {
  if (this.isNew && !this.first_wrong_date) {
    this.first_wrong_date = this.last_wrong_date || new Date();
  }
  next();
});

module.exports = mongoose.model('WrongWords', wrongWordsSchema); 