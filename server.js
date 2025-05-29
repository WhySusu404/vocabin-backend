const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// MongoDB Connection (you'll replace this with your actual MongoDB Atlas connection)
const connectDB = async () => {
  try {
    // For now, we'll use a mock connection
    console.log('📍 Using mock database - Replace MONGODB_URI in .env with your Atlas connection string');
    console.log('🔗 MongoDB Mock Connection Established');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Import routes
const authRoutes = require('./src/routes/auth');

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'VocaBin Backend API',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      user: '/user',
      vocabulary: '/vocabulary',
      listening: '/listening',
      reading: '/reading',
      admin: '/admin'
    }
  });
});

// Mount routes
app.use('/auth', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 API URL: http://localhost:${PORT}`);
    console.log('📚 Available endpoints:');
    console.log('   • POST /auth/register - Register new user');
    console.log('   • POST /auth/login - Login user');
    console.log('   • POST /auth/logout - Logout user');
    console.log('   • GET /auth/profile - Get user profile');
    console.log('   • GET /auth/test - Test authentication');
  });
};

startServer();

module.exports = app;
