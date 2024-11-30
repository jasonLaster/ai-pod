import { OpenAIService } from './openai';
import { SectionedPromptBuilder } from './sectionedPromptBuilder';
import { PromptContext, GeneratedScript, ScriptSection } from './types';
import path from 'path';
import { mkdir } from 'fs/promises';

export class ScriptGenerator {
  private openAI: OpenAIService;
  private promptBuilder: SectionedPromptBuilder;
  private outputDir: string;

  constructor(apiKey: string) {
    this.openAI = new OpenAIService(apiKey);
    this.promptBuilder = new SectionedPromptBuilder();

    // Create output directory with timestamp HH-mm
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
    this.outputDir = path.join(process.cwd(), 'output', timestamp);
  }

  async initialize() {
    // Create output directory
    await mkdir(this.outputDir, { recursive: true });
    await this.promptBuilder.initialize();
  }

  async generateFullScript(context: PromptContext, contentFile: string): Promise<{ script: string, outputDir: string }> {
    const sections = await this.promptBuilder.generateSectionedPrompts(context, contentFile);
    const generatedScripts: GeneratedScript[] = [];

    // Generate script for each section
    for (const section of sections) {
      console.log(`Generating section: ${section.type}`);
      const prompt = await this.promptBuilder.buildSectionPrompt(context, section);

      // Save prompt to output directory
      const promptFileName = `prompt-${section.type.toLowerCase()}.txt`;
      await Bun.write(path.join(this.outputDir, promptFileName), prompt);

      // Generate content
      const content = await this.openAI.generateScriptSection(prompt);

      // Save section content
      const sectionFileName = `section-${section.type.toLowerCase()}.txt`;
      await Bun.write(path.join(this.outputDir, sectionFileName), content);

      generatedScripts.push({
        section: section.type,
        content
      });
    }

    const fullScript = this.combineScripts(generatedScripts);

    // Save full script
    await Bun.write(path.join(this.outputDir, 'full-script.txt'), fullScript);

    return {
      script: fullScript,
      outputDir: this.outputDir
    };
  }

  private combineScripts(scripts: GeneratedScript[]): string {
    return scripts.map(script => script.content).join('\n\n');
  }
} 