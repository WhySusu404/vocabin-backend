const bcrypt = require('bcryptjs');
const { generateAccessToken } = require('../utils/jwt');
const User = require('../models/User');

// Mock user storage (replace with actual database operations when MongoDB is connected)
let mockUsers = [
  {
    _id: '64a123b456c789d012e345f6',
    email: 'admin@vocabin.com',
    password: '$2b$12$A3ddx4jSdZgfL4iqZXmJse4gfrL.qhWbFgTUqgkIujFvweM6FexQC', // password: admin123
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isActive: true,
    registrationDate: new Date(),
    lastLogin: new Date(),
    learningPreferences: {
      difficulty: 'advanced',
      studyTime: 30,
      reminderEnabled: true
    },
    statistics: {
      totalWordsLearned: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalStudyTime: 0,
      lastStudyDate: null
    }
  },
  {
    _id: '64a123b456c789d012e345f7',
    email: 'learner@vocabin.com',
    password: '$2b$12$ZpfPBOh8my/Wl6TDkU55IO8paQwhN9K4wIgEMRXQXf2WjWPqwbGLi', // password: learner123
    firstName: 'John',
    lastName: 'Doe',
    role: 'learner',
    isActive: true,
    registrationDate: new Date(),
    lastLogin: new Date(),
    learningPreferences: {
      difficulty: 'beginner',
      studyTime: 15,
      reminderEnabled: true
    },
    statistics: {
      totalWordsLearned: 25,
      currentStreak: 3,
      longestStreak: 7,
      totalStudyTime: 120,
      lastStudyDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
    }
  }
];

// Generate unique ID (simple mock)
const generateId = () => {
  return '64a123b456c789d012e345' + Math.random().toString(36).substr(2, 2);
};

// Register new user
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'learner' } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'All fields are required',
        required: ['email', 'password', 'firstName', 'lastName']
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists with this email'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const newUser = {
      _id: generateId(),
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: role,
      profileImage: null,
      isActive: true,
      registrationDate: new Date(),
      lastLogin: new Date(),
      learningPreferences: {
        difficulty: 'beginner',
        studyTime: 15,
        reminderEnabled: true
      },
      statistics: {
        totalWordsLearned: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalStudyTime: 0,
        lastStudyDate: null
      }
    };

    // Add to mock storage
    mockUsers.push(newUser);

    // Generate token
    const token = generateAccessToken(newUser);

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'User registered successfully',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account is deactivated'
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();

    // Generate token
    const token = generateAccessToken(user);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
};

// Logout user (client-side token removal, server-side blacklisting could be added)
const logout = async (req, res) => {
  try {
    // In a production app, you might want to blacklist the token
    // For now, we'll just send a success message
    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    // req.user is set by authenticate middleware
    const user = mockUsers.find(u => u._id === req.user._id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: error.message
    });
  }
};

// Export mock users for testing
const getMockUsers = () => mockUsers;

module.exports = {
  register,
  login,
  logout,
  getProfile,
  getMockUsers
}; 