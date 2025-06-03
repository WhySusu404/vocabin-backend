require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

// Default users to create
const defaultUsers = [
  {
    email: 'admin@vocabin.com',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isActive: true,
    learningPreferences: {
      difficulty: 'advanced',
      studyTime: 30,
      reminderEnabled: true
    }
  },
  {
    email: 'learner@vocabin.com',
    password: 'learner123',
    firstName: 'John',
    lastName: 'Doe',
    role: 'learner',
    isActive: true,
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
      lastStudyDate: new Date()
    }
  },
  {
    email: 'student@vocabin.com',
    password: 'student123',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'learner',
    isActive: true,
    learningPreferences: {
      difficulty: 'intermediate',
      studyTime: 20,
      reminderEnabled: false
    },
    statistics: {
      totalWordsLearned: 45,
      currentStreak: 5,
      longestStreak: 12,
      totalStudyTime: 300,
      lastStudyDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
    }
  },
  {
    email: 'teacher@vocabin.com',
    password: 'teacher123',
    firstName: 'Sarah',
    lastName: 'Wilson',
    role: 'admin',
    isActive: true,
    learningPreferences: {
      difficulty: 'advanced',
      studyTime: 45,
      reminderEnabled: true
    }
  }
];

const seedUsers = async () => {
  try {
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);

    // Clear existing users (optional - comment out if you want to keep existing users)
    const existingUsers = await User.countDocuments();
    
    // Create default users
    const createdUsers = [];
    
    for (const userData of defaultUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findByEmail(userData.email);
        
        if (existingUser) {
          continue;
        }
        
        // Create new user
        const user = new User(userData);
        await user.save();
        createdUsers.push(user);
        
      } catch (error) {
        console.error(`❌ Failed to create user ${userData.email}:`, error.message);
      }
    }
    
   
    
    // Display created users
    if (createdUsers.length > 0) {
      createdUsers.forEach(user => {
       
      });
    }
    
    defaultUsers.forEach(user => {
     
    });
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    
    process.exit(0);
  }
};

// Run seeding
if (require.main === module) {
  seedUsers();
}

module.exports = seedUsers; 