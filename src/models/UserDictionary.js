const mongoose = require('mongoose');

const userDictionarySchema = new mongoose.Schema({
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
  total_words: {
    type: Number,
    required: [true, 'Total words count is required'],
    min: [0, 'Total words cannot be negative']
  },
  completed_words: {
    type: Number,
    default: 0,
    min: [0, 'Completed words cannot be negative']
  },
  correct_answers: {
    type: Number,
    default: 0,
    min: [0, 'Correct answers cannot be negative']
  },
  wrong_answers: {
    type: Number,
    default: 0,
    min: [0, 'Wrong answers cannot be negative']
  },
  current_position: {
    type: Number,
    default: 0,
    min: [0, 'Current position cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['not_started', 'in_progress', 'completed', 'paused'],
      message: 'Status must be not_started, in_progress, completed, or paused'
    },
    default: 'not_started'
  },
  last_accessed: {
    type: Date,
    default: Date.now
  },
  started_at: {
    type: Date,
    default: null
  },
  completed_at: {
    type: Date,
    default: null
  },
  settings: {
    daily_goal: {
      type: Number,
      default: 20,
      min: [1, 'Daily goal must be at least 1']
    },
    review_mode: {
      type: Boolean,
      default: false
    },
    shuffle_words: {
      type: Boolean,
      default: false
    },
    auto_play_audio: {
      type: Boolean,
      default: true
    }
  },
  session_stats: {
    total_study_time: {
      type: Number, // in seconds
      default: 0
    },
    average_time_per_word: {
      type: Number, // in seconds
      default: 0
    },
    current_streak: {
      type: Number,
      default: 0
    },
    best_streak: {
      type: Number,
      default: 0
    },
    last_session_date: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
userDictionarySchema.index({ user_id: 1, dictionary_id: 1 }, { unique: true });
userDictionarySchema.index({ user_id: 1, status: 1 });
userDictionarySchema.index({ user_id: 1, last_accessed: -1 });

// Virtual for accuracy rate
userDictionarySchema.virtual('accuracy_rate').get(function() {
  const totalAttempts = this.correct_answers + this.wrong_answers;
  if (totalAttempts === 0) return 0;
  return Math.round((this.correct_answers / totalAttempts) * 100 * 100) / 100; // Round to 2 decimal places
});

// Virtual for completion percentage
userDictionarySchema.virtual('completion_percentage').get(function() {
  if (this.total_words === 0) return 0;
  return Math.round((this.completed_words / this.total_words) * 100 * 100) / 100; // Round to 2 decimal places
});

// Virtual for total attempts
userDictionarySchema.virtual('total_attempts').get(function() {
  return this.correct_answers + this.wrong_answers;
});

// Virtual for progress status
userDictionarySchema.virtual('progress_status').get(function() {
  const percentage = this.completion_percentage;
  if (percentage === 0) return 'Not Started';
  if (percentage < 25) return 'Just Started';
  if (percentage < 50) return 'Making Progress';
  if (percentage < 75) return 'Halfway There';
  if (percentage < 100) return 'Almost Done';
  return 'Completed';
});

// Static method to find user's dictionaries
userDictionarySchema.statics.findByUser = function(userId) {
  return this.find({ user_id: userId }).populate('dictionary_id');
};

// Static method to find user's active dictionaries
userDictionarySchema.statics.findActiveByUser = function(userId) {
  return this.find({ 
    user_id: userId, 
    status: { $in: ['in_progress', 'paused'] } 
  }).populate('dictionary_id');
};

// Static method to find completed dictionaries by user
userDictionarySchema.statics.findCompletedByUser = function(userId) {
  return this.find({ user_id: userId, status: 'completed' }).populate('dictionary_id');
};

// Instance method to start dictionary
userDictionarySchema.methods.startDictionary = function() {
  if (this.status === 'not_started') {
    this.status = 'in_progress';
    this.started_at = new Date();
  }
  this.last_accessed = new Date();
  return this.save();
};

// Instance method to update progress
userDictionarySchema.methods.updateProgress = function(isCorrect, timeSpent = 0) {
  if (isCorrect) {
    this.correct_answers += 1;
    this.session_stats.current_streak += 1;
    this.session_stats.best_streak = Math.max(this.session_stats.best_streak, this.session_stats.current_streak);
  } else {
    this.wrong_answers += 1;
    this.session_stats.current_streak = 0;
  }
  
  // Update study time
  this.session_stats.total_study_time += timeSpent;
  this.session_stats.last_session_date = new Date();
  
  // Calculate average time per word
  const totalAttempts = this.correct_answers + this.wrong_answers;
  if (totalAttempts > 0) {
    this.session_stats.average_time_per_word = this.session_stats.total_study_time / totalAttempts;
  }
  
  this.last_accessed = new Date();
  
  // Update status based on progress
  if (this.status === 'not_started') {
    this.status = 'in_progress';
    this.started_at = new Date();
  }
  
  return this.save();
};

// Instance method to advance position
userDictionarySchema.methods.advancePosition = function() {
  this.current_position += 1;
  this.completed_words = Math.max(this.completed_words, this.current_position);
  
  // Check if dictionary is completed
  if (this.completed_words >= this.total_words) {
    this.status = 'completed';
    this.completed_at = new Date();
  }
  
  this.last_accessed = new Date();
  return this.save();
};

// Instance method to reset progress
userDictionarySchema.methods.resetProgress = function() {
  this.completed_words = 0;
  this.correct_answers = 0;
  this.wrong_answers = 0;
  this.current_position = 0;
  this.status = 'not_started';
  this.started_at = null;
  this.completed_at = null;
  this.session_stats.current_streak = 0;
  this.last_accessed = new Date();
  return this.save();
};

// Instance method to pause dictionary
userDictionarySchema.methods.pauseDictionary = function() {
  if (this.status === 'in_progress') {
    this.status = 'paused';
    this.last_accessed = new Date();
    return this.save();
  }
  return this;
};

// Instance method to resume dictionary
userDictionarySchema.methods.resumeDictionary = function() {
  if (this.status === 'paused') {
    this.status = 'in_progress';
    this.last_accessed = new Date();
    return this.save();
  }
  return this;
};

// Pre-save middleware to validate completed_words doesn't exceed total_words
userDictionarySchema.pre('save', function(next) {
  if (this.completed_words > this.total_words) {
    this.completed_words = this.total_words;
  }
  
  if (this.current_position > this.total_words) {
    this.current_position = this.total_words;
  }
  
  next();
});

module.exports = mongoose.model('UserDictionary', userDictionarySchema); 