import { Command } from '@/lib/types';
import { settingsStore } from '@/lib/settingsStore';

export class ZOrderCommand implements Command {
  private elementId: string;
  private operation: 'moveUp' | 'moveDown' | 'bringToFront' | 'sendToBack';
  private originalIndex: number = -1;

  constructor(elementId: string, operation: 'moveUp' | 'moveDown' | 'bringToFront' | 'sendToBack') {
    this.elementId = elementId;
    this.operation = operation;
  }

  execute(): void {
    const currentDoc = settingsStore.getState().doc;
    if (!currentDoc) return;

    const arr = [...currentDoc.elements];
    const idx = arr.findIndex(e => e.id === this.elementId);
    if (idx === -1) return;
    
    this.originalIndex = idx;
    const [item] = arr.splice(idx, 1);

    switch (this.operation) {
      case 'moveUp':
        if (idx > 0) arr.splice(idx - 1, 0, item);
        else arr.splice(idx, 0, item); // No change
        break;
      case 'moveDown':
        if (idx < arr.length) arr.splice(idx + 1, 0, item);
        else arr.splice(idx, 0, item); // No change
        break;
      case 'bringToFront':
        arr.unshift(item);
        break;
      case 'sendToBack':
        arr.push(item);
        break;
    }
    
    settingsStore.setState({ doc: { ...currentDoc, elements: arr } });
  }

  undo(): void {
    const currentDoc = settingsStore.getState().doc;
    if (!currentDoc || this.originalIndex === -1) return;

    const arr = [...currentDoc.elements];
    const idx = arr.findIndex(e => e.id === this.elementId);
    if (idx === -1) return;

    const [item] = arr.splice(idx, 1);
    arr.splice(this.originalIndex, 0, item);

    settingsStore.setState({ doc: { ...currentDoc, elements: arr } });
  }
}
