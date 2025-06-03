const express = require('express');
const multer = require('multer');
const AdminController = require('../controllers/AdminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Temporary storage, will be moved to dicts folder after processing
    cb(null, 'uploads/temp');
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'dict-' + uniqueSuffix + '.json');
  }
});

const fileFilter = (req, file, cb) => {
  // Only accept JSON files
  if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
    cb(null, true);
  } else {
    cb(new Error('Only JSON files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * Admin Routes using existing auth system
 */

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);

/**
 * Dashboard Routes
 */
// GET /api/admin/dashboard/stats
router.get('/dashboard/stats', AdminController.getDashboardStats);

/**
 * User Management Routes
 */
// GET /api/admin/users
router.get('/users', AdminController.getUsers);

// GET /api/admin/users/:id
router.get('/users/:id', AdminController.getUserById);

// PUT /api/admin/users/:id
router.put('/users/:id', AdminController.updateUser);

// PATCH /api/admin/users/:id/toggle-status
router.patch('/users/:id/toggle-status', AdminController.toggleUserStatus);

/**
 * Dictionary Management Routes
 */
// GET /api/admin/dictionaries
router.get('/dictionaries', AdminController.getDictionaryFiles);

// POST /api/admin/dictionaries/upload
router.post('/dictionaries/upload', upload.single('dictionaryFile'), AdminController.uploadDictionaryFile);

// PATCH /api/admin/dictionaries/:id/toggle-status
router.patch('/dictionaries/:id/toggle-status', AdminController.toggleDictionaryStatus);

// DELETE /api/admin/dictionaries/:id
router.delete('/dictionaries/:id', AdminController.deleteDictionaryFile);

/**
 * Health check for admin routes
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Admin routes are healthy',
    admin: req.user.email,
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 