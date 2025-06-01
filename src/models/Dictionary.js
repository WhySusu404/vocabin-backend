const mongoose = require('mongoose');

const dictionarySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Dictionary name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Dictionary name cannot exceed 100 characters']
  },
  display_name: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [150, 'Display name cannot exceed 150 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  total_words: {
    type: Number,
    required: [true, 'Total words count is required'],
    min: [1, 'Dictionary must have at least 1 word']
  },
  difficulty_level: {
    type: String,
    enum: {
      values: ['beginner', 'intermediate', 'advanced'],
      message: 'Difficulty level must be beginner, intermediate, or advanced'
    },
    required: [true, 'Difficulty level is required']
  },
  file_path: {
    type: String,
    required: [true, 'File path is required'],
    trim: true
  },
  category: {
    type: String,
    enum: ['CET', 'IELTS', 'GRE', 'TOEFL', 'General', 'Other'],
    default: 'General'
  },
  language: {
    type: String,
    default: 'English',
    trim: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  metadata: {
    file_size: {
      type: Number,
      default: 0
    },
    last_updated: {
      type: Date,
      default: Date.now
    },
    version: {
      type: String,
      default: '1.0.0'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
dictionarySchema.index({ name: 1 });
dictionarySchema.index({ difficulty_level: 1 });
dictionarySchema.index({ category: 1 });
dictionarySchema.index({ is_active: 1 });
dictionarySchema.index({ total_words: 1 });

// Virtual for formatted difficulty level
dictionarySchema.virtual('formattedDifficulty').get(function() {
  return this.difficulty_level.charAt(0).toUpperCase() + this.difficulty_level.slice(1);
});

// Virtual for estimated study time (assuming 30 seconds per word)
dictionarySchema.virtual('estimatedStudyTime').get(function() {
  const minutes = Math.ceil((this.total_words * 30) / 60); // 30 seconds per word
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} hours`;
});

// Static method to find active dictionaries
dictionarySchema.statics.findActive = function() {
  return this.find({ is_active: true });
};

// Static method to find by difficulty
dictionarySchema.statics.findByDifficulty = function(difficulty) {
  return this.find({ difficulty_level: difficulty, is_active: true });
};

// Static method to find by category
dictionarySchema.statics.findByCategory = function(category) {
  return this.find({ category: category, is_active: true });
};

// Instance method to toggle active status
dictionarySchema.methods.toggleActive = function() {
  this.is_active = !this.is_active;
  return this.save();
};

// Instance method to update metadata
dictionarySchema.methods.updateMetadata = function(metadata) {
  this.metadata = { ...this.metadata, ...metadata };
  this.metadata.last_updated = new Date();
  return this.save();
};

// Pre-save middleware to update last_updated
dictionarySchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.metadata.last_updated = new Date();
  }
  next();
});

module.exports = mongoose.model('Dictionary', dictionarySchema); 