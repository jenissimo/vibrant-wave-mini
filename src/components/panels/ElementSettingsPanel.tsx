import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import BaseFloatingPanel from '@/components/panels/BaseFloatingPanel';
import type { CanvasElementData } from '@/components/Canvas';
import { commandManager } from '@/lib/commandManager';
import { SliceElementCommand } from '@/lib/commands/SliceElementCommand';
import { settingsStore } from '@/lib/settingsStore';

interface ElementSettingsPanelProps {
  element: CanvasElementData;
  onChange: (updates: Partial<CanvasElementData>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
}

const ElementSettingsPanel: React.FC<ElementSettingsPanelProps> = ({ element, onChange, onDelete, onDuplicate }) => {
  const setNum = (key: keyof CanvasElementData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value || '0');
    onChange({ [key]: isNaN(v) ? 0 : v } as Partial<CanvasElementData>);
  };

  const handleSlice = () => {
    const settings = settingsStore.getState().doc?.settings;
    if (!settings || element.type !== 'image') return;
    
    const command = new SliceElementCommand(
      element.id, 
      settings.gridCols, 
      settings.gridRows, 
      settings.gridThickness
    );
    commandManager.execute(command);
  };

  const canSlice = element.type === 'image';

  return (
    <BaseFloatingPanel title="Element Settings" initialPosition={{ x: (typeof window !== 'undefined' ? window.innerWidth - 540 : 0), y: 12 }} className="w-72" storageKey="element-settings">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="el-x">X</Label>
              <Input id="el-x" type="number" value={Math.round(element.x)} onChange={setNum('x')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="el-y">Y</Label>
              <Input id="el-y" type="number" value={Math.round(element.y)} onChange={setNum('y')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="el-w">Width</Label>
              <Input id="el-w" type="number" value={Math.round(element.width)} onChange={setNum('width')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="el-h">Height</Label>
              <Input id="el-h" type="number" value={Math.round(element.height)} onChange={setNum('height')} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="el-rot">Rotation</Label>
            <Input id="el-rot" type="number" value={Math.round(element.rotation || 0)} onChange={(e)=>onChange({ rotation: parseFloat(e.target.value || '0') })} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch id="el-visible" checked={element.visible} onCheckedChange={(v)=>onChange({ visible: v })} />
              <Label htmlFor="el-visible">Visible</Label>
            </div>
            <div className="flex items-center gap-2 opacity-50 pointer-events-none">
              <Label>Locked removed</Label>
            </div>
          </div>
          <div className="flex justify-between pt-1">
            <Button variant="secondary" size="sm" onClick={onDuplicate}>Duplicate</Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSlice}
              disabled={!canSlice}
              title={!canSlice ? "Slice available only for images" : "Slice element by grid"}
            >
              Slice
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
          </div>
        </div>
    </BaseFloatingPanel>
  );
};

export default ElementSettingsPanel;


