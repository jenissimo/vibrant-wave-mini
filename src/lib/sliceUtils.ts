import { CanvasElementData } from '@/components/Canvas';

/**
 * Export a slice element as a separate image
 */
export async function exportSliceAsImage(element: CanvasElementData): Promise<string> {
  if (!element.sliceX !== undefined || !element.sliceY !== undefined || 
      !element.sliceWidth !== undefined || !element.sliceHeight !== undefined) {
    // Not a slice, return original image
    return element.src;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Create canvas for the slice
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set canvas size to slice dimensions
        canvas.width = element.sliceWidth!;
        canvas.height = element.sliceHeight!;

        // Draw the slice from the original image
        ctx.drawImage(
          img,
          element.sliceX!, element.sliceY!, element.sliceWidth!, element.sliceHeight!, // source rectangle
          0, 0, element.sliceWidth!, element.sliceHeight! // destination rectangle
        );

        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = element.src;
  });
}

/**
 * Check if element is a slice
 */
export function isSlice(element: CanvasElementData): boolean {
  return element.sliceX !== undefined && 
         element.sliceY !== undefined && 
         element.sliceWidth !== undefined && 
         element.sliceHeight !== undefined;
}

/**
 * Get slice info for display
 */
export function getSliceInfo(element: CanvasElementData): string {
  if (!isSlice(element)) {
    return `${Math.round(element.width)}×${Math.round(element.height)}`;
  }
  
  return `${Math.round(element.sliceWidth!)}×${Math.round(element.sliceHeight!)} (slice)`;
}
