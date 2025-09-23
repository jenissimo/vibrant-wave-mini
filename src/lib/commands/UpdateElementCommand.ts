import { Command } from '@/lib/types';
import { settingsStore } from '@/lib/settingsStore';
import { CanvasElementData } from '@/components/Canvas';

type ElementUpdate = Partial<CanvasElementData>;

export class UpdateElementCommand implements Command {
  private elementId: string;
  private oldProps: ElementUpdate;
  private newProps: ElementUpdate;
  private originalElementState: CanvasElementData | null = null;

  constructor(elementId: string, oldProps: ElementUpdate, newProps: ElementUpdate) {
    this.elementId = elementId;
    this.oldProps = oldProps;
    this.newProps = newProps;
  }

  execute(): void {
    this.applyProps(this.newProps);
  }

  undo(): void {
    this.applyProps(this.oldProps);
  }

  private applyProps(props: ElementUpdate): void {
    const currentDoc = settingsStore.getState().doc;
    if (currentDoc) {
      const updatedElements = currentDoc.elements.map(el => {
        if (el.id === this.elementId) {
          if (!this.originalElementState) {
            this.originalElementState = { ...el };
          }
          return { ...el, ...props };
        }
        return el;
      });
      settingsStore.setState({ doc: { ...currentDoc, elements: updatedElements } });
    }
  }
}
