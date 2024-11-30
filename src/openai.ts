import OpenAI from 'openai';
import { PromptBuilder } from './promptBuilder';
import { PromptContext } from './types';

export class ScriptGenerator {
  private openai: OpenAI;
  private promptBuilder: PromptBuilder;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.promptBuilder = new PromptBuilder();
  }

  async initialize() {
    await this.promptBuilder.initialize();
  }

  async generateScript(context: PromptContext): Promise<string> {
    const xmlPrompt = await this.promptBuilder.buildPrompt(context);

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a skilled scriptwriter who understands XML-formatted prompts. Generate dialogue based on the XML structure provided."
        },
        {
          role: "user",
          content: xmlPrompt
        }
      ],
      temperature: 0.7,
      response_format: { type: "text" }
    });

    return completion.choices[0].message.content || '';
  }
} 