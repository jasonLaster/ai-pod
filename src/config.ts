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
  { speaker: 'Charlie', voiceId: 'CwhRBWXzGAHq8TQ4Fs17' },
  { speaker: 'Evie', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
  { speaker: 'Ravi', voiceId: 'bIHbv24MWmeRgasZH58o' },
]; 