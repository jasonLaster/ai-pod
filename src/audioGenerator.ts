import { ElevenLabsClient } from 'elevenlabs';
import fs from 'fs';
import path from 'path';
import { ScriptLine, SpeakerVoice } from './types';
import { config, speakerVoices } from './config';
import { Readable } from 'stream';
import ffmpeg from 'fluent-ffmpeg';

export class AudioGenerator {
  private readonly client: ElevenLabsClient;
  private readonly outputDir: string;

  constructor() {
    this.client = new ElevenLabsClient({
      apiKey: config.elevenLabsApiKey
    });

    this.outputDir = config.outputDir;

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
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

  async generateAudio(scriptLine: ScriptLine, index: number): Promise<string> {
    const voiceId = this.getVoiceId(scriptLine.speaker);
    const outputPath = path.join(this.outputDir, `${index.toString().padStart(3, '0')}.mp3`);

    try {
      // Generate audio using the SDK
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

      // Convert stream to buffer
      const audioBuffer = await this.streamToBuffer(response as unknown as Readable);

      // Write the audio buffer to a file
      fs.writeFileSync(outputPath, audioBuffer);

      console.log(`Generated audio file: ${outputPath} (${audioBuffer.length} bytes)`);
      return outputPath;
    } catch (error) {
      console.error(`Error generating audio for line ${index}:`, error);
      throw error;
    }
  }

  // Optional: Method to list available voices
  async listVoices() {
    try {
      const voices = await this.client.voices.getAll();
      return voices;
    } catch (error) {
      console.error('Error fetching voices:', error);
      throw error;
    }
  }

  async mergeAudioFiles(audioFiles: string[]): Promise<string> {
    const outputPath = path.join(this.outputDir, 'final_podcast.mp3');
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