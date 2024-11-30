import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface CacheEntry {
  speaker: string;
  text: string;
  audioPath: string;
  timestamp: number;
}

export class AudioCache {
  private cacheFile: string;
  private cache: Map<string, CacheEntry>;

  constructor(cacheDir: string = './cache') {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    this.cacheFile = path.join(cacheDir, 'audio-cache.json');
    this.cache = new Map();
    this.loadCache();
  }

  private generateKey(speaker: string, text: string): string {
    return crypto
      .createHash('md5')
      .update(`${speaker}:${text}`)
      .digest('hex');
  }

  private loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
        this.cache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('Failed to load cache:', error);
      this.cache = new Map();
    }
  }

  private saveCache() {
    try {
      const data = Object.fromEntries(this.cache);
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to save cache:', error);
    }
  }

  get(speaker: string, text: string): string | null {
    const key = this.generateKey(speaker, text);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Verify the cached file still exists
    if (!fs.existsSync(entry.audioPath)) {
      this.cache.delete(key);
      this.saveCache();
      return null;
    }

    return entry.audioPath;
  }

  set(speaker: string, text: string, audioPath: string) {
    const key = this.generateKey(speaker, text);
    this.cache.set(key, {
      speaker,
      text,
      audioPath,
      timestamp: Date.now()
    });
    this.saveCache();
  }

  copyToOutputDir(cachedPath: string, outputPath: string) {
    fs.copyFileSync(cachedPath, outputPath);
  }
} 