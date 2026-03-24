import React, { useState, useRef, useEffect } from 'react';
import { Download, Sun, Moon, Monitor, LogOut, Undo, Redo, Save, FolderOpen, FolderKanban, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cancelingRef = useRef(false);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

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

