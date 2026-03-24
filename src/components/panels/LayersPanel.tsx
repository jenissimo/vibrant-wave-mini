import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, Download, Eye, EyeOff, Trash2, Image as ImageIcon, Pen, Type, StickyNote, Square, Circle, Diamond, Triangle, ChevronRight, ChevronDown, FolderOpen, Folder, Group, Ungroup } from 'lucide-react';
import type { CanvasElementData } from '@/components/Canvas';
import BaseFloatingPanel from '@/components/panels/BaseFloatingPanel';
import { getSliceInfo } from '@/lib/sliceUtils';

// Panel sizing defaults (px)
const LAYERS_PANEL_WIDTH = 384; // matches w-128 (32rem)
const LAYERS_LIST_MIN_HEIGHT = 128; // ~min-h-64
const LAYERS_LIST_MAX_HEIGHT = 384; // ~max-h-96

interface LayersPanelProps {
  elements: CanvasElementData[];
  selectedIds: string[];
  onSelect: (id: string | null, opts?: { shift?: boolean; ctrl?: boolean }) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
  onDownload?: (id: string) => void;
  onImportImage?: (file: File) => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onEnterGroup?: (groupId: string | null) => void;
  enteredGroupId?: string | null;
}

function ElementIcon({ el }: { el: CanvasElementData }) {
  if (el.type === 'image' && el.src) {
    return <img src={el.src} alt="thumb" className="w-full h-full object-cover" />;
  }
  if (el.type === 'drawing') return <Pen className="w-3.5 h-3.5 text-muted-foreground" />;
  if (el.type === 'text') return <Type className="w-3.5 h-3.5 text-muted-foreground" />;
  if (el.type === 'sticky') return <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />;
  if (el.type === 'shape') {
    if (el.shapeType === 'ellipse') return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
    if (el.shapeType === 'diamond') return <Diamond className="w-3.5 h-3.5 text-muted-foreground" />;
    if (el.shapeType === 'triangle') return <Triangle className="w-3.5 h-3.5 text-muted-foreground" />;
    return <Square className="w-3.5 h-3.5 text-muted-foreground" />;
  }
  return null;
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  selectedIds,
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
  onGroup,
  onUngroup,
  onToggleGroupCollapsed,
  onEnterGroup,
  enteredGroupId,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const openImport = () => fileInputRef.current?.click();
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportImage) onImportImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Check if group/ungroup buttons should be enabled
  const selectedNonGA = selectedIds.filter(id => id !== 'generation-area');
  const canGroup = selectedNonGA.length >= 2 && selectedNonGA.every(id => {
    const el = elements.find(e => e.id === id);
    return el && el.type !== 'group' && !el.groupId;
  });
  const canUngroup = selectedNonGA.some(id => {
    const el = elements.find(e => e.id === id);
    return el?.type === 'group';
  });

  const headerRight = (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-[11px]"
        onClick={onGroup}
        disabled={!canGroup}
        title="Group (Ctrl+G)"
      >
        <Group className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-[11px]"
        onClick={onUngroup}
        disabled={!canUngroup}
        title="Ungroup (Ctrl+Shift+G)"
      >
        <Ungroup className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={openImport}>
        <ImageIcon className="w-3.5 h-3.5 mr-1" />Import image
      </Button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImport} />
    </div>
  );

  // Build display list: group elements with their children
  const groupIds = new Set(elements.filter(el => el.type === 'group').map(el => el.id));
  const childrenByGroup = new Map<string, CanvasElementData[]>();
  for (const el of elements) {
    if (el.groupId && groupIds.has(el.groupId)) {
      if (!childrenByGroup.has(el.groupId)) childrenByGroup.set(el.groupId, []);
      childrenByGroup.get(el.groupId)!.push(el);
    }
  }

  const renderElementRow = (el: CanvasElementData, idx: number, indent: boolean) => (
    <div
      key={el.id}
      className={`flex items-center gap-2 py-1 rounded cursor-pointer ${indent ? 'pl-7 pr-2' : 'px-2'} ${selectedIds.includes(el.id) ? 'bg-accent' : 'hover:bg-accent/50'}`}
      onClick={(e) => onSelect(el.id, e.shiftKey ? { shift: true } : (e.ctrlKey || e.metaKey) ? { ctrl: true } : undefined)}
    >
      <div className="w-6 h-6 rounded border overflow-hidden bg-muted flex items-center justify-center">
        <ElementIcon el={el} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-foreground truncate">{el.name || `${el.type} ${el.id.slice(0,4)}`}</div>
        <div className="text-[10px] text-muted-foreground">{Math.round(el.x)},{Math.round(el.y)} · {getSliceInfo(el)}</div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Move down" onClick={(e) => { e.stopPropagation(); onMoveDown?.(el.id); }}>
          <ArrowDown className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Move up" onClick={(e) => { e.stopPropagation(); onMoveUp?.(el.id); }}>
          <ArrowUp className="w-3.5 h-3.5" />
        </Button>
      </div>
      {el.type === 'image' && (
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Download" onClick={(e) => { e.stopPropagation(); onDownload?.(el.id); }}>
          <Download className="w-3.5 h-3.5" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-6 w-6" title={el.visible ? 'Hide' : 'Show'} onClick={(e) => { e.stopPropagation(); onToggleVisible(el.id); }}>
        {el.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(el.id); }}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );

  const renderGroupRow = (el: CanvasElementData) => {
    const isCollapsed = el.collapsed ?? false;
    const children = childrenByGroup.get(el.id) || [];
    const isEntered = enteredGroupId === el.id;

    return (
      <React.Fragment key={el.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${selectedIds.includes(el.id) ? 'bg-accent' : 'hover:bg-accent/50'} ${isEntered ? 'ring-1 ring-primary' : ''}`}
          onClick={(e) => onSelect(el.id, e.shiftKey ? { shift: true } : (e.ctrlKey || e.metaKey) ? { ctrl: true } : undefined)}
          onDoubleClick={() => onEnterGroup?.(isEntered ? null : el.id)}
        >
          <button
            className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onToggleGroupCollapsed?.(el.id); }}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <div className="w-6 h-6 rounded border overflow-hidden bg-muted flex items-center justify-center">
            {isCollapsed ? <Folder className="w-3.5 h-3.5 text-muted-foreground" /> : <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-foreground truncate">{el.name || 'Group'}</div>
            <div className="text-[10px] text-muted-foreground">{children.length} items</div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" title={el.visible ? 'Hide' : 'Show'} onClick={(e) => { e.stopPropagation(); onToggleVisible(el.id); }}>
            {el.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(el.id); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        {!isCollapsed && children.map((child, i) => renderElementRow(child, i, true))}
      </React.Fragment>
    );
  };

  return (
    <BaseFloatingPanel title="Layers" headerRight={headerRight} initialPosition={{ x: (typeof window !== 'undefined' ? window.innerWidth - (LAYERS_PANEL_WIDTH + 88) : 0), y: 12 }} className="w-128" storageKey="layers" panelWidth={LAYERS_PANEL_WIDTH}>
      <div className="space-y-1 overflow-auto" style={{ minHeight: LAYERS_LIST_MIN_HEIGHT, maxHeight: LAYERS_LIST_MAX_HEIGHT }}>
        {/* Layers list: top-first (index 0 is top), GA rendered last (bottom) */}
        {elements.map((el, idx) => {
          // Skip children that are rendered under their group
          if (el.groupId && groupIds.has(el.groupId)) return null;
          if (el.type === 'group') return renderGroupRow(el);
          return renderElementRow(el, idx, false);
        })}

        <div className="h-px bg-border mx-2 my-1" />
        {/* Generation area as last row (bottom-most) */}
        <div
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${selectedIds.includes('generation-area') ? 'bg-accent' : 'hover:bg-accent/50'}`}
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
