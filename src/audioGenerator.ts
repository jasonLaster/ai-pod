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
  }

  private initClient() {
    this.client = new ElevenLabsClient({
      apiKey: config.elevenLabsApiKey
    });
  }

  async generateAudioFiles(scriptLines: ScriptLine[], outputDir: string): Promise<string[]> {
    console.log(`Generating ${scriptLines.length} audio files...`);

    const tasks = scriptLines.map((line, index) => async () => {
      return this.generateAudio(line, index, outputDir);
    });

    try {
      const audioFiles = await this.queue.addAll(tasks);
      console.log('All audio files generated successfully');
      return audioFiles.filter((file): file is string => file !== null);
    } catch (error) {
      console.error('Error generating audio files:', error);
      throw error;
    }
  }

  private async generateAudio(scriptLine: ScriptLine, index: number, outputDir: string): Promise<string> {
    const outputPath = path.join(outputDir, `${index.toString().padStart(3, '0')}-${scriptLine.speaker}.mp3`);

    // Check cache first
    const cachedPath = this.cache.get(scriptLine.speaker, scriptLine.text);
    if (cachedPath) {
      console.log(`Using cached audio for line ${index}`);
      await this.cache.copyToOutputDir(cachedPath, outputPath);
      return outputPath;
    }

    return await this.retryWithBackoff(async () => {
      console.log(`Generating audio for line ${index}: "${scriptLine.text.substring(0, 50)}..."`);

      const voiceId = this.getVoiceId(scriptLine.speaker);
      const response = await this.client.textToSpeech.convert(voiceId, {
        model_id: 'eleven_turbo_v2',
        text: scriptLine.text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0,
          use_speaker_boost: true
        }
      });

      const audioBuffer = await this.streamToBuffer(response as unknown as Readable);

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Received empty audio buffer');
      }

      await Bun.write(outputPath, audioBuffer);
      await this.cache.set(scriptLine.speaker, scriptLine.text, outputPath);

      console.log(`Generated audio file: ${outputPath} (${audioBuffer.length} bytes)`);
      return outputPath;
    });
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
          const exponentialDelay = Math.min(
            initialDelay * Math.pow(2, attempt),
            maxDelay
          );
          const jitter = Math.random() * 1000;
          const delayMs = exponentialDelay + jitter;

          console.log(`Attempt ${attempt + 1}/${maxRetries}: Waiting ${Math.round(delayMs)}ms before retry...`);
          await this.delay(delayMs);
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

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async mergeAudioFiles(audioFiles: string[], outputDir: string): Promise<string> {
    const outputPath = path.join(outputDir, 'final-audio.mp3');

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add each audio file to the command
      audioFiles.forEach(file => {
        command.input(file);
      });

      // Concatenate all files
      command
        .on('error', (err) => {
          console.error('Error merging audio files:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('Audio merge completed');
          resolve(outputPath);
        })
        .mergeToFile(outputPath);
    });
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

  async listVoices() {
    try {
      const response = await this.client.voices.getAll();
      return Array.isArray(response) ? response : response.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      throw error;
    }
  }
} 