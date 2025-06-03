const User = require('../models/User');
const UserWordProgress = require('../models/UserWordProgress');
const UserDictionary = require('../models/UserDictionary');
const WrongWords = require('../models/WrongWords');
const Dictionary = require('../models/Dictionary');
const DictionaryFile = require('../models/DictionaryFile');
const fs = require('fs').promises;
const path = require('path');

/**
 * Simple Admin Controller
 * Uses existing database models to provide admin functionality
 */
class AdminController {
  /**
   * Get dashboard statistics
   */
  static async getDashboardStats(req, res) {
    try {
      // Get basic user statistics from existing User model
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const adminUsers = await User.countDocuments({ role: 'admin' });
      const learnerUsers = await User.countDocuments({ role: 'learner' });

      // Get content statistics from existing models
      const totalDictionaries = await Dictionary.countDocuments();
      const totalDictionaryFiles = await DictionaryFile.countDocuments({ isActive: true });
      const totalWordProgress = await UserWordProgress.countDocuments();
      const totalWrongWords = await WrongWords.countDocuments();
      const totalUserDictionaries = await UserDictionary.countDocuments();

      // Recent activity (last 7 days)
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const recentUsers = await User.countDocuments({ 
        registrationDate: { $gte: lastWeek } 
      });
      const recentDictionaries = await DictionaryFile.countDocuments({
        uploadedAt: { $gte: lastWeek }
      });

      const stats = {
        totalUsers,
        activeUsers,
        adminUsers,
        learnerUsers,
        totalDictionaries,
        totalDictionaryFiles,
        totalWordProgress,
        totalWrongWords,
        totalUserDictionaries,
        recentUsers,
        recentDictionaries,
        lastUpdated: new Date()
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics'
      });
    }
  }

  /**
   * Get all users with filtering
   */
  static async getUsers(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        search = '', 
        role = '', 
        isActive = '' 
      } = req.query;

      // Build filter
      const filter = {};
      
      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (role) filter.role = role;
      if (isActive !== '') filter.isActive = isActive === 'true';

      // Pagination
      const skip = (page - 1) * parseInt(limit);

      // Get users
      const users = await User.find(filter)
        .select('-password')
        .sort({ registrationDate: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const totalUsers = await User.countDocuments(filter);
      const totalPages = Math.ceil(totalUsers / parseInt(limit));

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalUsers,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }
  }

  /**
   * Get single user details
   */
  static async getUserById(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id).select('-password');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user details'
      });
    }
  }

  /**
   * Update user information
   */
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove sensitive fields that shouldn't be updated via admin
      delete updateData.password;
      delete updateData._id;
      delete updateData.__v;

      const user = await User.findByIdAndUpdate(
        id, 
        updateData, 
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user,
        message: 'User updated successfully'
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }
  }

  /**
   * Update user status
   */
  static async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      user.isActive = !user.isActive;
      await user.save();

      res.json({
        success: true,
        data: {
          userId: user._id,
          isActive: user.isActive
        },
        message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle user status'
      });
    }
  }

  /**
   * Get all dictionary files (both uploaded and existing)
   */
  static async getDictionaryFiles(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        isActive = '',
        difficulty = ''
      } = req.query;

      // Build filter for uploaded dictionary files
      const uploadedFilter = {};
      
      if (search) {
        uploadedFilter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { originalName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (isActive !== '') uploadedFilter.isActive = isActive === 'true';
      if (difficulty) uploadedFilter.difficulty = difficulty;

      // Build filter for existing dictionaries
      const existingFilter = {};
      
      if (search) {
        existingFilter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { display_name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (difficulty) {
        existingFilter.difficulty_level = difficulty;
      }

      // Get uploaded dictionary files
      const uploadedFiles = await DictionaryFile.find(uploadedFilter)
        .populate('uploadedBy', 'firstName lastName email')
        .sort({ uploadedAt: -1 });

      // Get existing dictionaries and transform them to match the format
      const existingDictionaries = await Dictionary.find(existingFilter)
        .sort({ metadata: -1 });

      // Transform existing dictionaries to match uploaded files format
      const transformedExisting = existingDictionaries.map(dict => ({
        _id: dict._id,
        name: dict.display_name || dict.name,
        description: dict.description,
        filename: dict.name + '.json',
        originalName: dict.name + '.json',
        fileSize: dict.metadata?.file_size || 0,
        wordCount: dict.total_words,
        difficulty: dict.difficulty_level,
        categories: dict.category ? [dict.category] : [],
        isActive: dict.is_active,
        isPublic: true,
        uploadedBy: null,
        uploadedAt: dict.metadata?.last_updated || dict.createdAt || new Date(),
        sampleWords: [],
        format: 'legacy',
        source: 'existing'
      }));

      // Combine both arrays
      let allDictionaries = [...uploadedFiles.map(file => ({
        ...file.toObject(),
        source: 'uploaded'
      })), ...transformedExisting];

      // Apply isActive filter to combined results if needed
      if (isActive !== '') {
        const activeFilter = isActive === 'true';
        allDictionaries = allDictionaries.filter(dict => dict.isActive === activeFilter);
      }

      // Sort combined results by upload date (newest first)
      allDictionaries.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      // Apply pagination to combined results
      const totalFiles = allDictionaries.length;
      const totalPages = Math.ceil(totalFiles / parseInt(limit));
      const skip = (page - 1) * parseInt(limit);
      const paginatedFiles = allDictionaries.slice(skip, skip + parseInt(limit));

      res.json({
        success: true,
        data: {
          dictionaryFiles: paginatedFiles,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalFiles,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Error fetching dictionary files:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dictionary files'
      });
    }
  }

  /**
   * Upload dictionary file
   */
  static async uploadDictionaryFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const { name, description, difficulty = 'intermediate', categories = '' } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Dictionary name is required'
        });
      }

      // Read and parse the uploaded JSON file
      const fileContent = await fs.readFile(req.file.path, 'utf8');
      let wordsData;
      
      try {
        wordsData = JSON.parse(fileContent);
      } catch (parseError) {
        // Clean up uploaded file
        await fs.unlink(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Invalid JSON format'
        });
      }

      // Validate the structure (should be an array of words)
      if (!Array.isArray(wordsData) || wordsData.length === 0) {
        await fs.unlink(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Dictionary must contain an array of words'
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const newFilename = `${cleanName}-${timestamp}.json`;
      const destPath = path.join(process.cwd(), '../vocabin-frontend/src/dicts', newFilename);

      // Move file to dicts folder
      await fs.rename(req.file.path, destPath);

      // Create database record
      const dictionaryFile = new DictionaryFile({
        name,
        description,
        filename: newFilename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        wordCount: wordsData.length,
        difficulty,
        categories: categories ? categories.split(',').map(c => c.trim()) : [],
        uploadedBy: req.user._id
      });

      // Generate sample words for preview
      dictionaryFile.generateSampleWords(wordsData);

      await dictionaryFile.save();

      res.json({
        success: true,
        data: dictionaryFile,
        message: 'Dictionary uploaded successfully'
      });

    } catch (error) {
      console.error('Error uploading dictionary:', error);
      
      // Clean up file if it exists
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to upload dictionary'
      });
    }
  }

  /**
   * Toggle dictionary file status (handles both uploaded and existing dictionaries)
   */
  static async toggleDictionaryStatus(req, res) {
    try {
      const { id } = req.params;
      const { source } = req.query; // 'uploaded' or 'existing'

      let dictionary;
      let message;

      if (source === 'existing') {
        // Handle existing Dictionary records
        dictionary = await Dictionary.findById(id);
        if (!dictionary) {
          return res.status(404).json({
            success: false,
            message: 'Dictionary not found'
          });
        }

        dictionary.is_active = !dictionary.is_active;
        await dictionary.save();

        message = `Dictionary ${dictionary.is_active ? 'activated' : 'deactivated'} successfully`;
        
        res.json({
          success: true,
          data: {
            dictionaryId: dictionary._id,
            isActive: dictionary.is_active
          },
          message
        });

      } else {
        // Handle uploaded DictionaryFile records (default behavior)
        dictionary = await DictionaryFile.findById(id);
        if (!dictionary) {
          return res.status(404).json({
            success: false,
            message: 'Dictionary not found'
          });
        }

        dictionary.isActive = !dictionary.isActive;
        await dictionary.save();

        message = `Dictionary ${dictionary.isActive ? 'activated' : 'deactivated'} successfully`;

        res.json({
          success: true,
          data: {
            dictionaryId: dictionary._id,
            isActive: dictionary.isActive
          },
          message
        });
      }

    } catch (error) {
      console.error('Error toggling dictionary status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle dictionary status'
      });
    }
  }

  /**
   * Delete dictionary file (handles both uploaded and existing dictionaries)
   */
  static async deleteDictionaryFile(req, res) {
    try {
      const { id } = req.params;
      const { source } = req.query; // 'uploaded' or 'existing'

      if (source === 'existing') {
        // Handle existing Dictionary records - don't actually delete, just deactivate
        const dictionary = await Dictionary.findById(id);
        if (!dictionary) {
          return res.status(404).json({
            success: false,
            message: 'Dictionary not found'
          });
        }

        // Don't actually delete existing dictionaries, just deactivate them
        dictionary.is_active = false;
        await dictionary.save();

        res.json({
          success: true,
          message: 'Dictionary deactivated successfully (existing dictionaries cannot be permanently deleted)'
        });

      } else {
        // Handle uploaded DictionaryFile records (default behavior)
        const dictionaryFile = await DictionaryFile.findById(id);
        if (!dictionaryFile) {
          return res.status(404).json({
            success: false,
            message: 'Dictionary not found'
          });
        }

        // Delete file from filesystem
        const filePath = path.join(process.cwd(), '../vocabin-frontend/src/dicts', dictionaryFile.filename);
        try {
          await fs.unlink(filePath);
        } catch (fileError) {
          console.warn('File not found or already deleted:', filePath);
        }

        // Delete from database
        await DictionaryFile.findByIdAndDelete(id);

        res.json({
          success: true,
          message: 'Dictionary deleted successfully'
        });
      }

    } catch (error) {
      console.error('Error deleting dictionary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete dictionary'
      });
    }
  }
}

module.exports = AdminController; 