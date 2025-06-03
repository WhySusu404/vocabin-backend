const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const Dictionary = require('../models/Dictionary');
require('dotenv').config();

// Dictionary file mappings with metadata
const DICTIONARY_MAPPINGS = {
  'CET4_T.json': {
    display_name: 'CET-4 Test',
    description: 'College English Test Band 4 vocabulary for Chinese university students',
    difficulty_level: 'intermediate',
    category: 'CET'
  },
  'CET6_T.json': {
    display_name: 'CET-6 Test',
    description: 'College English Test Band 6 vocabulary for advanced Chinese university students',
    difficulty_level: 'advanced',
    category: 'CET'
  },
  'IELTS_3_T.json': {
    display_name: 'IELTS Vocabulary',
    description: 'International English Language Testing System vocabulary for academic and general training',
    difficulty_level: 'advanced',
    category: 'IELTS'
  },
  'GRE3000_3_T.json': {
    display_name: 'GRE 3000 Words',
    description: 'Graduate Record Examinations 3000 essential vocabulary words',
    difficulty_level: 'advanced',
    category: 'GRE'
  },
  'GRE-computer-based-test.json': {
    display_name: 'GRE Computer-Based Test',
    description: 'GRE vocabulary specifically for computer-based testing format',
    difficulty_level: 'advanced',
    category: 'GRE'
  }
};

class DictionaryLoader {
  constructor() {
    this.dictPath = path.join(__dirname, '../../../vocabin-frontend/src/dicts');
    this.loadedDictionaries = [];
    this.errors = [];
  }

  async connectToDatabase() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  async loadDictionaryFile(filename) {
    try {
      const filePath = path.join(this.dictPath, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read and parse JSON file
      const fileContent = await fs.readFile(filePath, 'utf8');
      const wordsData = JSON.parse(fileContent);

      // Validate JSON structure
      if (!Array.isArray(wordsData)) {
        throw new Error(`Invalid format: ${filename} should contain an array of words`);
      }

      if (wordsData.length === 0) {
        throw new Error(`Empty dictionary: ${filename} contains no words`);
      }

      // Validate word structure
      const sampleWord = wordsData[0];
      if (!sampleWord.name || !sampleWord.trans) {
        throw new Error(`Invalid word structure in ${filename}. Expected 'name' and 'trans' fields`);
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      
      return {
        filename,
        wordsData,
        fileSize: stats.size,
        wordCount: wordsData.length
      };

    } catch (error) {
      console.error(`❌ Error loading ${filename}:`, error.message);
      this.errors.push({ filename, error: error.message });
      return null;
    }
  }

  async createDictionaryRecord(dictionaryData) {
    try {
      const { filename, wordsData, fileSize, wordCount } = dictionaryData;
      const mapping = DICTIONARY_MAPPINGS[filename];

      if (!mapping) {
        throw new Error(`No mapping found for ${filename}`);
      }

      // Extract dictionary name without extension
      const name = filename.replace('.json', '');

      // Check if dictionary already exists
      const existingDict = await Dictionary.findOne({ name });
      if (existingDict) {
        
        // Update existing dictionary
        existingDict.total_words = wordCount;
        existingDict.metadata.file_size = fileSize;
        existingDict.metadata.last_updated = new Date();
        existingDict.display_name = mapping.display_name;
        existingDict.description = mapping.description;
        existingDict.difficulty_level = mapping.difficulty_level;
        existingDict.category = mapping.category;
        
        await existingDict.save();
        this.loadedDictionaries.push(existingDict);
        return existingDict;
      }

      // Create new dictionary record
      const dictionary = new Dictionary({
        name,
        display_name: mapping.display_name,
        description: mapping.description,
        total_words: wordCount,
        difficulty_level: mapping.difficulty_level,
        file_path: `dicts/${filename}`,
        category: mapping.category,
        metadata: {
          file_size: fileSize,
          last_updated: new Date(),
          version: '1.0.0'
        }
      });

      await dictionary.save();
      this.loadedDictionaries.push(dictionary);
      
      return dictionary;

    } catch (error) {
      console.error(`❌ Error creating dictionary record:`, error.message);
      this.errors.push({ 
        filename: dictionaryData.filename, 
        error: `Database error: ${error.message}` 
      });
      return null;
    }
  }

  async validateWordStructure(wordsData, filename) {
    
    const requiredFields = ['name', 'trans'];
    const optionalFields = ['usphone', 'ukphone'];
    let validWords = 0;
    const issues = [];

    for (let i = 0; i < Math.min(wordsData.length, 100); i++) { // Sample first 100 words
      const word = wordsData[i];
      
      // Check required fields
      for (const field of requiredFields) {
        if (!word[field]) {
          issues.push(`Word at index ${i}: missing required field '${field}'`);
        }
      }

      // Validate name field
      if (word.name && typeof word.name !== 'string') {
        issues.push(`Word at index ${i}: 'name' should be a string`);
      }

      // Validate trans field
      if (word.trans && !Array.isArray(word.trans)) {
        issues.push(`Word at index ${i}: 'trans' should be an array`);
      }

      if (word.name && word.trans) {
        validWords++;
      }
    }

    const validationResult = {
      totalChecked: Math.min(wordsData.length, 100),
      validWords,
      issues: issues.slice(0, 10) // Limit to first 10 issues
    };


    return validationResult;
  }

  async loadAllDictionaries() {

    try {
      // Get all JSON files in the directory
      const files = await fs.readdir(this.dictPath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      if (jsonFiles.length === 0) {
        throw new Error('No JSON dictionary files found');
      }

      // Load each dictionary file
      for (const filename of jsonFiles) {
        const dictionaryData = await this.loadDictionaryFile(filename);
        
        if (dictionaryData) {
          // Validate word structure
          await this.validateWordStructure(dictionaryData.wordsData, filename);
          
          // Create database record
          await this.createDictionaryRecord(dictionaryData);
        }
      }

      return this.generateReport();

    } catch (error) {
      console.error('❌ Failed to load dictionaries:', error.message);
      throw error;
    }
  }

  generateReport() {
    const report = {
      summary: {
        totalFiles: Object.keys(DICTIONARY_MAPPINGS).length,
        successfullyLoaded: this.loadedDictionaries.length,
        errors: this.errors.length
      },
      loadedDictionaries: this.loadedDictionaries.map(dict => ({
        name: dict.name,
        display_name: dict.display_name,
        total_words: dict.total_words,
        difficulty_level: dict.difficulty_level,
        category: dict.category,
        file_size: dict.metadata.file_size
      })),
      errors: this.errors
    };


    return report;
  }

  async cleanup() {
    try {
      await mongoose.connection.close();
    } catch (error) {
      console.error('❌ Error closing database connection:', error.message);
    }
  }
}

// Script execution
async function main() {
  const loader = new DictionaryLoader();

  try {
    await loader.connectToDatabase();
    const report = await loader.loadAllDictionaries();
    
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  } finally {
    await loader.cleanup();
  }
}

// Export for use in other modules
module.exports = {
  DictionaryLoader,
  DICTIONARY_MAPPINGS
};

// Run script if called directly
if (require.main === module) {
  main();
} 