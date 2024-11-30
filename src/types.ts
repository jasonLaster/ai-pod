export enum SectionType {
  INTRODUCTION = 'introduction',
  CONTEXT = 'context',
  ROLE = 'role',
  DEPLOYMENT = 'deployment',
  BENEFITS = 'benefits',
  CHALLENGES = 'challenges',
  CONCLUSION = 'conclusion'
}

export interface ScriptSection {
  type: SectionType;
  title: string;
  content: string;
  instructions: string;
}

export interface PromptContext {
  topic: string;
  characters: Array<{ name: string; role: string }>;
  additionalContext?: string[];
}

export interface GeneratedScript {
  section: SectionType;
  content: string;
} 