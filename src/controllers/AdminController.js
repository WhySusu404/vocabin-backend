const User = require('../models/User');
const UserWordProgress = require('../models/UserWordProgress');
const UserDictionary = require('../models/UserDictionary');
const WrongWords = require('../models/WrongWords');
const Dictionary = require('../models/Dictionary');

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
      const totalWordProgress = await UserWordProgress.countDocuments();
      const totalWrongWords = await WrongWords.countDocuments();
      const totalUserDictionaries = await UserDictionary.countDocuments();

      // Recent activity (last 7 days)
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const recentUsers = await User.countDocuments({ 
        registrationDate: { $gte: lastWeek } 
      });

      const stats = {
        totalUsers,
        activeUsers,
        adminUsers,
        learnerUsers,
        totalDictionaries,
        totalWordProgress,
        totalWrongWords,
        totalUserDictionaries,
        recentUsers,
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
}

module.exports = AdminController; 