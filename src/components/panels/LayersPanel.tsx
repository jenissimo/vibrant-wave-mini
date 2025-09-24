import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Download, Eye, EyeOff, Trash2, Image as ImageIcon } from 'lucide-react';
import type { CanvasElementData } from '@/components/Canvas';
import BaseFloatingPanel from '@/components/panels/BaseFloatingPanel';
import { getSliceInfo } from '@/lib/sliceUtils';

// Panel sizing defaults (px)
const LAYERS_PANEL_WIDTH = 384; // matches w-128 (32rem)
const LAYERS_LIST_MIN_HEIGHT = 128; // ~min-h-64
const LAYERS_LIST_MAX_HEIGHT = 384; // ~max-h-96

interface LayersPanelProps {
  elements: CanvasElementData[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
  onDownload?: (id: string) => void;
  onImportImage?: (file: File) => void;
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  selectedId,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onDelete,
  onMoveUp,
  onMoveDown,
  onBringToFront,
  onSendToBack,
  onDownload,
  onImportImage,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const openImport = () => fileInputRef.current?.click();
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportImage) onImportImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const headerRight = (
    <>
      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={openImport}>
        <ImageIcon className="w-3.5 h-3.5 mr-1" />Import image
      </Button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImport} />
    </>
  );

  return (
    <BaseFloatingPanel title="Layers" headerRight={headerRight} initialPosition={{ x: (typeof window !== 'undefined' ? window.innerWidth - (LAYERS_PANEL_WIDTH + 88) : 0), y: 12 }} className="w-128" storageKey="layers" panelWidth={LAYERS_PANEL_WIDTH}>
      <div className="space-y-1 overflow-auto" style={{ minHeight: LAYERS_LIST_MIN_HEIGHT, maxHeight: LAYERS_LIST_MAX_HEIGHT }}>
        {/* Layers list: top-first (index 0 is top), GA rendered last (bottom) */}
        {elements.map((el, idx) => (
          <div
            key={el.id}
            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${selectedId===el.id ? 'bg-accent' : 'hover:bg-accent/50'}`}
            onClick={() => onSelect(el.id)}
          >
            <div className="w-6 h-6 rounded border overflow-hidden bg-muted">
              {el.type === 'image' && el.src && (
                <img src={el.src} alt="thumb" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-foreground truncate">{el.name || `${el.type} ${el.id.slice(0,4)}`}</div>
              <div className="text-[10px] text-muted-foreground">{Math.round(el.x)},{Math.round(el.y)} · {getSliceInfo(el)}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Move down"
                onClick={(e) => { e.stopPropagation(); onMoveDown?.(el.id); }}
                disabled={idx === elements.length - 1}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Move up"
                onClick={(e) => { e.stopPropagation(); onMoveUp?.(el.id); }}
                disabled={idx === 0}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Download" onClick={(e) => { e.stopPropagation(); onDownload?.(el.id); }}>
              <Download className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" title={el.visible ? 'Hide' : 'Show'} onClick={(e) => { e.stopPropagation(); onToggleVisible(el.id); }}>
              {el.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(el.id); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}

        <div className="h-px bg-border mx-2 my-1" />
        {/* Generation area as last row (bottom-most) */}
        <div
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${selectedId==='generation-area' ? 'bg-accent' : 'hover:bg-accent/50'}`}
          onClick={() => onSelect('generation-area')}
        >
          <div className="w-6 h-6 rounded border bg-muted flex items-center justify-center text-[10px] --muted-foreground">GA</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-foreground truncate">Generation Area</div>
            <div className="text-[10px] --muted-foreground">fixed</div>
          </div>
        </div>
      </div>
    </BaseFloatingPanel>
  );
};

export default LayersPanel;

