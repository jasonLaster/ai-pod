import { ScriptLine } from './types';
import fs from 'fs';

export class ScriptParser {
  static parse(filePath: string): ScriptLine[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const scriptLines: ScriptLine[] = [];

    for (const line of lines) {
      // Expect format: "SPEAKER: Text goes here"
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        scriptLines.push({
          speaker: match[1].trim(),
          text: match[2].trim(),
        });
      }
    }

    return scriptLines;
  }
} 