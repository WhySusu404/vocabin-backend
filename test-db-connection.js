require('dotenv').config();
const mongoose = require('mongoose');

console.log('🔧 Testing MongoDB Atlas Connection...');
console.log('📍 Node.js version:', process.version);
console.log('📍 Mongoose version:', mongoose.version);

// Check if MONGODB_URI is loaded
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  console.error('💡 Make sure your .env file contains MONGODB_URI');
  process.exit(1);
}

// Mask the password in the URI for security when logging
const maskedUri = process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@');
console.log('📍 Connection URI format:', maskedUri);

// Test connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('✅ MongoDB Atlas connection successful!');
  console.log('📍 Connected to database:', mongoose.connection.name);
  console.log('📍 Database host:', mongoose.connection.host);
  console.log('📍 Database port:', mongoose.connection.port);
  
  // Close the connection
  mongoose.connection.close();
  console.log('🔌 Connection closed successfully');
  process.exit(0);
})
.catch(err => {
  console.error('❌ MongoDB Atlas connection failed:');
  console.error('   Error name:', err.name);
  console.error('   Error message:', err.message);
  
  if (err.message.includes('authentication failed')) {
    console.error('\n💡 Authentication troubleshooting:');
    console.error('   1. Check if username and password are correct');
    console.error('   2. Ensure password special characters are URL-encoded');
    console.error('   3. Verify the database user exists in Atlas');
    console.error('   4. Check if user has "Atlas admin" or "Read and write to any database" permissions');
  }
  
  if (err.message.includes('network')) {
    console.error('\n💡 Network troubleshooting:');
    console.error('   1. Check if your IP address is whitelisted (0.0.0.0/0 for development)');
    console.error('   2. Verify your internet connection');
  }
  
  process.exit(1);
});

// Handle connection events
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 MongoDB disconnected');
}); 