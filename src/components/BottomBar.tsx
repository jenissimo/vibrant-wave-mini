import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import SmartTooltip from '@/components/ui/smart-tooltip';

interface BottomBarProps {
  references: string[];
  setReferences: (refs: string[]) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  onGenerate: (variantCount: number) => void;
  onAddRefToCanvas?: (index: number, src: string) => void;
  onPromptFocus?: () => void;
  onPromptBlur?: () => void;
}

type RefItemProps = {
  src: string;
  index: number;
  onRemove: (index: number) => void;
};

const RefItem: React.FC<RefItemProps> = ({ src, index, onRemove }) => {
  return (
    <SmartTooltip
      containerClassName="relative"
      content={<img src={src} alt="preview" className="max-w-[192px] max-h-[192px] object-contain rounded" />}
      side="top"
    >
      <div className="group">
        <div className="w-16 h-16 rounded-lg border border-border bg-muted overflow-hidden relative">
          <img src={src} alt={`ref-${index + 1}`} className="w-full h-full object-cover" />
          <div className="absolute top-1 left-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
            {index + 1}
          </div>
        </div>
        <button
          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 hover:bg-background text-foreground border border-border flex items-center justify-center"
          onClick={() => onRemove(index)}
          aria-label="Remove reference"
          title="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </SmartTooltip>
  );
};

const BottomBar: React.FC<BottomBarProps> = ({ references, setReferences, prompt, setPrompt, onGenerate, onPromptFocus, onPromptBlur }) => {
  const MAX_ATTACHMENTS = 3;
  const MAX_ROWS = 4;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [textareaRows, setTextareaRows] = useState(1);
  const [variantCount, setVariantCount] = useState(1);

  const openPicker = () => fileInputRef.current?.click();

  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const lineHeight = 20; // Match input height (h-10 = 40px, so 20px per line)
    const newRows = Math.min(MAX_ROWS, Math.max(1, Math.ceil(scrollHeight / lineHeight)));
    
    setTextareaRows(newRows);
    textarea.style.height = `${newRows * lineHeight}px`;
  };

  // Adjust height when prompt changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [prompt]);

  const addReference = (dataUrl: string) => {
    if (!dataUrl) return;
    if (references.length >= MAX_ATTACHMENTS) return;
    setReferences([...references, dataUrl]);
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addReference(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    const remaining = Math.max(0, MAX_ATTACHMENTS - references.length);
    const toAdd = Math.min(remaining, files.length);
    for (let i = 0; i < toAdd; i++) {
      const reader = new FileReader();
      reader.onload = () => addReference(String(reader.result || ''));
      reader.readAsDataURL(files[i]);
    }
  };

  const removeReferenceAt = (index: number) => {
    const next = references.filter((_, i) => i !== index);
    setReferences(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onGenerate(variantCount);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    // Height will be adjusted by useEffect
  };

  return (
    <div id="bottom-bar" className="bg-background/80 backdrop-blur border-t border-border">
      <div className="px-4 py-3 flex items-center gap-4" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <div className="flex items-center gap-2">
          {references.map((src, i) => (
            <RefItem key={i} src={src} index={i} onRemove={removeReferenceAt} />
          ))}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => openPicker()}
              disabled={references.length >= MAX_ATTACHMENTS}
              title={references.length >= MAX_ATTACHMENTS ? 'Max 3 attachments' : 'Add'}
            >
              <Plus className="w-4 h-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 w-full">
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onFocus={onPromptFocus}
              onBlur={onPromptBlur}
              rows={textareaRows}
              placeholder="Describe what to generate… (Reference images: 1, 2, 3… Canvas: last)"
              className="flex-1 resize-none overflow-hidden h-10"
              style={{ minHeight: '40px', maxHeight: `${MAX_ROWS * 20}px` }}
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              <Select value={variantCount.toString()} onValueChange={(v) => setVariantCount(Number(v))}>
                <SelectTrigger className="w-16 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
              <Button className="h-10 px-4" onClick={() => onGenerate(variantCount)}>
                Generate
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomBar;

