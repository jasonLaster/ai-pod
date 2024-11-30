import { ScriptParser } from './scriptParser';
import { AudioGenerator } from './audioGenerator';
import { ScriptGenerator } from './scriptGenerator';
import { PromptContext } from './types';
import path from 'path';

async function generateScript(context: PromptContext): Promise<{ script: string, outputDir: string }> {
  const generator = new ScriptGenerator(process.env.OPENAI_API_KEY!);
  await generator.initialize();
  return await generator.generateFullScript(context, 'nuclear2.txt');
}

async function listAvailableVoices() {
  try {
    const audioGenerator = new AudioGenerator();
    const voices = await audioGenerator.listVoices();
    console.log('Available voices:', voices);
  } catch (error) {
    console.error('Error listing voices:', error);
  }
}

async function main() {
  try {
    // Get script path from command line args
    const scriptPath = process.argv.slice(2).find(arg => !arg.startsWith('--'));
    let script: string;
    let outputDir: string;

    if (scriptPath) {
      // Use existing script file
      outputDir = path.dirname(scriptPath);
      script = await Bun.file(scriptPath).text();
      console.log(`Using existing script from ${scriptPath}`);
    } else {
      // Generate new script
      console.log('Generating new script...');
      const context: PromptContext = {
        topic: "Nuclear Energy's Role in Climate Change",
        characters: [
          { name: "Charlie", role: "Host" },
          { name: "Evie", role: "Scientist" },
          { name: "Ravi", role: "Policy Maker" }
        ]
      };

      const result = await generateScript(context);
      script = result.script;
      outputDir = result.outputDir;
      console.log(`Generated script written to ${outputDir}`);
    }

    // Handle audio generation
    if (!process.argv.includes('--no-audio')) {
      const audioGenerator = new AudioGenerator();

      if (process.argv.includes('--list-voices')) {
        await listAvailableVoices();
        return;
      }

      console.log('Validating API key...');
      await audioGenerator.validateApiKey();

      console.log('Processing script...');
      const scriptLines = ScriptParser.parse(path.join(outputDir, 'full-script.txt'));

      console.log('Generating audio files...');
      const audioFiles = await audioGenerator.generateAudioFiles(scriptLines, outputDir);

      console.log('Merging audio files...');
      const finalAudio = await audioGenerator.mergeAudioFiles(audioFiles, outputDir);

      console.log('Audio generation complete!');
      console.log('Final audio file:', finalAudio);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 