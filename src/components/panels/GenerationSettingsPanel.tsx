import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import Stepper from '@/components/ui/stepper';
import BaseFloatingPanel from '@/components/panels/BaseFloatingPanel';
import { ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface GenerationSettingsPanelProps {
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
  gridEnabled: boolean;
  setGridEnabled: (v: boolean) => void;
  gridCols: number;
  setGridCols: (n: number) => void;
  gridRows: number;
  setGridRows: (n: number) => void;
  gridThickness: number;
  setGridThickness: (n: number) => void;
  gridColor: string;
  setGridColor: (v: string) => void;
  generationFillColor: string;
  setGenerationFillColor: (v: string) => void;
}

const GenerationSettingsPanel: React.FC<GenerationSettingsPanelProps> = (props) => {
  const {
    aspectRatio, setAspectRatio,
    gridEnabled, setGridEnabled,
    gridCols, setGridCols,
    gridRows, setGridRows,
    gridThickness, setGridThickness,
    gridColor, setGridColor,
    generationFillColor, setGenerationFillColor,
  } = props;

  const [gridOpen, setGridOpen] = React.useState(true);
  const presets = ['1:1', '2:1', '1:2' ,'4:3','3:4','16:9','9:16'];
  const isPreset = presets.includes(aspectRatio);
  const selectValue = isPreset ? aspectRatio : 'custom';

  return (
    <BaseFloatingPanel title="Generation Settings" initialPosition={{ x: 160, y: 12 }} className="w-80" storageKey="generation-settings">
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="aspect">Aspect Ratio</Label>
          <Select
            value={selectValue}
            onValueChange={(v)=>{
              if (v === 'custom') return; 
              setAspectRatio(v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select ratio" />
            </SelectTrigger>
            <SelectContent>
              {presets.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {selectValue === 'custom' && (
            <div className="flex items-center gap-2">
              <Input id="aspect" value={aspectRatio} onChange={(e)=>setAspectRatio(e.target.value)} placeholder="e.g. 1:1" className="h-8" />
            </div>
          )}
        </div>

        <div className="rounded-md border">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-700"
            onClick={() => setGridOpen(v => !v)}
          >
            <span className="font-medium">Grid settings</span>
            <ChevronDown size={14} className={`transition-transform ${gridOpen ? 'rotate-180' : ''}`} />
          </button>
          {gridOpen && (
            <div className="p-3 space-y-4 border-t">
              <div className="flex items-center justify-between gap-2 rounded-md border p-2">
                <Label htmlFor="grid" className="text-xs">Enable Grid</Label>
                <Switch id="grid" checked={gridEnabled} onCheckedChange={setGridEnabled} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Columns</Label>
                  <Stepper value={gridCols} onChange={setGridCols} min={1} max={20} />
                </div>
                <div className="space-y-2">
                  <Label>Rows</Label>
                  <Stepper value={gridRows} onChange={setGridRows} min={1} max={20} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1">
                  <Label>Line Width: {gridThickness}px</Label>
                  <Slider value={[gridThickness]} onValueChange={(v)=>setGridThickness(v[0])} max={6} min={1} step={1} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="grid-color">Line Color</Label>
                  <div className="flex items-center gap-2">
                    <Input id="grid-color" type="color" value={gridColor} onChange={(e)=>setGridColor(e.target.value)} className="w-10 h-8 p-0" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="gen-bg">Generation Background</Label>
          <div className="flex items-center gap-2">
            <Input id="gen-bg" type="color" value={generationFillColor} onChange={(e)=>setGenerationFillColor(e.target.value)} className="w-10 h-8 p-0" />
          </div>
        </div>
      </form>
    </BaseFloatingPanel>
  );
};

export default GenerationSettingsPanel;


