import { CanvasElementData } from '@/components/Canvas';
import { commandManager } from './commandManager';
import { AddElementCommand } from './commands/AddElementCommand';

export interface ImageInsertionOptions {
  src: string;
  name?: string;
  targetArea: { width: number; height: number; x: number; y: number };
  maxSize?: { width: number; height: number };
  offset?: { x: number; y: number };
}

export function createImageElement(options: ImageInsertionOptions): Promise<CanvasElementData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxW = options.maxSize?.width || options.targetArea.width;
      const maxH = options.maxSize?.height || options.targetArea.height;
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      
      const w = Math.max(1, img.width * ratio);
      const h = Math.max(1, img.height * ratio);
      const x = options.targetArea.x + (options.offset?.x || 0);
      const y = options.targetArea.y + (options.offset?.y || 0);
      
      const id = `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
      
      // Remove file extension from name if provided
      const nameWithoutExt = options.name ? options.name.replace(/\.[^/.]+$/, '') : undefined;
      
      const newElement: CanvasElementData = {
        id,
        type: 'image',
        src: options.src,
        name: nameWithoutExt,
        x,
        y,
        width: w,
        height: h,
        originalWidth: img.width,
        originalHeight: img.height,
        visible: true,
        locked: false,
      };
      
      resolve(newElement);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = options.src;
  });
}

export function insertImageToCanvas(
  options: ImageInsertionOptions,
  onElementCreated?: (element: CanvasElementData) => void
): Promise<string> {
  return createImageElement(options).then(element => {
    commandManager.execute(new AddElementCommand(element));
    onElementCreated?.(element);
    return element.id;
  });
}

export function getImageFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
