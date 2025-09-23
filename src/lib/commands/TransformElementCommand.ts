import { Command, DocState } from '@/lib/types';
import { settingsStore } from '@/lib/settingsStore';
import { CanvasElementData } from '@/components/Canvas';

type TransformableProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

export class TransformElementCommand implements Command {
  private elementId: string;
  private oldProps: TransformableProps;
  private newProps: TransformableProps;

  constructor(elementId: string, oldProps: TransformableProps, newProps: TransformableProps) {
    this.elementId = elementId;
    this.oldProps = oldProps;
    this.newProps = newProps;
  }

  execute(): void {
    this.setElementProps(this.newProps);
  }

  undo(): void {
    this.setElementProps(this.oldProps);
  }

  private setElementProps(props: TransformableProps): void {
    const currentDoc = settingsStore.getState().doc;
    if (currentDoc) {
      const updatedElements = currentDoc.elements.map((el: CanvasElementData) =>
        el.id === this.elementId ? { ...el, ...props } : el
      );
      settingsStore.setState({ doc: { ...currentDoc, elements: updatedElements } });
    }
  }
}
