import OpenAI from 'openai';
import { PromptContext, GeneratedScript, ScriptSection } from './types';

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateScriptSection(prompt: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a podcast script writer. Write natural, conversational dialogue."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 16_384,
    });

    return completion.choices[0].message.content || '';
  }
} 