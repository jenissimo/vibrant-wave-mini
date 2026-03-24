import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Sun, Moon, Monitor, LogOut, Undo, Redo, Save, FolderOpen, FolderKanban, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { BackgroundPattern } from '@/lib/types';

/* ── tiny SVG pattern previews (24×24) ─────────────────────────── */
const PatternIcon: React.FC<{ pattern: BackgroundPattern; active?: boolean }> = ({ pattern, active }) => {
  const stroke = active ? 'currentColor' : 'currentColor';
  const opacity = active ? 1 : 0.45;
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { opacity } } as const;

  switch (pattern) {
    case 'none':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke={stroke} strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'dots':
      return (
        <svg {...common}>
          {[4, 10, 16, 22].map(x =>
            [4, 10, 16, 22].map(y => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill={stroke} />
            ))
          )}
        </svg>
      );
    case 'grid':
      return (
        <svg {...common}>
          {[4, 12, 20].map(v => (
            <React.Fragment key={v}>
              <line x1={v} y1="2" x2={v} y2="22" stroke={stroke} strokeWidth="0.75" />
              <line x1="2" y1={v} x2="22" y2={v} stroke={stroke} strokeWidth="0.75" />
            </React.Fragment>
          ))}
        </svg>
      );
    case 'cross':
      return (
        <svg {...common}>
          {[6, 12, 18].map(cx =>
            [6, 12, 18].map(cy => (
              <React.Fragment key={`${cx}-${cy}`}>
                <line x1={cx - 2} y1={cy} x2={cx + 2} y2={cy} stroke={stroke} strokeWidth="0.9" />
                <line x1={cx} y1={cy - 2} x2={cx} y2={cy + 2} stroke={stroke} strokeWidth="0.9" />
              </React.Fragment>
            ))
          )}
        </svg>
      );
    case 'crossDot':
      return (
        <svg {...common}>
          {[7, 17].map(cx =>
            [7, 17].map(cy => (
              <React.Fragment key={`${cx}-${cy}`}>
                <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke={stroke} strokeWidth="0.7" />
                <line x1={cx} y1={cy - 3} x2={cx} y2={cy + 3} stroke={stroke} strokeWidth="0.7" />
                <circle cx={cx} cy={cy} r="1.3" fill={stroke} />
              </React.Fragment>
            ))
          )}
        </svg>
      );
    case 'isometric':
      return (
        <svg {...common}>
          <line x1="2" y1="16" x2="12" y2="6" stroke={stroke} strokeWidth="0.75" />
          <line x1="12" y1="6" x2="22" y2="16" stroke={stroke} strokeWidth="0.75" />
          <line x1="2" y1="8" x2="12" y2="18" stroke={stroke} strokeWidth="0.75" />
          <line x1="12" y1="18" x2="22" y2="8" stroke={stroke} strokeWidth="0.75" />
        </svg>
      );
  }
};

const PATTERNS: { id: BackgroundPattern; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'dots', label: 'Dots' },
  { id: 'grid', label: 'Grid' },
  { id: 'cross', label: 'Cross' },
  { id: 'crossDot', label: 'Cross+' },
  { id: 'isometric', label: 'Iso' },
];

interface CanvasTopToolbarProps {
  onDownload?: () => void;
  snapEnabled?: boolean;
  onToggleSnap?: (v: boolean) => void;
  theme?: 'light' | 'dark' | 'system';
  isHydrated?: boolean;
  onToggleTheme?: () => void;
  onSignOut?: () => void;
  showSignOut?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onSaveBoard?: () => void;
  onLoadBoard?: () => void;
  onOpenBoards?: () => void;
  onOpenChangelog?: () => void;
  boardName?: string;
  onRenameBoard?: (name: string) => void;
  backgroundPattern?: BackgroundPattern;
  onPatternChange?: (p: BackgroundPattern) => void;
}

const CanvasTopToolbar: React.FC<CanvasTopToolbarProps> = ({
  onDownload,
  snapEnabled,
  onToggleSnap,
  theme,
  isHydrated,
  onToggleTheme,
  onSignOut,
  showSignOut,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSaveBoard,
  onLoadBoard,
  onOpenBoards,
  onOpenChangelog,
  boardName,
  onRenameBoard,
  backgroundPattern = 'dots',
  onPatternChange,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cancelingRef = useRef(false);

  // Pattern dropdown state
  const [patternOpen, setPatternOpen] = useState(false);
  const patternBtnRef = useRef<HTMLButtonElement>(null);
  const patternDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Close pattern dropdown on click outside
  useEffect(() => {
    if (!patternOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        patternBtnRef.current?.contains(e.target as Node) ||
        patternDropRef.current?.contains(e.target as Node)
      ) return;
      setPatternOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [patternOpen]);

  const startEditingName = () => {
    cancelingRef.current = false;
    setEditingName(boardName || 'Untitled Board');
    setIsEditingName(true);
  };

  const commitName = () => {
    if (cancelingRef.current) return;
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== boardName) {
      onRenameBoard?.(trimmed);
    }
    setIsEditingName(false);
  };

  const selectPattern = useCallback((p: BackgroundPattern) => {
    onPatternChange?.(p);
    setPatternOpen(false);
  }, [onPatternChange]);

  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 canvas-toolbar backdrop-blur shadow-sm rounded-md px-2 py-1">
      {isEditingName ? (
        <input
          ref={nameInputRef}
          className="text-xs font-medium bg-background border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-ring w-32"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') { cancelingRef.current = true; setIsEditingName(false); }
          }}
          onBlur={commitName}
        />
      ) : (
        <span
          className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground px-1.5 py-0.5 rounded hover:bg-accent/50 truncate max-w-40"
          onClick={startEditingName}
          title="Click to rename board"
        >
          {boardName || 'Untitled Board'}
        </span>
      )}
      <div className="w-px h-5 bg-border mx-1" />
      <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Undo size={16} />
      </Button>
      <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
        <Redo size={16} />
      </Button>
      <div className="w-px h-5 bg-border mx-1" />
      <div className="flex items-center gap-2 px-1">
        <Label htmlFor="snap" className="text-xs text-muted-foreground cursor-pointer">Snap</Label>
        <Switch id="snap" checked={!!snapEnabled} onCheckedChange={onToggleSnap} className="cursor-pointer"/>
      </div>
      <div className="w-px h-5 bg-border mx-1" />
      <Button variant="ghost" size="icon" onClick={onToggleTheme} title={
        !isHydrated ? "Theme" :
        theme === 'light' ? "Switch to Dark Mode" :
        theme === 'dark' ? "Switch to System Mode" :
        "Switch to Light Mode"
      }>
        {!isHydrated ? <Sun size={16} /> :
         theme === 'light' ? <Moon size={16} /> :
         theme === 'dark' ? <Monitor size={16} /> :
         <Sun size={16} />}
      </Button>
      {/* Background pattern switcher */}
      <div className="relative">
        <Button
          ref={patternBtnRef}
          variant="ghost"
          size="icon"
          title="Background Pattern"
          onClick={() => setPatternOpen(v => !v)}
        >
          <PatternIcon pattern={backgroundPattern} active />
        </Button>
        {patternOpen && (
          <div
            ref={patternDropRef}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 canvas-toolbar backdrop-blur shadow-lg rounded-lg p-2 z-50"
          >
            <div className="flex gap-1">
              {PATTERNS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => selectPattern(id)}
                  className={`flex flex-col items-center gap-1 rounded-md px-2 py-1.5 transition-colors cursor-pointer
                    ${backgroundPattern === id
                      ? 'bg-primary/10 ring-1.5 ring-primary text-foreground'
                      : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                    }`}
                  title={label}
                >
                  <PatternIcon pattern={id} active={backgroundPattern === id} />
                  <span className="text-[10px] leading-none font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={onDownload} title="Download PNG">
        <Download size={16} />
      </Button>
      <div className="w-px h-5 bg-border mx-1" />
      <Button variant="ghost" size="icon" onClick={onSaveBoard} title="Save Board (.wv)">
        <Save size={16} />
      </Button>
      <Button variant="ghost" size="icon" onClick={onLoadBoard} title="Load Board (.wv)">
        <FolderOpen size={16} />
      </Button>
      <Button variant="ghost" size="icon" onClick={onOpenBoards} title="Boards">
        <FolderKanban size={16} />
      </Button>
      <div className="w-px h-5 bg-border mx-1" />
      <Button variant="ghost" size="icon" onClick={onOpenChangelog} title="Changelog">
        <Newspaper size={16} />
      </Button>
      {showSignOut && (
        <>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" onClick={onSignOut} title="Sign Out">
            <LogOut size={16} />
          </Button>
        </>
      )}
    </div>
  );
};

export default CanvasTopToolbar;
