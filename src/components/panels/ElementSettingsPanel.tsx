import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Download, Bold, Italic } from 'lucide-react';
import BaseFloatingPanel from '@/components/panels/BaseFloatingPanel';
import type { CanvasElementData } from '@/components/Canvas';
import { commandManager } from '@/lib/commandManager';
import { SliceElementCommand } from '@/lib/commands/SliceElementCommand';
import { settingsStore } from '@/lib/settingsStore';
import { exportSliceAsImage, isSlice } from '@/lib/sliceUtils';
import { STICKY_COLORS, STICKY_SQUARE, STICKY_HORIZONTAL, STICKY_DEFAULT_COLOR } from '@/lib/canvasDefaults';

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

  const handleDownload = async () => {
    if (!element.src) return;
    
    try {
      let dataUrl: string;
      if (isSlice(element)) {
        // Export slice as separate image
        dataUrl = await exportSliceAsImage(element);
      } else {
        // Use original image
        dataUrl = element.src;
      }
      
      const a = document.createElement('a');
      a.href = dataUrl;
      // Use element name without extension, or fallback to element ID
      const downloadName = element.name || `element-${element.id}`;
      a.download = `${downloadName}.png`;
      a.click();
    } catch (error) {
      console.error('Failed to export element:', error);
    }
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
          {/* Drawing-specific settings */}
          {element.type === 'drawing' && (
            <div className="space-y-2 border-t pt-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs w-14">Stroke</Label>
                <input
                  type="color"
                  value={element.stroke || '#000000'}
                  onChange={(e) => onChange({ stroke: e.target.value })}
                  className="w-8 h-6 rounded border cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stroke Width</Label>
                <Input type="number" min={1} max={50} value={element.strokeWidth || 2} onChange={(e) => onChange({ strokeWidth: parseFloat(e.target.value || '2') })} />
              </div>
            </div>
          )}
          {/* Text-specific settings */}
          {element.type === 'text' && (
            <div className="space-y-2 border-t pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Text</Label>
                <textarea
                  className="w-full text-xs border rounded px-2 py-1 bg-background resize-none"
                  rows={3}
                  value={element.text || ''}
                  onChange={(e) => onChange({ text: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Font Size</Label>
                  <Input type="number" min={8} max={200} value={element.fontSize || 24} onChange={(e) => onChange({ fontSize: parseFloat(e.target.value || '24') })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <input
                    type="color"
                    value={element.fill || '#000000'}
                    onChange={(e) => onChange({ fill: e.target.value })}
                    className="w-full h-8 rounded border cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
          {/* Sticky-specific settings */}
          {element.type === 'sticky' && (
            <div className="space-y-2 border-t pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Shape</Label>
                <div className="flex gap-1">
                  <Button
                    variant={element.stickyShape === 'square' || !element.stickyShape ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onChange({ stickyShape: 'square', width: STICKY_SQUARE.width, height: STICKY_SQUARE.height })}
                  >
                    Square
                  </Button>
                  <Button
                    variant={element.stickyShape === 'horizontal' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onChange({ stickyShape: 'horizontal', width: STICKY_HORIZONTAL.width, height: STICKY_HORIZONTAL.height })}
                  >
                    Horizontal
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Text</Label>
                <textarea
                  className="w-full text-xs border rounded px-2 py-1 bg-background resize-none"
                  rows={3}
                  value={element.text || ''}
                  onChange={(e) => onChange({ text: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Background</Label>
                <div className="flex gap-1 flex-wrap">
                  {STICKY_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      className={`w-6 h-6 rounded-sm border ${element.stickyColor === c.hex ? 'ring-2 ring-primary' : 'border-border/50'}`}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => onChange({ stickyColor: c.hex })}
                      title={c.name}
                    />
                  ))}
                  <input
                    type="color"
                    value={element.stickyColor || STICKY_DEFAULT_COLOR}
                    onChange={(e) => onChange({ stickyColor: e.target.value })}
                    className="w-6 h-6 rounded border cursor-pointer"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Font Size</Label>
                  <Input type="number" min={8} max={72} value={element.fontSize || 16} onChange={(e) => onChange({ fontSize: parseFloat(e.target.value || '16') })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Text Color</Label>
                  <input
                    type="color"
                    value={element.fill || '#000000'}
                    onChange={(e) => onChange({ fill: e.target.value })}
                    className="w-full h-8 rounded border cursor-pointer"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Style</Label>
                <div className="flex gap-1">
                  <Button
                    variant={(element.fontStyle || '').includes('bold') ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      const current = element.fontStyle || 'normal';
                      const hasBold = current.includes('bold');
                      const hasItalic = current.includes('italic');
                      const next = [!hasBold ? 'bold' : '', hasItalic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal';
                      onChange({ fontStyle: next });
                    }}
                    title="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={(element.fontStyle || '').includes('italic') ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      const current = element.fontStyle || 'normal';
                      const hasBold = current.includes('bold');
                      const hasItalic = current.includes('italic');
                      const next = [hasBold ? 'bold' : '', !hasItalic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal';
                      onChange({ fontStyle: next });
                    }}
                    title="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-between pt-1">
            <Button variant="secondary" size="sm" onClick={onDuplicate}>Duplicate</Button>
            {canSlice && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSlice}
                title="Slice element by grid"
              >
                Slice
              </Button>
            )}
            {element.type === 'image' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                title="Download element"
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
          </div>
        </div>
    </BaseFloatingPanel>
  );
};

export default ElementSettingsPanel;


