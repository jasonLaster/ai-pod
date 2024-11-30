import { ScriptParser } from './scriptParser';
import { AudioGenerator } from './audioGenerator';
import fs from 'fs';
import path from 'path';

async function listAvailableVoices() {
  try {
    const audioGenerator = new AudioGenerator();
    const voices = await audioGenerator.listVoices();

    console.log('Available voices:');
    if (voices && voices.length > 0) {
      voices.forEach(voice => {
        console.log(`- ${voice.name || 'Unnamed'}: ${voice.voice_id || voice.voiceId || 'No ID'}`);
      });
    } else {
      console.log('No voices found');
    }
  } catch (error) {
    console.error('Error listing voices:', error);
  }
}

async function main() {
  try {
    const audioGenerator = new AudioGenerator();

    // Check for --list-voices flag
    if (process.argv.includes('--list-voices')) {
      await listAvailableVoices();
      return;
    }

    // Validate API key first
    console.log('Validating API key...');
    await audioGenerator.validateApiKey();

    // Get script path from command line args, skipping node and script name
    const scriptPath = process.argv.slice(2).find(arg => !arg.startsWith('--')) || './script.txt';

    // Resolve the path relative to current working directory
    const resolvedPath = path.resolve(process.cwd(), scriptPath);

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: Script file not found at ${resolvedPath}`);
      process.exit(1);
    }

    console.log(`Processing script: ${resolvedPath}`);

    // Parse the script
    const scriptLines = ScriptParser.parse(resolvedPath);

    // Generate audio for each line sequentially
    console.log('Generating audio files...');
    const audioFiles = await audioGenerator.generateAudioFiles(scriptLines);

    console.log('Audio files generated, merging...');
    const finalAudio = await audioGenerator.mergeAudioFiles(audioFiles);

    console.log('Audio generation complete!');
    console.log('Final audio file:', finalAudio);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 