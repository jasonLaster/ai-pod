import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { PromptContext, ScriptSection, SectionType, GeneratedScript } from './types';
import { PromptBuilder } from './promptBuilder';
export class SectionedPromptBuilder {
  private baseBuilder: PromptBuilder;
  private contextPath: string;

  constructor() {
    this.baseBuilder = new PromptBuilder();
    this.contextPath = path.join(process.cwd(), 'prompts', 'context');
  }

  async initialize() {
    await this.baseBuilder.initialize();
  }

  private getSectionInstructions(type: SectionType): string {
    const instructions = {
      [SectionType.INTRODUCTION]:
        "Create a 2-3 minute engaging introduction that hooks the audience and introduces the topic of nuclear energy. Include the host and guests introducing themselves.",

      [SectionType.CONTEXT]:
        "Discuss the current global energy crisis and climate change context. Focus on how nuclear energy fits into these challenges. Keep this section to 3-4 minutes.",

      [SectionType.ROLE]:
        "Explain nuclear power's current status and potential. Include specific data and examples about its contribution to clean energy. Aim for 3-4 minutes.",

      [SectionType.DEPLOYMENT]:
        "Cover innovations like SMRs and global investment trends in nuclear technology. Include specific examples and data. Make this section 3-4 minutes.",

      [SectionType.BENEFITS]:
        "Discuss benefits beyond electricity generation, including hydrogen production and energy security. Use concrete examples. Keep to 3-4 minutes.",

      [SectionType.CHALLENGES]:
        "Address main challenges including public perception, market reforms, and workforce issues. Provide balanced perspective. Aim for 3-4 minutes.",

      [SectionType.CONCLUSION]:
        "Summarize key points and provide a forward-looking perspective on nuclear energy's role in the future. Keep this section to 2-3 minutes."
    };

    return instructions[type] || "Discuss this section of the nuclear energy topic";
  }

  private async parseContentFile(filePath: string): Promise<Map<SectionType, string>> {
    const content = await readFile(filePath, 'utf-8');
    const sections = new Map<SectionType, string>();

    // Parse the content and map it to sections
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.includes('Context and Objectives:')) {
        if (currentContent.length) sections.set(SectionType.CONTEXT, currentContent.join('\n'));
        currentContent = [];
      } else if (line.includes('Role of Nuclear Power:')) {
        if (currentContent.length) sections.set(SectionType.ROLE, currentContent.join('\n'));
        currentContent = [];
      } else if (line.includes('Deployment and Innovations:')) {
        if (currentContent.length) sections.set(SectionType.DEPLOYMENT, currentContent.join('\n'));
        currentContent = [];
      } else if (line.includes('Benefits Beyond Electricity:')) {
        if (currentContent.length) sections.set(SectionType.BENEFITS, currentContent.join('\n'));
        currentContent = [];
      } else if (line.includes('Challenges and Recommendations:')) {
        if (currentContent.length) sections.set(SectionType.CHALLENGES, currentContent.join('\n'));
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    return sections;
  }

  async generateSectionedPrompts(context: PromptContext, contentFile: string): Promise<ScriptSection[]> {
    const sections = await this.parseContentFile(path.join(this.contextPath, contentFile));
    const scriptSections: ScriptSection[] = [];

    // Add introduction
    scriptSections.push({
      type: SectionType.INTRODUCTION,
      title: "Introduction to Nuclear Energy",
      content: context.topic,
      instructions: this.getSectionInstructions(SectionType.INTRODUCTION)
    });

    // Add main sections
    for (const [type, content] of sections.entries()) {
      scriptSections.push({
        type,
        title: type.charAt(0).toUpperCase() + type.slice(1),
        content,
        instructions: this.getSectionInstructions(type)
      });
    }

    // Add conclusion
    scriptSections.push({
      type: SectionType.CONCLUSION,
      title: "Conclusion",
      content: "Summary and future outlook",
      instructions: this.getSectionInstructions(SectionType.CONCLUSION)
    });

    return scriptSections;
  }

  async buildSectionPrompt(context: PromptContext, section: ScriptSection): Promise<string> {
    const sectionContext = {
      ...context,
      topic: `${section.title}\n\n${section.instructions}\n\n${section.content}`
    };

    return await this.baseBuilder.buildPrompt(sectionContext);
  }

  async generateFullScript(context: PromptContext, contentFile: string): Promise<GeneratedScript[]> {
    const sections = await this.generateSectionedPrompts(context, contentFile);
    const generatedScripts: GeneratedScript[] = [];

    for (const section of sections) {
      console.log(`Building prompt for section: ${section.type}`, section);
      const prompt = await this.buildSectionPrompt(context, section);
      // Here you would call your AI service to generate the script
      generatedScripts.push({
        section: section.type,
        content: prompt // Replace this with actual AI-generated content
      });
    }

    return generatedScripts;
  }
} 