import Konva from 'konva';

/**
 * Offscreen Konva.Text node used solely for measurement.
 * Reusing a single instance avoids GC pressure on every call.
 * Using Konva's own Text ensures our wrapped-height measurement matches
 * rendering exactly — word wrap, line-breaking, Unicode, newlines, etc.
 */
let _measureNode: Konva.Text | null = null;
let _ctx: CanvasRenderingContext2D | null = null;

function getMeasureNode(): Konva.Text {
  if (!_measureNode) {
    _measureNode = new Konva.Text({ wrap: 'word', listening: false });
  }
  return _measureNode;
}

function getCtx(): CanvasRenderingContext2D {
  if (!_ctx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    _ctx = c.getContext('2d')!;
  }
  return _ctx;
}

/**
 * Returns the pixel width of the widest whitespace-separated token in `text`.
 * Konva's wrap:'word' never breaks a single word, so any word wider than the
 * container simply overflows. We use this to cap the font size.
 */
function maxTokenWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontStyle: string,
): number {
  const ctx = getCtx();
  // Match Konva's _getContextFont() format: fontStyle fontSize fontFamily
  ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
  let max = 0;
  for (const token of text.split(/\s+/)) {
    if (token) max = Math.max(max, ctx.measureText(token).width);
  }
  return max;
}

/**
 * Binary-searches for the largest integer font size (8–200 px) at which
 * `text` fits inside the available area of a sticky note.
 *
 * Two constraints must be satisfied simultaneously:
 * 1. Wrapped text height ≤ available height  (via Konva.Text measurement)
 * 2. Widest single word ≤ available width     (wrap:'word' doesn't break words)
 */
export function calcStickyFontSize(
  text: string,
  width: number,
  height: number,
  fontFamily: string = 'Inter',
  fontStyle: string = 'normal',
  padding: number = 12,
): number {
  const availW = Math.max(1, width - 2 * padding);
  const availH = Math.max(1, height - 2 * padding);

  if (!text || !text.trim()) {
    return Math.min(200, Math.max(8, Math.floor(availH / 1.2)));
  }

  const node = getMeasureNode();
  node.setAttrs({ text, fontFamily, fontStyle, width: availW, wrap: 'word' });

  let lo = 8;
  let hi = 200;

  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    node.fontSize(mid);
    const fitsH = node.height() <= availH;
    const fitsW = maxTokenWidth(text, mid, fontFamily, fontStyle) <= availW;
    if (fitsH && fitsW) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return lo;
}
