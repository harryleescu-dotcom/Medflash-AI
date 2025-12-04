
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  boundingBox?: number[]; // [ymin, xmin, ymax, xmax] of the LABEL
  structureBoundingBox?: number[]; // [ymin, xmin, ymax, xmax] of the ANATOMY
  image?: string; // Base64 string of the processed card image
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  READING_FILE = 'READING_FILE',
  ANALYZING = 'ANALYZING',
  REVIEW_CONFIG = 'REVIEW_CONFIG',
  GENERATING = 'GENERATING',
  PROCESSING_IMAGES = 'PROCESSING_IMAGES', // New step for client-side cropping
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface DocumentAnalysis {
  language: string;
  topic: string;
  suggestedCount: number;
  reasoning: string;
  hasImages: boolean;
  imageCountEstimate: string;
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

// Declare JSZip for global usage since it's loaded via script tag
declare global {
  interface Window {
    JSZip: any;
  }
}
