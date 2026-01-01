import JSZip from 'jszip';
import type { DocState, DocSettings } from './types';
import type { CanvasElementData } from '@/components/Canvas';

// Convert base64 data URL to Blob
function dataURLToBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// Convert Blob to base64 data URL
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

// Export board to .wv file format
export async function exportBoardToWv(docState: DocState): Promise<Blob> {
  const zip = new JSZip();
  
  // Create images folder
  const imagesFolder = zip.folder('images');
  if (!imagesFolder) {
    throw new Error('Failed to create images folder');
  }

  // Export elements with image references
  const exportedElements: (Omit<CanvasElementData, 'src'> & { imagePath: string })[] = [];
  
  for (let i = 0; i < docState.elements.length; i++) {
    const element = docState.elements[i];
    if (element.type === 'image' && element.src) {
      // Convert base64 data URL to Blob
      const blob = dataURLToBlob(element.src);
      const imagePath = `images/element_${i}.png`;
      
      // Add image to zip
      imagesFolder.file(`element_${i}.png`, blob);
      
      // Create exported element without src, with imagePath instead
      const { src, ...elementWithoutSrc } = element;
      exportedElements.push({
        ...elementWithoutSrc,
        imagePath,
      });
    }
  }

  // Create board.json with exported structure
  const boardData = {
    version: '1.0',
    elements: exportedElements,
    settings: docState.settings,
  };

  zip.file('board.json', JSON.stringify(boardData, null, 2));

  // Generate ZIP file
  return await zip.generateAsync({ type: 'blob' });
}

// Import board from .wv file format
export async function importBoardFromWv(file: File): Promise<DocState> {
  const zip = await JSZip.loadAsync(file);
  
  // Read board.json
  const boardJsonFile = zip.file('board.json');
  if (!boardJsonFile) {
    throw new Error('board.json not found in .wv file');
  }

  const boardJsonText = await boardJsonFile.async('string');
  const boardData = JSON.parse(boardJsonText) as {
    version?: string;
    elements: (Omit<CanvasElementData, 'src'> & { imagePath: string })[];
    settings: DocSettings;
  };

  // Restore elements with images
  const restoredElements: CanvasElementData[] = [];

  for (const exportedElement of boardData.elements) {
    if (exportedElement.type === 'image' && exportedElement.imagePath) {
      // Extract image path (e.g., "images/element_0.png" -> "element_0.png")
      const imageFileName = exportedElement.imagePath.split('/').pop() || '';
      const imageFile = zip.file(`images/${imageFileName}`);
      
      if (!imageFile) {
        console.warn(`Image file not found: ${imageFileName}, skipping element`);
        continue;
      }

      // Convert Blob to base64 data URL
      const blob = await imageFile.async('blob');
      const src = await blobToDataURL(blob);

      // Restore element with src
      const { imagePath, ...elementWithoutImagePath } = exportedElement;
      restoredElements.push({
        ...elementWithoutImagePath,
        src,
      } as CanvasElementData);
    }
  }

  return {
    elements: restoredElements,
    settings: boardData.settings,
  };
}

