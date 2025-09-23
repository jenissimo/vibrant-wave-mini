import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SidebarProps {
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  gridEnabled: boolean;
  setGridEnabled: (enabled: boolean) => void;

  // Grid options
  gridSquare: boolean;
  setGridSquare: (v: boolean) => void;
  gridSize: number;
  setGridSize: (size: number) => void;
  gridCols: number;
  setGridCols: (n: number) => void;
  gridRows: number;
  setGridRows: (n: number) => void;
  gridThickness: number;
  setGridThickness: (v: number) => void;
  gridColor: string;
  setGridColor: (v: string) => void;

  // Backgrounds
  backgroundColor: string; // canvas bg
  setBackgroundColor: (color: string) => void;
  generationFillColor: string; // generation area bg
  setGenerationFillColor: (color: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  aspectRatio,
  setAspectRatio,
  gridEnabled,
  setGridEnabled,
  gridSquare,
  setGridSquare,
  gridSize,
  setGridSize,
  gridCols,
  setGridCols,
  gridRows,
  setGridRows,
  gridThickness,
  setGridThickness,
  gridColor,
  setGridColor,
  backgroundColor,
  setBackgroundColor,
  generationFillColor,
  setGenerationFillColor,
}) => {
  return (
    <div className="w-64 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-900">Generation Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger>
                <SelectValue placeholder="Select aspect ratio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
                <SelectItem value="4:3">4:3 (Landscape)</SelectItem>
                <SelectItem value="3:4">3:4 (Portrait)</SelectItem>
                <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="grid-enabled">Enable Grid</Label>
            <Switch id="grid-enabled" checked={gridEnabled} onCheckedChange={setGridEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Grid Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`h-8 text-xs rounded border ${gridSquare ? 'bg-gray-100 border-gray-300' : 'border-gray-200'}`}
                onClick={() => setGridSquare(true)}
              >
                Square
              </button>
              <button
                className={`h-8 text-xs rounded border ${!gridSquare ? 'bg-gray-100 border-gray-300' : 'border-gray-2 00'}`}
                onClick={() => setGridSquare(false)}
              >
                By cols/rows
              </button>
            </div>
          </div>

          {gridSquare ? (
            <div className="space-y-2">
              <Label htmlFor="grid-size">Cell Size: {gridSize}px</Label>
              <Slider value={[gridSize]} onValueChange={(v) => setGridSize(v[0])} max={512} min={2} step={2} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="grid-cols">Columns</Label>
                <Input id="grid-cols" type="number" value={gridCols} min={1} onChange={(e) => setGridCols(parseInt(e.target.value || '1', 10))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grid-rows">Rows</Label>
                <Input id="grid-rows" type="number" value={gridRows} min={1} onChange={(e) => setGridRows(parseInt(e.target.value || '1', 10))} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="grid-thickness">Line Width: {gridThickness}px</Label>
              <Slider value={[gridThickness]} onValueChange={(v) => setGridThickness(v[0])} max={6} min={1} step={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grid-color">Line Color</Label>
              <Input id="grid-color" type="color" value={gridColor} onChange={(e) => setGridColor(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gen-bg-color">Generation Background</Label>
            <Input id="gen-bg-color" type="color" value={generationFillColor} onChange={(e) => setGenerationFillColor(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bg-color">Canvas Background</Label>
            <Input id="bg-color" type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Sidebar;
