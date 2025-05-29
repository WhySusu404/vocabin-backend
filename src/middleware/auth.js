const User = require('../models/User');
const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');

// Mock user storage for development (replace with actual database queries when MongoDB is connected)
const mockUsers = [
  {
    _id: '64a123b456c789d012e345f6',
    email: 'admin@vocabin.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isActive: true
  },
  {
    _id: '64a123b456c789d012e345f7',
    email: 'learner@vocabin.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'learner',
    isActive: true
  }
];

// Middleware to authenticate user
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    const token = extractTokenFromHeader(authHeader);
    const decoded = verifyToken(token);
    
    // In production, you would query the database:
    // const user = await User.findById(decoded.id).select('-password');
    
    // For now, use mock user data
    const user = mockUsers.find(u => u._id === decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }
    
    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      message: error.message
    });
  }
};

// Middleware to check if user has specific role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `This endpoint requires one of the following roles: ${roles.join(', ')}`
      });
    }
    
    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = authorize('admin');

// Middleware to check if user is learner or admin
const requireLearnerOrAdmin = authorize('learner', 'admin');

// Middleware to check if user owns resource or is admin
const requireOwnershipOrAdmin = (getResourceUserId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Admin can access anything
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Get the user ID associated with the resource
    const resourceUserId = getResourceUserId(req);
    
    // Check if user owns the resource
    if (req.user._id !== resourceUserId) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You can only access your own resources'
      });
    }
    
    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = extractTokenFromHeader(authHeader);
      const decoded = verifyToken(token);
      
      // Find user (mock for now)
      const user = mockUsers.find(u => u._id === decoded.id);
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  requireAdmin,
  requireLearnerOrAdmin,
  requireOwnershipOrAdmin,
  optionalAuth
}; 