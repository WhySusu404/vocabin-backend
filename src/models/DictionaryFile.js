const mongoose = require('mongoose');

const dictionaryFileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Dictionary name is required'],
    trim: true,
    maxlength: [100, 'Dictionary name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    unique: true
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required']
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required']
  },
  wordCount: {
    type: Number,
    default: 0
  },
  language: {
    type: String,
    default: 'English',
    trim: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'mixed'],
    default: 'intermediate'
  },
  categories: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  // Store sample words for preview (first 10-20 words)
  sampleWords: [{
    name: String,
    trans: [String],
    usphone: String,
    ukphone: String
  }],
  // File format metadata
  format: {
    type: String,
    default: 'cet4_format', // Based on the structure we saw
    enum: ['cet4_format', 'custom_format', 'standard_format']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for performance
dictionaryFileSchema.index({ name: 1 });
dictionaryFileSchema.index({ isActive: 1 });
dictionaryFileSchema.index({ uploadedBy: 1 });
dictionaryFileSchema.index({ uploadedAt: -1 });

// Virtual for file path
dictionaryFileSchema.virtual('filePath').get(function() {
  return `src/dicts/${this.filename}`;
});

// Update lastModified on save
dictionaryFileSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

// Static method to get active dictionaries
dictionaryFileSchema.statics.getActive = function() {
  return this.find({ isActive: true }).populate('uploadedBy', 'firstName lastName email');
};

// Static method to get public dictionaries
dictionaryFileSchema.statics.getPublic = function() {
  return this.find({ isActive: true, isPublic: true }).populate('uploadedBy', 'firstName lastName email');
};

// Method to generate sample words
dictionaryFileSchema.methods.generateSampleWords = function(wordsArray) {
  // Take first 10 words as sample
  this.sampleWords = wordsArray.slice(0, 10).map(word => ({
    name: word.name,
    trans: word.trans,
    usphone: word.usphone,
    ukphone: word.ukphone
  }));
};

module.exports = mongoose.model('DictionaryFile', dictionaryFileSchema); 