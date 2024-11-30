import { ElevenLabsClient } from 'elevenlabs';
import fs from 'fs';
import path from 'path';
import { ScriptLine, SpeakerVoice } from './types';
import { config, speakerVoices } from './config';
import { Readable } from 'stream';
import ffmpeg from 'fluent-ffmpeg';
import { AudioCache } from './cache';
import PQueue from 'p-queue';

export class AudioGenerator {
  private readonly outputDir: string;
  private client: ElevenLabsClient;
  private cache: AudioCache;
  private queue: PQueue;

  constructor() {
    if (!config.elevenLabsApiKey) {
      throw new Error('ElevenLabs API key is not configured');
    }

    this.initClient();
    this.cache = new AudioCache();

    // Initialize queue with concurrency of 5
    this.queue = new PQueue({
      concurrency: 5,
      interval: 1000,  // Time between dequeuing new items
      intervalCap: 2   // Number of items to process per interval
    });

    // Create a timestamped directory for this run
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.outputDir = path.join(config.outputDir, timestamp);

    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    console.log(`Output directory: ${this.outputDir}`);
  }

  private initClient() {
    this.client = new ElevenLabsClient({
      apiKey: config.elevenLabsApiKey
    });
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 5,
    initialDelay: number = 1000,
    maxDelay: number = 32000
  ): Promise<T> {
    let lastError;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        if (attempt > 0) {
          // Exponential backoff with jitter
          const exponentialDelay = Math.min(
            initialDelay * Math.pow(2, attempt),
            maxDelay
          );
          const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
          const delayMs = exponentialDelay + jitter;

          console.log(`Attempt ${attempt + 1}/${maxRetries}: Waiting ${Math.round(delayMs)}ms before retry...`);
          await this.delay(delayMs);

          // Reinitialize client on retry
          this.initClient();
        }

        return await operation();
      } catch (error: any) {
        lastError = error;
        attempt++;

        if (error?.statusCode === 429 || error?.statusCode === 401) {
          console.log(`API error (${error?.statusCode}), attempt ${attempt} of ${maxRetries}`);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async generateAudioFiles(scriptLines: ScriptLine[]): Promise<string[]> {
    const audioFiles: string[] = new Array(scriptLines.length);
    const errors: Error[] = [];

    // Add all tasks to the queue
    const promises = scriptLines.map((line, index) =>
      this.queue.add(async () => {
        try {
          const audioFile = await this.generateAudio(line, index);
          audioFiles[index] = audioFile;
        } catch (error) {
          console.error(`Failed to generate audio for line ${index}`);
          errors.push(error as Error);
        }
      })
    );

    // Wait for all tasks to complete
    await Promise.all(promises);

    // Check for errors
    if (errors.length > 0) {
      throw new Error(`Failed to generate ${errors.length} audio files`);
    }

    // Remove any undefined entries (shouldn't happen if no errors)
    return audioFiles.filter(Boolean);
  }

  async generateAudio(scriptLine: ScriptLine, index: number): Promise<string> {
    const outputPath = path.join(this.outputDir, `${index.toString().padStart(3, '0')}.mp3`);

    // Check cache first
    const cachedPath = this.cache.get(scriptLine.speaker, scriptLine.text);
    if (cachedPath) {
      console.log(`Using cached audio for line ${index}`);
      this.cache.copyToOutputDir(cachedPath, outputPath);
      return outputPath;
    }

    try {
      console.log(`Generating audio for line ${index}: "${scriptLine.text.substring(0, 50)}..."`);

      // Add delay between requests to avoid rate limits
      await this.delay(2000);

      const voiceId = this.getVoiceId(scriptLine.speaker);
      const response = await this.retryWithBackoff(() =>
        this.client.textToSpeech.convert(voiceId, {
          model_id: 'eleven_turbo_v2',
          text: scriptLine.text,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0,
            use_speaker_boost: true
          }
        })
      );

      const audioBuffer = await this.streamToBuffer(response as unknown as Readable);

      // Verify buffer has content
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Received empty audio buffer');
      }

      fs.writeFileSync(outputPath, audioBuffer);

      // Cache the generated audio
      this.cache.set(scriptLine.speaker, scriptLine.text, outputPath);

      console.log(`Generated audio file: ${outputPath} (${audioBuffer.length} bytes)`);
      return outputPath;
    } catch (error) {
      console.error(`Error generating audio for line ${index}:`, error);
      throw error;
    }
  }

  async validateApiKey() {
    try {
      const voices = await this.listVoices();
      if (!voices || voices.length === 0) {
        throw new Error('Could not fetch voices with provided API key');
      }
      console.log('API key validated successfully');
    } catch (error) {
      console.error('API key validation failed:', error);
      throw new Error('Invalid or expired API key');
    }
  }

  private getVoiceId(speaker: string): string {
    const voice = speakerVoices.find(v => v.speaker === speaker);
    if (!voice) {
      throw new Error(`No voice ID configured for speaker: ${speaker}`);
    }
    return voice.voiceId;
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  // Updated listVoices method
  async listVoices() {
    try {
      const response = await this.client.voices.getAll();
      // Ensure we're returning an array of voices
      return Array.isArray(response) ? response : response.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      throw error;
    }
  }

  async mergeAudioFiles(audioFiles: string[]): Promise<string> {
    const timestamp = new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/[/:]/g, '-');
    const outputPath = path.join(this.outputDir, `${timestamp}.mp3`);
    const fileList = path.join(this.outputDir, 'files.txt');

    // Create a file list for FFmpeg
    const fileContent = audioFiles
      .map(file => `file '${path.resolve(file)}'`)
      .join('\n');
    fs.writeFileSync(fileList, fileContent);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(fileList)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .output(outputPath)
        .on('end', () => {
          // Clean up the file list
          fs.unlinkSync(fileList);
          console.log(`Successfully merged audio files to: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Error merging audio files:', err);
          reject(err);
        })
        .run();
    });
  }
} 