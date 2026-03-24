import { CanvasElementData } from "@/components/Canvas";

// We only need the properties that define the element, not its unique ID.
type CopyableElementData = Omit<CanvasElementData, 'id'>;

class ClipboardManager {
  private content: CopyableElementData[] = [];
  private isInternalCopyFlag: boolean = false;

  public copy(element: CanvasElementData): void {
    const { id, ...rest } = element;
    this.content = [rest];
    this.isInternalCopyFlag = false;
  }

  public copyMany(elements: CanvasElementData[]): void {
    this.content = elements.map(({ id, ...rest }) => rest);
    this.isInternalCopyFlag = false;
  }

  public paste(): CopyableElementData | null {
    return this.content[0] ?? null;
  }

  public pasteMany(): CopyableElementData[] {
    return [...this.content];
  }

  public clear(): void {
    this.content = [];
    this.isInternalCopyFlag = false;
  }

  public markAsInternalCopy(): void {
    this.isInternalCopyFlag = true;
  }

  public isFromInternalCopy(): boolean {
    return this.isInternalCopyFlag;
  }
}

export const clipboardManager = new ClipboardManager();
