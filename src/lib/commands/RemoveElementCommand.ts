import { Command } from '@/lib/types';
import { settingsStore } from '@/lib/settingsStore';
import { CanvasElementData } from '@/components/Canvas';

export class RemoveElementCommand implements Command {
  private elementId: string;
  private removedElement: CanvasElementData | null = null;
  private originalIndex: number = -1;

  constructor(elementId: string) {
    this.elementId = elementId;
  }

  execute(): void {
    const currentDoc = settingsStore.getState().doc;
    if (currentDoc) {
      this.originalIndex = currentDoc.elements.findIndex(el => el.id === this.elementId);
      if (this.originalIndex !== -1) {
        this.removedElement = currentDoc.elements[this.originalIndex];
        const updatedElements = currentDoc.elements.filter(el => el.id !== this.elementId);
        settingsStore.setState({ doc: { ...currentDoc, elements: updatedElements } });
      }
    }
  }

  undo(): void {
    const currentDoc = settingsStore.getState().doc;
    if (currentDoc && this.removedElement && this.originalIndex !== -1) {
      const updatedElements = [...currentDoc.elements];
      updatedElements.splice(this.originalIndex, 0, this.removedElement);
      settingsStore.setState({ doc: { ...currentDoc, elements: updatedElements } });
    }
  }
}
