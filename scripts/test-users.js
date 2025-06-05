require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Dictionary = require('../src/models/Dictionary');
const DictionaryFile = require('../src/models/DictionaryFile');
const UserWordProgress = require('../src/models/UserWordProgress');
const UserDictionary = require('../src/models/UserDictionary');
const WrongWords = require('../src/models/WrongWords');

const testDatabaseAndUsers = async () => {
  try {
    console.log('🔧 Testing MongoDB connection...');
    console.log('📍 Node.js version:', process.version);
    console.log('📍 Mongoose version:', mongoose.version);
    console.log('📍 MongoDB URI:', process.env.MONGODB_URI);
    
    // Test connection
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully!');
    console.log('📍 Database name:', mongoose.connection.name);
    console.log('📍 Database host:', mongoose.connection.host);
    
    // Get all users
    console.log('\n👥 Fetching all users...');
    const users = await User.find({}).select('-password'); // Exclude password field    

    
    console.log(`📊 Found ${users.length} users in database:\n`);
    
    if (users.length === 0) {
      console.log('⚠️  No users found in database');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. User ID: ${user._id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.firstName} ${user.lastName}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive}`);
        console.log(`   Registered: ${user.registrationDate.toLocaleDateString()}`);
        console.log(`   Last Login: ${user.lastLogin ? user.lastLogin.toLocaleDateString() : 'Never'}`);
        console.log(`   Learning Difficulty: ${user.learningPreferences.difficulty}`);
        console.log(`   Words Learned: ${user.statistics.totalWordsLearned}`);
        console.log(`   Current Streak: ${user.statistics.currentStreak}`);
        console.log('   ---');
      });
    }
    
    // Test other collections count
    console.log('\n📊 Database Collections Summary:');
    
    
    const userCount = await User.countDocuments();
    const dictCount = await Dictionary.countDocuments();
    const fileCount = await DictionaryFile.countDocuments();
    const progressCount = await UserWordProgress.countDocuments();
    const userDictCount = await UserDictionary.countDocuments();
    const wrongWordCount = await WrongWords.countDocuments();
    
    console.log(`👥 Users: ${userCount}`);
    console.log(`📚 Dictionaries: ${dictCount}`);
    console.log(`📁 Dictionary Files: ${fileCount}`);
    console.log(`📖 User Dictionaries: ${userDictCount}`);
    console.log(`📈 User Word Progress: ${progressCount}`);
    console.log(`❌ Wrong Words: ${wrongWordCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('authentication failed')) {
      console.error('\n💡 Authentication troubleshooting:');
      console.error('   1. Check if username and password are correct');
      console.error('   2. Ensure password special characters are URL-encoded');
      console.error('   3. Verify the database user exists in Atlas');
    }
    if (error.message.includes('network') || error.message.includes('ETIMEOUT')) {
      console.error('\n💡 Network troubleshooting:');
      console.error('   1. Check if your IP address is whitelisted');
      console.error('   2. Verify your internet connection');
      console.error('   3. Try connecting from a different network');
    }
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed successfully');
    process.exit(0);
  }
};

// Run the test
if (require.main === module) {
  testDatabaseAndUsers();
}

module.exports = testDatabaseAndUsers;