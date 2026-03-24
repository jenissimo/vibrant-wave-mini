import { Command } from '@/lib/types';
import { settingsStore } from '@/lib/settingsStore';
import { CanvasElementData } from '@/components/Canvas';

export class GroupElementsCommand implements Command {
  private groupElement: CanvasElementData;
  private childIds: string[];

  constructor(childIds: string[]) {
    this.childIds = childIds;
    this.groupElement = {
      id: crypto.randomUUID(),
      type: 'group',
      name: 'Group',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: true,
      locked: false,
    };
  }

  get groupId(): string {
    return this.groupElement.id;
  }

  execute(): void {
    const currentDoc = settingsStore.getState().doc;
    if (!currentDoc) return;

    const childIdSet = new Set(this.childIds);
    // Find topmost child position (lowest index = topmost)
    let insertIdx = currentDoc.elements.length;
    for (let i = 0; i < currentDoc.elements.length; i++) {
      if (childIdSet.has(currentDoc.elements[i].id)) {
        insertIdx = Math.min(insertIdx, i);
        break;
      }
    }

    // Set groupId on children and insert group element before them
    const updatedElements = currentDoc.elements.map(el =>
      childIdSet.has(el.id) ? { ...el, groupId: this.groupElement.id } : el
    );

    // Insert group element at the topmost child position
    updatedElements.splice(insertIdx, 0, this.groupElement);

    settingsStore.setState({ doc: { ...currentDoc, elements: updatedElements } });
  }

  undo(): void {
    const currentDoc = settingsStore.getState().doc;
    if (!currentDoc) return;

    const updatedElements = currentDoc.elements
      .filter(el => el.id !== this.groupElement.id)
      .map(el => el.groupId === this.groupElement.id ? { ...el, groupId: undefined } : el);

    settingsStore.setState({ doc: { ...currentDoc, elements: updatedElements } });
  }
}

export class UngroupCommand implements Command {
  private groupId: string;
  private savedGroup: CanvasElementData | null = null;
  private savedChildIds: string[] = [];

  constructor(groupId: string) {
    this.groupId = groupId;
  }

  execute(): void {
    const currentDoc = settingsStore.getState().doc;
    if (!currentDoc) return;

    this.savedGroup = currentDoc.elements.find(el => el.id === this.groupId) || null;
    this.savedChildIds = currentDoc.elements
      .filter(el => el.groupId === this.groupId)
      .map(el => el.id);

    const updatedElements = currentDoc.elements
      .filter(el => el.id !== this.groupId)
      .map(el => el.groupId === this.groupId ? { ...el, groupId: undefined } : el);

    settingsStore.setState({ doc: { ...currentDoc, elements: updatedElements } });
  }

  undo(): void {
    const currentDoc = settingsStore.getState().doc;
    if (!currentDoc) return;

    if (!this.savedGroup) return;

    const childIdSet = new Set(this.savedChildIds);
    const updatedElements = currentDoc.elements.map(el =>
      childIdSet.has(el.id) ? { ...el, groupId: this.groupId } : el
    );

    // Re-insert group element at front of its children
    let insertIdx = updatedElements.length;
    for (let i = 0; i < updatedElements.length; i++) {
      if (childIdSet.has(updatedElements[i].id)) {
        insertIdx = i;
        break;
      }
    }
    updatedElements.splice(insertIdx, 0, this.savedGroup);

    settingsStore.setState({ doc: { ...currentDoc, elements: updatedElements } });
  }
}
