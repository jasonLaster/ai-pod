import { ScriptParser } from './scriptParser';
import { AudioGenerator } from './audioGenerator';
import fs from 'fs';

async function listAvailableVoices() {
  const audioGenerator = new AudioGenerator();
  const voices = await audioGenerator.listVoices();
  console.log('Available voices:');
  voices.forEach(voice => {
    console.log(`- ${voice.name}: ${voice.voiceId}`);
  });
}

async function main() {
  try {
    // Parse the script
    const scriptLines = ScriptParser.parse('./script.txt');
    const audioGenerator = new AudioGenerator();

    // Generate audio for each line
    console.log('Generating audio files...');
    const audioFiles = await Promise.all(
      scriptLines.map((line, index) =>
        audioGenerator.generateAudio(line, index)
      )
    );

    console.log('Audio files generated, merging...');
    const finalAudio = await audioGenerator.mergeAudioFiles(audioFiles);

    console.log('Audio generation complete!');
    console.log('Final audio file:', finalAudio);

    // Optional: Clean up individual audio files
    audioFiles.forEach(file => {
      fs.unlinkSync(file);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 