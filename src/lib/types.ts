import type { CanvasElementData } from '@/components/Canvas';

export type DocSettings = {
  aspectRatio: string;
  gridEnabled: boolean;
  gridCols: number;
  gridRows: number;
  gridThickness: number;
  gridColor: string;
  backgroundColor: string;
  generationFillColor: string;
};

export type DocState = {
  elements: CanvasElementData[];
  settings: DocSettings;
};

export interface Command {
  execute: () => void;
  undo: () => void;
}


