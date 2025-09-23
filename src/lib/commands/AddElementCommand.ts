import { Command } from '@/lib/types';
import { settingsStore } from '@/lib/settingsStore';
import { CanvasElementData } from '@/components/Canvas';

export class AddElementCommand implements Command {
  private element: CanvasElementData;

  constructor(element: CanvasElementData) {
    this.element = element;
  }

  execute(): void {
    const currentDoc = settingsStore.getState().doc;
    if (currentDoc) {
      const updatedElements = [this.element, ...currentDoc.elements];
      settingsStore.setState({ doc: { ...currentDoc, elements: updatedElements } });
    }
  }

  undo(): void {
    const currentDoc = settingsStore.getState().doc;
    if (currentDoc) {
      const updatedElements = currentDoc.elements.filter(el => el.id !== this.element.id);
      settingsStore.setState({ doc: { ...currentDoc, elements: updatedElements } });
    }
  }
}
