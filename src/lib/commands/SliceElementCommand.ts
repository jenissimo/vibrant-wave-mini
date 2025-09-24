import { Command } from '@/lib/types';
import { settingsStore } from '@/lib/settingsStore';
import { CanvasElementData } from '@/components/Canvas';

export class SliceElementCommand implements Command {
  private elementId: string;
  private gridCols: number;
  private gridRows: number;
  private gridThickness: number;
  private originalElement: CanvasElementData | null = null;
  private slicedElements: CanvasElementData[] = [];

  constructor(elementId: string, gridCols: number, gridRows: number, gridThickness: number = 1) {
    this.elementId = elementId;
    this.gridCols = gridCols;
    this.gridRows = gridRows;
    this.gridThickness = gridThickness;
  }

  execute(): void {
    const currentDoc = settingsStore.getState().doc;
    if (!currentDoc) return;

    const element = currentDoc.elements.find(el => el.id === this.elementId);
    if (!element || element.type !== 'image') return;

    this.originalElement = { ...element };
    
    // Use original dimensions if available, fallback to canvas dimensions
    const originalWidth = element.originalWidth || element.width;
    const originalHeight = element.originalHeight || element.height;
    
    // Calculate slice dimensions based on original image size
    const originalSliceWidth = originalWidth / this.gridCols;
    const originalSliceHeight = originalHeight / this.gridRows;
    
    // Calculate scale factor from original to canvas size
    const scaleX = element.width / originalWidth;
    const scaleY = element.height / originalHeight;
    
    // Calculate grid line thickness in original image coordinates
    const originalGridThickness = this.gridThickness / Math.min(scaleX, scaleY);
    
    // Create sliced elements
    this.slicedElements = [];
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const sliceId = `${element.id}_slice_${row}_${col}`;
        
        // Calculate slice position and size in original image coordinates
        // Account for grid line thickness by adding half thickness to each side
        const originalSliceX = col * originalSliceWidth + (originalGridThickness / 2);
        const originalSliceY = row * originalSliceHeight + (originalGridThickness / 2);
        const originalSliceW = originalSliceWidth - originalGridThickness;
        const originalSliceH = originalSliceHeight - originalGridThickness;
        
        // Convert to canvas coordinates
        const sliceX = element.x + (originalSliceX * scaleX);
        const sliceY = element.y + (originalSliceY * scaleY);
        const sliceWidth = originalSliceW * scaleX;
        const sliceHeight = originalSliceH * scaleY;
        
        // Create canvas element for slice
        const sliceElement: CanvasElementData = {
          id: sliceId,
          type: 'image',
          src: element.src,
          name: `${element.name || 'Element'}_${row + 1}_${col + 1}`,
          x: Math.round(sliceX * 100) / 100, // Round to 2 decimal places
          y: Math.round(sliceY * 100) / 100,
          width: Math.round(sliceWidth * 100) / 100,
          height: Math.round(sliceHeight * 100) / 100,
          originalWidth: element.originalWidth,
          originalHeight: element.originalHeight,
          // Slice coordinates in original image (accounting for grid thickness)
          sliceX: Math.round(originalSliceX),
          sliceY: Math.round(originalSliceY),
          sliceWidth: Math.round(originalSliceW),
          sliceHeight: Math.round(originalSliceH),
          visible: element.visible,
          locked: element.locked,
          rotation: element.rotation,
        };
        
        this.slicedElements.push(sliceElement);
      }
    }

    // Replace original element with sliced elements
    const updatedElements = currentDoc.elements.filter(el => el.id !== this.elementId);
    const newElements = [...this.slicedElements, ...updatedElements];
    
    settingsStore.setState({ 
      doc: { ...currentDoc, elements: newElements } 
    });
  }

  undo(): void {
    const currentDoc = settingsStore.getState().doc;
    if (!currentDoc || !this.originalElement) return;

    // Remove sliced elements and restore original
    const updatedElements = currentDoc.elements.filter(
      el => !this.slicedElements.some(slice => slice.id === el.id)
    );
    
    const newElements = [this.originalElement, ...updatedElements];
    
    settingsStore.setState({ 
      doc: { ...currentDoc, elements: newElements } 
    });
  }
}
