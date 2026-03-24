import type { CanvasElementData } from '@/components/Canvas';

export type BackgroundPattern = 'none' | 'dots' | 'grid' | 'cross' | 'crossDot' | 'isometric';

export type DocSettings = {
  aspectRatio: string;
  gridEnabled: boolean;
  gridCols: number;
  gridRows: number;
  gridThickness: number;
  gridColor: string;
  backgroundColor: string;
  backgroundPattern: BackgroundPattern;
  generationFillColor: string;
};

export type PromptHistoryEntry = {
  id: string;
  text: string;
  timestamp: number;
};

export type DocState = {
  elements: CanvasElementData[];
  settings: DocSettings;
  promptHistory?: PromptHistoryEntry[];
};

export interface Command {
  execute: () => void;
  undo: () => void;
}


