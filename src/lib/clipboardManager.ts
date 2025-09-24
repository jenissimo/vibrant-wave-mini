import { CanvasElementData } from "@/components/Canvas";

// We only need the properties that define the element, not its unique ID.
type CopyableElementData = Omit<CanvasElementData, 'id'>;

class ClipboardManager {
  private content: CopyableElementData | null = null;
  private isInternalCopy: boolean = false;

  public copy(element: CanvasElementData): void {
    const { id, ...rest } = element;
    this.content = rest;
    this.isInternalCopy = false; // Reset flag on new copy
  }

  public paste(): CopyableElementData | null {
    return this.content;
  }

  public clear(): void {
    this.content = null;
    this.isInternalCopy = false;
  }

  public markAsInternalCopy(): void {
    this.isInternalCopy = true;
  }

  public isFromInternalCopy(): boolean {
    return this.isInternalCopy;
  }
}

export const clipboardManager = new ClipboardManager();
