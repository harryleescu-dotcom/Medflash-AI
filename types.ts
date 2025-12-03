export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  READING_FILE = 'READING_FILE',
  ANALYZING = 'ANALYZING', // New state
  REVIEW_CONFIG = 'REVIEW_CONFIG', // New state for user adjustment
  GENERATING = 'GENERATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface DocumentAnalysis {
  language: string;
  topic: string;
  suggestedCount: number;
  reasoning: string;
}

export interface AppState {
  status: ProcessingStatus;
  cards: Flashcard[];
  fileName: string | null;
  error: string | null;
  analysis: DocumentAnalysis | null;
}

export interface GenerationPreferences {
  examType: string;
  focusArea: string;
  cardCount: number;
  detailedContext: boolean;
}