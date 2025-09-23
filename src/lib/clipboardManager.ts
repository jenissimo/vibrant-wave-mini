import { CanvasElementData } from "@/components/Canvas";

// We only need the properties that define the element, not its unique ID.
type CopyableElementData = Omit<CanvasElementData, 'id'>;

class ClipboardManager {
  private content: CopyableElementData | null = null;

  public copy(element: CanvasElementData): void {
    const { id, ...rest } = element;
    this.content = rest;
  }

  public paste(): CopyableElementData | null {
    return this.content;
  }

  public clear(): void {
    this.content = null;
  }
}

export const clipboardManager = new ClipboardManager();
