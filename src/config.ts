import dotenv from 'dotenv';
dotenv.config();

export const config = {
  elevenLabsApiKey: process.env.ELEVEN_LABS_API_KEY || '',
  outputDir: './output',
};

export const speakerVoices: SpeakerVoice[] = [
  { speaker: 'HOST', voiceId: '21m00Tcm4TlvDq8ikWAM' },
  { speaker: 'GUEST1', voiceId: 'AZnzlk1XvdvUeBnXmlld' },
  // Add more speakers and their voice IDs as needed
]; 