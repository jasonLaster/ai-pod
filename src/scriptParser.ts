import { ScriptLine } from './types';
import fs from 'fs';

export class ScriptParser {
  static parse(filePath: string): ScriptLine[] {
    console.log(`Parsing script from ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const scriptLines: ScriptLine[] = [];

    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue;

      // Expect format: "Speaker: Text goes here" (allowing for mixed case names)
      const match = line.match(/^([A-Za-z0-9]+):\s*(.+)$/);
      if (match) {
        // console.log(line, match[1].trim(), match[2].trim());
        scriptLines.push({
          speaker: match[1].trim(),
          text: match[2].trim(),
        });
      } else {
        console.warn(`Skipping invalid line format: ${line}`);
      }
    }

    // Validate that we have lines
    if (scriptLines.length === 0) {
      throw new Error(`No valid script lines found in ${filePath}`);
    }

    // Log the parsed lines for debugging
    // console.log('Parsed script lines:', scriptLines);

    return scriptLines;
  }
} 