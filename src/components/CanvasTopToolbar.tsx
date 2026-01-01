import React from 'react';
import { Hand, MousePointer, Download, Sun, Moon, Monitor, LogOut, Undo, Redo, Save, FolderOpen, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface CanvasTopToolbarProps {
  interactionMode: 'select' | 'pan';
  setInteractionMode: (mode: 'select' | 'pan') => void;
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
}

const CanvasTopToolbar: React.FC<CanvasTopToolbarProps> = ({ 
  interactionMode, 
  setInteractionMode, 
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
}) => {
  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 canvas-toolbar backdrop-blur shadow-sm rounded-md px-2 py-1">
      <Button variant={interactionMode==='select' ? 'default' : 'ghost'} size="icon" onClick={() => setInteractionMode('select')} title="Select (V)">
        <MousePointer size={16} />
      </Button>
      <Button variant={interactionMode==='pan' ? 'default' : 'ghost'} size="icon" onClick={() => setInteractionMode('pan')} title="Pan (H)">
        <Hand size={16} />
      </Button>
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

