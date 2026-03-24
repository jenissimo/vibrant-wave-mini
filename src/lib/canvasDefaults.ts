export const MIN_ELEMENT_SIZE = 8; // px
export const STICKY_MIN_SIZE = 80; // px

export const STICKY_COLORS = [
  { name: 'Yellow', hex: '#FEF08A' },
  { name: 'Pink',   hex: '#FBCFE8' },
  { name: 'Green',  hex: '#BBF7D0' },
  { name: 'Blue',   hex: '#BFDBFE' },
  { name: 'Purple', hex: '#DDD6FE' },
  { name: 'Orange', hex: '#FED7AA' },
  { name: 'Gray',   hex: '#E5E7EB' },
];
export const STICKY_SQUARE = { width: 200, height: 200 };
export const STICKY_HORIZONTAL = { width: 300, height: 150 };
export const STICKY_PADDING = 12;
export const STICKY_CORNER_RADIUS = 8;
export const STICKY_DEFAULT_COLOR = '#FEF08A';

// Shape primitives
export const SHAPE_DEFAULT_SIZE = { width: 160, height: 100 };
export const SHAPE_MIN_SIZE = 30;
export const SHAPE_DEFAULT_BG = '#ffffff';
export const SHAPE_DEFAULT_BORDER = '#374151';
export const SHAPE_DEFAULT_BORDER_WIDTH = 2;
export const SHAPE_DEFAULT_CORNER_RADIUS = 12;
export const SHAPE_DEFAULT_PADDING = 8;
export const SHAPE_TYPES = ['rectangle', 'roundedRect', 'ellipse', 'diamond', 'triangle'] as const;
