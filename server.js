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

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Import routes
const authRoutes = require('./src/routes/auth');
const dictionaryRoutes = require('./src/routes/dictionary');
const userProgressRoutes = require('./src/routes/userProgress');
const wrongWordsRoutes = require('./src/routes/wrongWords');
const adminRoutes = require('./src/routes/admin');

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'VocaBin Backend API',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      dictionaries: '/api/dictionaries',
      user_progress: '/api/user',
      wrong_words: '/api/wrong-words',
      admin: '/api/admin'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/dictionaries', dictionaryRoutes);
app.use('/api/user', userProgressRoutes);
app.use('/api/wrong-words', wrongWordsRoutes);
app.use('/api/admin', adminRoutes);

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
    
  });
};

startServer();

module.exports = app;
