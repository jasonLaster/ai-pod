export interface Character {
  name: string;
  role: string;
  personality: string;
  background: string;
  exampleDialogue?: string[];
  referenceText?: string;
}

export interface PromptContext {
  topic: string;
  characters: Character[];
  additionalContext?: string[];
  format?: string;
}

export interface PromptTemplate {
  content: string;
  variables: string[];
}

export interface XMLPrompt {
  system: string;
  context: string;
  characters: string;
  format: string;
  examples?: string;
  podcastStyle?: PodcastReference[];
}

export interface PodcastReference {
  name: string;
  episode: string;
  transcript: string;
  notes?: {
    style?: string[];
    techniques?: string[];
    format?: string[];
  };
} 