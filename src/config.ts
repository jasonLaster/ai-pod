import dotenv from 'dotenv';
dotenv.config();

if (!process.env.ELEVEN_LABS_API_KEY) {
  throw new Error('ELEVEN_LABS_API_KEY is not set in .env file');
}

export const config = {
  elevenLabsApiKey: process.env.ELEVEN_LABS_API_KEY,
  outputDir: './output',
};

export const speakerVoices: SpeakerVoice[] = [
  { speaker: 'Charlie', voiceId: 'iP95p4xoKVk53GoZ742B' },
  { speaker: 'Evie', voiceId: 'cgSgspJ2msm6clMCkdW9' },
  { speaker: 'Ravi', voiceId: 'cjVigY5qzO86Huf0OWal' },
]; 