import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { PromptContext, PromptTemplate, XMLPrompt } from './types';

export class PromptBuilder {
  private baseTemplate: string = '';
  private charactersPath: string;
  private contextPath: string;
  private referencePath: string;
  private transcriptsPath: string;

  constructor() {
    this.charactersPath = path.join(process.cwd(), 'prompts', 'templates', 'characters');
    this.contextPath = path.join(process.cwd(), 'prompts', 'context');
    this.referencePath = path.join(process.cwd(), 'prompts', 'references');
    this.transcriptsPath = path.join(process.cwd(), 'prompts', 'references', 'transcripts');
  }

  async initialize() {
    this.baseTemplate = await readFile(
      path.join(process.cwd(), 'prompts', 'templates', 'base.txt'),
      'utf-8'
    );
  }

  async loadCharacter(name: string): Promise<string> {
    const characterTemplate = await readFile(
      path.join(this.charactersPath, `${name}.txt`),
      'utf-8'
    );

    // Try to load additional reference text if it exists
    try {
      const referenceText = await readFile(
        path.join(this.referencePath, `${name}_reference.txt`),
        'utf-8'
      );

      return characterTemplate.replace(
        '</character>',
        `  <additional_references>\n    <![CDATA[${referenceText}]]>\n  </additional_references>\n</character>`
      );
    } catch (e) {
      return characterTemplate;
    }
  }

  async loadContext(contextFile: string): Promise<string> {
    const content = await readFile(
      path.join(this.contextPath, contextFile),
      'utf-8'
    );
    return `<context_file name="${contextFile}">${content}</context_file>`;
  }

  async loadTranscripts(): Promise<string> {
    const transcriptFiles = await readdir(this.transcriptsPath);
    const transcripts = await Promise.all(
      transcriptFiles
        .filter(file => file.endsWith('.txt'))
        .map(async file => {
          try {
            const content = await readFile(
              path.join(this.transcriptsPath, file),
              'utf-8'
            );
            return content.trim();
          } catch (e) {
            console.warn(`Failed to load transcript: ${file}`);
            return '';
          }
        })
    );

    const validTranscripts = transcripts.filter(t => t.length > 0);
    return validTranscripts.join('\n\n');
  }

  async buildPrompt(context: PromptContext): Promise<string> {
    let prompt = this.baseTemplate;

    // Load character information
    const characterPrompts = await Promise.all(
      context.characters.map(char => this.loadCharacter(char.name.toLowerCase()))
    );

    // Load additional context files
    const additionalContexts = await Promise.all(
      (context.additionalContext || []).map(ctx => this.loadContext(ctx))
    );

    // Load transcripts
    const transcripts = await this.loadTranscripts();

    // Replace variables in the template
    prompt = prompt
      .replace('{{TOPIC}}', `<![CDATA[${context.topic}]]>`)
      .replace('{{CHARACTERS}}', characterPrompts.join('\n'))
      .replace('{{ADDITIONAL_CONTEXT}}', `<additional_context>${additionalContexts.join('\n')}</additional_context>`)
      .replace('{{TRANSCRIPTS}}', transcripts);

    return prompt;
  }

  private sanitizeXML(text: string): string {
    return `<![CDATA[${text}]]>`;
  }
} 