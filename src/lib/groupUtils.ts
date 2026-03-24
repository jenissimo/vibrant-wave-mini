import type { CanvasElementData } from '@/components/Canvas';

export function isGroupElement(el: CanvasElementData): boolean {
  return el.type === 'group';
}

export function getGroupChildren(elements: CanvasElementData[], groupId: string): CanvasElementData[] {
  return elements.filter(el => el.groupId === groupId);
}

export function getEffectiveVisible(el: CanvasElementData, elements: CanvasElementData[]): boolean {
  if (!el.visible) return false;
  if (el.groupId) {
    const group = elements.find(g => g.id === el.groupId);
    if (group && !group.visible) return false;
  }
  return true;
}

export function getEffectiveLocked(el: CanvasElementData, elements: CanvasElementData[]): boolean {
  if (el.locked) return true;
  if (el.groupId) {
    const group = elements.find(g => g.id === el.groupId);
    if (group && group.locked) return true;
  }
  return false;
}

export function getGroupBounds(elements: CanvasElementData[], groupId: string): { x: number; y: number; width: number; height: number } {
  const children = getGroupChildren(elements, groupId);
  if (children.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of children) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Get all element IDs that belong to a group (children only, not the group itself) */
export function getGroupChildIds(elements: CanvasElementData[], groupId: string): string[] {
  return elements.filter(el => el.groupId === groupId).map(el => el.id);
}

/** Expand selection to include entire groups when a child is selected */
export function expandSelectionToGroups(
  selectedIds: string[],
  elements: CanvasElementData[],
  enteredGroupId: string | null
): string[] {
  const result = new Set(selectedIds);
  for (const id of selectedIds) {
    const el = elements.find(e => e.id === id);
    if (!el) continue;
    // If this element is in a group and we haven't "entered" that group, select all siblings
    if (el.groupId && el.groupId !== enteredGroupId) {
      const group = elements.find(g => g.id === el.groupId);
      if (group) result.add(group.id);
      for (const child of getGroupChildren(elements, el.groupId)) {
        result.add(child.id);
      }
    }
  }
  return Array.from(result);
}
