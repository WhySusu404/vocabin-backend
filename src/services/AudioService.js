const axios = require('axios');

class AudioService {
  constructor() {
    this.baseUrls = {
      youdao: 'https://dict.youdao.com/dictvoice',
      forvo: 'https://apifree.forvo.com/key',
      cambridge: 'https://dictionary.cambridge.org/media/english'
    };
    
    // Cache for audio URL validation results
    this.validationCache = new Map();
    this.maxCacheSize = 1000;
  }

  /**
   * Generate Youdao audio URL for a word
   * This is the primary audio service as specified in requirements
   */
  generateYoudaoAudioUrl(word, type = 2) {
    if (!word || typeof word !== 'string') {
      throw new Error('Word is required and must be a string');
    }

    const cleanWord = word.trim().toLowerCase();
    if (cleanWord.length === 0) {
      throw new Error('Word cannot be empty');
    }

    // Encode the word for URL
    const encodedWord = encodeURIComponent(cleanWord);
    
    // Type 1 = US pronunciation, Type 2 = UK pronunciation
    const audioType = type === 1 ? 1 : 2;
    
    return `${this.baseUrls.youdao}?audio=${encodedWord}&type=${audioType}`;
  }

  /**
   * Generate audio URLs for multiple pronunciation types
   */
  generateAudioUrls(word) {
    if (!word || typeof word !== 'string') {
      throw new Error('Word is required and must be a string');
    }

    const cleanWord = word.trim().toLowerCase();
    
    return {
      word: cleanWord,
      audio_urls: {
        youdao_us: this.generateYoudaoAudioUrl(cleanWord, 1),
        youdao_uk: this.generateYoudaoAudioUrl(cleanWord, 2),
        youdao_default: this.generateYoudaoAudioUrl(cleanWord) // UK by default
      },
      primary_url: this.generateYoudaoAudioUrl(cleanWord) // UK by default
    };
  }

  /**
   * Validate if an audio URL is accessible (optional feature)
   */
  async validateAudioUrl(url, timeout = 5000) {
    try {
      // Check cache first
      const cacheKey = url;
      if (this.validationCache.has(cacheKey)) {
        return this.validationCache.get(cacheKey);
      }

      // Make HEAD request to check if URL is accessible
      const response = await axios.head(url, {
        timeout: timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const isValid = response.status === 200;
      
      // Cache the result
      this.addToCache(cacheKey, {
        isValid,
        status: response.status,
        contentType: response.headers['content-type'],
        lastChecked: new Date()
      });

      return {
        isValid,
        status: response.status,
        contentType: response.headers['content-type'],
        lastChecked: new Date()
      };

    } catch (error) {
      const result = {
        isValid: false,
        error: error.message,
        status: error.response ? error.response.status : null,
        lastChecked: new Date()
      };

      // Cache the error result for a shorter time
      this.addToCache(url, result, 60000); // 1 minute cache for errors

      return result;
    }
  }

  /**
   * Validate audio URLs for a word
   */
  async validateWordAudio(word) {
    try {
      const audioUrls = this.generateAudioUrls(word);
      const validationPromises = Object.entries(audioUrls.audio_urls).map(
        async ([type, url]) => {
          const validation = await this.validateAudioUrl(url);
          return {
            type,
            url,
            ...validation
          };
        }
      );

      const validations = await Promise.all(validationPromises);
      
      return {
        word: audioUrls.word,
        validations,
        summary: {
          total_urls: validations.length,
          valid_urls: validations.filter(v => v.isValid).length,
          invalid_urls: validations.filter(v => !v.isValid).length
        }
      };

    } catch (error) {
      throw new Error(`Failed to validate audio for word "${word}": ${error.message}`);
    }
  }

  /**
   * Batch validate audio URLs for multiple words
   */
  async batchValidateAudio(words, concurrency = 5) {
    if (!Array.isArray(words)) {
      throw new Error('Words must be an array');
    }

    const results = [];
    
    // Process words in batches to avoid overwhelming the service
    for (let i = 0; i < words.length; i += concurrency) {
      const batch = words.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (word) => {
        try {
          return await this.validateWordAudio(word);
        } catch (error) {
          return {
            word,
            error: error.message,
            validations: []
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add small delay between batches to be respectful to the audio service
      if (i + concurrency < words.length) {
        await this.delay(100);
      }
    }

    return {
      total_words: words.length,
      results,
      summary: {
        successful_validations: results.filter(r => !r.error).length,
        failed_validations: results.filter(r => r.error).length
      }
    };
  }

  /**
   * Get audio metadata for a word
   */
  getAudioMetadata(word) {
    try {
      const audioUrls = this.generateAudioUrls(word);
      
      return {
        word: audioUrls.word,
        provider: 'Youdao Dictionary',
        supported_accents: ['US', 'UK'],
        default_accent: 'UK',
        audio_format: 'MP3',
        urls: audioUrls.audio_urls,
        primary_url: audioUrls.primary_url,
        usage_notes: 'Audio files are served by Youdao Dictionary service',
        generated_at: new Date()
      };

    } catch (error) {
      throw new Error(`Failed to get audio metadata for word "${word}": ${error.message}`);
    }
  }

  /**
   * Generate pronunciation guide data
   */
  generatePronunciationGuide(word, phonetics = null) {
    const audioUrls = this.generateAudioUrls(word);
    
    return {
      word: audioUrls.word,
      audio_urls: audioUrls.audio_urls,
      primary_audio: audioUrls.primary_url,
      phonetics: phonetics || {
        us: null, // Could be populated from dictionary data
        uk: null  // Could be populated from dictionary data
      },
      pronunciation_tips: this.generatePronunciationTips(word),
      study_suggestions: [
        'Listen to the audio multiple times',
        'Repeat the word aloud after listening',
        'Practice the word in different sentences',
        'Focus on stressed syllables'
      ]
    };
  }

  /**
   * Generate basic pronunciation tips
   */
  generatePronunciationTips(word) {
    const tips = [];
    
    // Basic tips based on word characteristics
    if (word.length > 8) {
      tips.push('This is a longer word - break it down into syllables');
    }
    
    if (word.includes('th')) {
      tips.push('Pay attention to the "th" sound - it can be voiced or voiceless');
    }
    
    if (word.endsWith('ed')) {
      tips.push('Notice how the "-ed" ending is pronounced (t, d, or id sound)');
    }
    
    if (word.includes('ough')) {
      tips.push('The "ough" combination can have different pronunciations');
    }
    
    return tips.length > 0 ? tips : ['Listen carefully and practice repeating the word'];
  }

  /**
   * Cache management
   */
  addToCache(key, value, ttl = 300000) { // 5 minutes default TTL
    // Implement simple LRU cache
    if (this.validationCache.size >= this.maxCacheSize) {
      const firstKey = this.validationCache.keys().next().value;
      this.validationCache.delete(firstKey);
    }

    const cacheEntry = {
      value,
      expires: Date.now() + ttl
    };

    this.validationCache.set(key, cacheEntry);
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of this.validationCache.entries()) {
      if (entry.expires < now) {
        this.validationCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.validationCache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    this.clearExpiredCache();
    
    return {
      total_entries: this.validationCache.size,
      max_size: this.maxCacheSize,
      cache_hit_rate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
    };
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for audio service
   */
  async healthCheck() {
    try {
      // Test with a common word
      const testWord = 'hello';
      const audioUrl = this.generateYoudaoAudioUrl(testWord);
      const validation = await this.validateAudioUrl(audioUrl, 3000);
      
      return {
        status: validation.isValid ? 'healthy' : 'degraded',
        service: 'Youdao Dictionary Audio',
        test_word: testWord,
        test_url: audioUrl,
        response_time: validation.responseTime,
        last_checked: new Date(),
        details: validation
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'Youdao Dictionary Audio',
        error: error.message,
        last_checked: new Date()
      };
    }
  }
}

module.exports = new AudioService(); 