const fs = require('fs').promises;
const path = require('path');
const Dictionary = require('../models/Dictionary');

class DictionaryService {
  constructor() {
    this.dictPath = path.join(__dirname, '../../../vocabin-frontend/src/dicts');
    this.wordCache = new Map(); // Cache for frequently accessed words
  }

  /**
   * Get all active dictionaries with metadata
   */
  async getAllDictionaries() {
    try {
      const dictionaries = await Dictionary.findActive().sort({ category: 1, display_name: 1 });
      return dictionaries;
    } catch (error) {
      throw new Error(`Failed to retrieve dictionaries: ${error.message}`);
    }
  }

  /**
   * Get specific dictionary by ID
   */
  async getDictionaryById(dictionaryId) {
    try {
      const dictionary = await Dictionary.findById(dictionaryId);
      if (!dictionary) {
        throw new Error('Dictionary not found');
      }
      if (!dictionary.is_active) {
        throw new Error('Dictionary is not active');
      }
      return dictionary;
    } catch (error) {
      throw new Error(`Failed to retrieve dictionary: ${error.message}`);
    }
  }

  /**
   * Get dictionaries by category
   */
  async getDictionariesByCategory(category) {
    try {
      const dictionaries = await Dictionary.findByCategory(category);
      return dictionaries;
    } catch (error) {
      throw new Error(`Failed to retrieve dictionaries by category: ${error.message}`);
    }
  }

  /**
   * Get dictionaries by difficulty level
   */
  async getDictionariesByDifficulty(difficulty) {
    try {
      const dictionaries = await Dictionary.findByDifficulty(difficulty);
      return dictionaries;
    } catch (error) {
      throw new Error(`Failed to retrieve dictionaries by difficulty: ${error.message}`);
    }
  }

  /**
   * Load words from dictionary file with pagination
   */
  async getDictionaryWords(dictionaryId, page = 1, limit = 50, startIndex = null) {
    try {
      // Get dictionary metadata
      const dictionary = await this.getDictionaryById(dictionaryId);
      
      // Create cache key
      const cacheKey = `${dictionary.name}_words`;
      
      let wordsData;
      
      // Check cache first
      if (this.wordCache.has(cacheKey)) {
        wordsData = this.wordCache.get(cacheKey);
      } else {
        // Load from file
        const filePath = path.join(this.dictPath, `${dictionary.name}.json`);
        const fileContent = await fs.readFile(filePath, 'utf8');
        wordsData = JSON.parse(fileContent);
        
        // Cache the words (limit cache size)
        if (this.wordCache.size < 10) { // Limit to 10 dictionaries in cache
          this.wordCache.set(cacheKey, wordsData);
        }
      }

      // Calculate pagination
      const totalWords = wordsData.length;
      let startIdx = startIndex !== null ? startIndex : (page - 1) * limit;
      const endIdx = Math.min(startIdx + limit, totalWords);
      
      // Ensure startIdx is within bounds
      startIdx = Math.max(0, Math.min(startIdx, totalWords - 1));
      
      // Get paginated words
      const paginatedWords = wordsData.slice(startIdx, endIdx);
      
      // Add index to each word for tracking
      const wordsWithIndex = paginatedWords.map((word, index) => ({
        ...word,
        index: startIdx + index,
        audioUrl: this.generateAudioUrl(word.name)
      }));

      return {
        words: wordsWithIndex,
        pagination: {
          currentPage: Math.floor(startIdx / limit) + 1,
          totalPages: Math.ceil(totalWords / limit),
          totalWords,
          limit,
          startIndex: startIdx,
          endIndex: endIdx - 1,
          hasNext: endIdx < totalWords,
          hasPrevious: startIdx > 0
        },
        dictionary: {
          id: dictionary._id,
          name: dictionary.name,
          display_name: dictionary.display_name,
          category: dictionary.category,
          difficulty_level: dictionary.difficulty_level
        }
      };

    } catch (error) {
      throw new Error(`Failed to load dictionary words: ${error.message}`);
    }
  }

  /**
   * Get a specific word by index from dictionary
   */
  async getWordByIndex(dictionaryId, wordIndex) {
    try {
      console.log('🔍 DictionaryService.getWordByIndex called:', { dictionaryId, wordIndex });
      
      const dictionary = await this.getDictionaryById(dictionaryId);
      console.log('✅ Dictionary found in getWordByIndex:', dictionary.name);
      
      const cacheKey = `${dictionary.name}_words`;
      
      let wordsData;
      if (this.wordCache.has(cacheKey)) {
        wordsData = this.wordCache.get(cacheKey);
        console.log('✅ Words loaded from cache');
      } else {
        const filePath = path.join(this.dictPath, `${dictionary.name}.json`);
        console.log('🔍 Loading words from file:', filePath);
        
        try {
          const fileContent = await fs.readFile(filePath, 'utf8');
          wordsData = JSON.parse(fileContent);
          console.log('✅ Words loaded from file, count:', wordsData.length);
          
          if (this.wordCache.size < 10) {
            this.wordCache.set(cacheKey, wordsData);
          }
        } catch (fileError) {
          console.error('❌ File read error:', fileError);
          if (fileError.code === 'ENOENT') {
            throw new Error(`Dictionary file not found: ${dictionary.name}.json`);
          }
          throw new Error(`Failed to read dictionary file: ${fileError.message}`);
        }
      }

      if (!wordsData || !Array.isArray(wordsData)) {
        throw new Error('Invalid dictionary file format');
      }

      if (wordIndex < 0 || wordIndex >= wordsData.length) {
        console.log('❌ Word index out of range:', { wordIndex, totalWords: wordsData.length });
        throw new Error(`Word index ${wordIndex} out of range. Dictionary has ${wordsData.length} words.`);
      }

      const word = wordsData[wordIndex];
      if (!word) {
        throw new Error(`Word at index ${wordIndex} is null or undefined`);
      }

      console.log('✅ Word retrieved successfully:', word.name);
      
      return {
        ...word,
        index: wordIndex,
        audioUrl: this.generateAudioUrl(word.name),
        dictionary: {
          id: dictionary._id,
          name: dictionary.name,
          display_name: dictionary.display_name
        }
      };

    } catch (error) {
      console.error('❌ DictionaryService.getWordByIndex error:', error);
      throw new Error(`Failed to get word by index: ${error.message}`);
    }
  }

  /**
   * Search words in dictionary
   */
  async searchWordsInDictionary(dictionaryId, searchTerm, limit = 20) {
    try {
      const dictionary = await this.getDictionaryById(dictionaryId);
      const cacheKey = `${dictionary.name}_words`;
      
      let wordsData;
      if (this.wordCache.has(cacheKey)) {
        wordsData = this.wordCache.get(cacheKey);
      } else {
        const filePath = path.join(this.dictPath, `${dictionary.name}.json`);
        const fileContent = await fs.readFile(filePath, 'utf8');
        wordsData = JSON.parse(fileContent);
        
        if (this.wordCache.size < 10) {
          this.wordCache.set(cacheKey, wordsData);
        }
      }

      const searchTermLower = searchTerm.toLowerCase();
      const matchedWords = [];

      for (let i = 0; i < wordsData.length && matchedWords.length < limit; i++) {
        const word = wordsData[i];
        
        // Search in word name
        if (word.name.toLowerCase().includes(searchTermLower)) {
          matchedWords.push({
            ...word,
            index: i,
            audioUrl: this.generateAudioUrl(word.name),
            matchType: 'name'
          });
          continue;
        }

        // Search in translations
        if (word.trans && Array.isArray(word.trans)) {
          const translationMatch = word.trans.some(trans => 
            trans.toLowerCase().includes(searchTermLower)
          );
          
          if (translationMatch) {
            matchedWords.push({
              ...word,
              index: i,
              audioUrl: this.generateAudioUrl(word.name),
              matchType: 'translation'
            });
          }
        }
      }

      return {
        words: matchedWords,
        searchTerm,
        totalMatches: matchedWords.length,
        dictionary: {
          id: dictionary._id,
          name: dictionary.name,
          display_name: dictionary.display_name
        }
      };

    } catch (error) {
      throw new Error(`Failed to search words: ${error.message}`);
    }
  }

  /**
   * Get random words from dictionary
   */
  async getRandomWords(dictionaryId, count = 10) {
    try {
      const dictionary = await this.getDictionaryById(dictionaryId);
      const cacheKey = `${dictionary.name}_words`;
      
      let wordsData;
      if (this.wordCache.has(cacheKey)) {
        wordsData = this.wordCache.get(cacheKey);
      } else {
        const filePath = path.join(this.dictPath, `${dictionary.name}.json`);
        const fileContent = await fs.readFile(filePath, 'utf8');
        wordsData = JSON.parse(fileContent);
        
        if (this.wordCache.size < 10) {
          this.wordCache.set(cacheKey, wordsData);
        }
      }

      // Generate random indices
      const randomIndices = new Set();
      while (randomIndices.size < Math.min(count, wordsData.length)) {
        randomIndices.add(Math.floor(Math.random() * wordsData.length));
      }

      const randomWords = Array.from(randomIndices).map(index => ({
        ...wordsData[index],
        index,
        audioUrl: this.generateAudioUrl(wordsData[index].name)
      }));

      return {
        words: randomWords,
        count: randomWords.length,
        dictionary: {
          id: dictionary._id,
          name: dictionary.name,
          display_name: dictionary.display_name
        }
      };

    } catch (error) {
      throw new Error(`Failed to get random words: ${error.message}`);
    }
  }

  /**
   * Get dictionary statistics
   */
  async getDictionaryStats(dictionaryId) {
    try {
      const dictionary = await this.getDictionaryById(dictionaryId);
      
      return {
        id: dictionary._id,
        name: dictionary.name,
        display_name: dictionary.display_name,
        description: dictionary.description,
        total_words: dictionary.total_words,
        difficulty_level: dictionary.difficulty_level,
        category: dictionary.category,
        estimated_study_time: dictionary.estimatedStudyTime,
        file_size: dictionary.metadata.file_size,
        last_updated: dictionary.metadata.last_updated,
        created_at: dictionary.createdAt
      };

    } catch (error) {
      throw new Error(`Failed to get dictionary stats: ${error.message}`);
    }
  }

  /**
   * Generate audio URL for a word using Youdao API
   */
  generateAudioUrl(word) {
    if (!word) return null;
    const encodedWord = encodeURIComponent(word.trim());
    return `https://dict.youdao.com/dictvoice?audio=${encodedWord}&type=2`;
  }

  /**
   * Validate dictionary file structure
   */
  async validateDictionaryFile(dictionaryId) {
    try {
      const dictionary = await this.getDictionaryById(dictionaryId);
      const filePath = path.join(this.dictPath, `${dictionary.name}.json`);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`Dictionary file not found: ${filePath}`);
      }

      // Read and validate content
      const fileContent = await fs.readFile(filePath, 'utf8');
      const wordsData = JSON.parse(fileContent);

      if (!Array.isArray(wordsData)) {
        throw new Error('Dictionary file should contain an array of words');
      }

      // Validate word structure
      const sampleSize = Math.min(10, wordsData.length);
      const issues = [];

      for (let i = 0; i < sampleSize; i++) {
        const word = wordsData[i];
        if (!word.name || typeof word.name !== 'string') {
          issues.push(`Word at index ${i}: invalid or missing 'name' field`);
        }
        if (!word.trans || !Array.isArray(word.trans)) {
          issues.push(`Word at index ${i}: invalid or missing 'trans' field`);
        }
      }

      return {
        isValid: issues.length === 0,
        totalWords: wordsData.length,
        expectedWords: dictionary.total_words,
        issues,
        lastChecked: new Date()
      };

    } catch (error) {
      throw new Error(`Failed to validate dictionary file: ${error.message}`);
    }
  }

  /**
   * Clear word cache
   */
  clearCache() {
    this.wordCache.clear();
  }

  /**
   * Clear cache for specific dictionary
   */
  clearDictionaryCache(dictionaryName) {
    const cacheKey = `${dictionaryName}_words`;
    this.wordCache.delete(cacheKey);
  }
}

module.exports = new DictionaryService(); 