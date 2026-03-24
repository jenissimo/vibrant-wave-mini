import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Expand, Clock, Star, Pencil, Trash2 } from 'lucide-react';
import SmartTooltip from '@/components/ui/smart-tooltip';
import type { PromptHistoryEntry } from '@/lib/types';
import type { PromptPreset } from '@/lib/settingsStore';

interface BottomBarProps {
  references: string[];
  setReferences: (refs: string[]) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  onGenerate: (variantCount: number) => void;
  onAddRefToCanvas?: (index: number, src: string) => void;
  onPromptFocus?: () => void;
  onPromptBlur?: () => void;
  promptHistory: PromptHistoryEntry[];
  promptPresets: PromptPreset[];
  onSavePreset: (name: string, text: string) => void;
  onUpdatePreset: (id: string, updates: { name?: string; text?: string }) => void;
  onDeletePreset: (id: string) => void;
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

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const BottomBar: React.FC<BottomBarProps> = ({
  references, setReferences, prompt, setPrompt, onGenerate,
  onPromptFocus, onPromptBlur,
  promptHistory, promptPresets, onSavePreset, onUpdatePreset, onDeletePreset,
}) => {
  const MAX_ATTACHMENTS = 3;
  const MAX_ROWS = 4;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [textareaRows, setTextareaRows] = useState(1);
  const [variantCount, setVariantCount] = useState(1);
  const [showExpandedEditor, setShowExpandedEditor] = useState(false);
  const [expandedPrompt, setExpandedPrompt] = useState('');

  // History dropdown state
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);

  // Close history dropdown on outside click
  useEffect(() => {
    if (!showHistoryDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (
        historyDropdownRef.current && !historyDropdownRef.current.contains(e.target as Node) &&
        historyButtonRef.current && !historyButtonRef.current.contains(e.target as Node)
      ) {
        setShowHistoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showHistoryDropdown]);

  const openPicker = () => fileInputRef.current?.click();

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const lineHeight = 20;
    const newRows = Math.min(MAX_ROWS, Math.max(1, Math.ceil(scrollHeight / lineHeight)));
    setTextareaRows(newRows);
    textarea.style.height = `${newRows * lineHeight}px`;
  };

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
  };

  const openExpandedEditor = () => {
    setExpandedPrompt(prompt);
    setShowExpandedEditor(true);
    setTimeout(() => {
      expandedTextareaRef.current?.focus();
      expandedTextareaRef.current?.setSelectionRange(prompt.length, prompt.length);
    }, 0);
  };

  const closeExpandedEditor = (save: boolean) => {
    if (save) setPrompt(expandedPrompt);
    setShowExpandedEditor(false);
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
            <div className="relative">
              <Button
                ref={historyButtonRef}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground shrink-0"
                onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                title="Prompt history"
              >
                <Clock className="w-4 h-4" />
              </Button>
              {showHistoryDropdown && (
                <div
                  ref={historyDropdownRef}
                  className="absolute bottom-full mb-2 right-0 w-[360px] max-h-[300px] overflow-y-auto bg-background border border-border rounded-lg shadow-xl z-[100]"
                >
                  {promptHistory.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No prompt history yet</div>
                  ) : (
                    <div className="py-1">
                      {promptHistory.map((entry) => (
                        <button
                          key={entry.id}
                          className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 group"
                          onClick={() => {
                            setPrompt(entry.text);
                            setShowHistoryDropdown(false);
                          }}
                        >
                          <span className="text-sm text-foreground truncate flex-1">{entry.text}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(entry.timestamp)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground shrink-0"
              onClick={openExpandedEditor}
              title="Expand editor"
            >
              <Expand className="w-4 h-4" />
            </Button>
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
      {showExpandedEditor && createPortal(
        <ExpandedPromptEditor
          expandedPrompt={expandedPrompt}
          setExpandedPrompt={setExpandedPrompt}
          expandedTextareaRef={expandedTextareaRef}
          onClose={(save) => closeExpandedEditor(save)}
          onGenerate={() => {
            closeExpandedEditor(true);
            setTimeout(() => onGenerate(variantCount), 0);
          }}
          promptHistory={promptHistory}
          promptPresets={promptPresets}
          onSavePreset={onSavePreset}
          onUpdatePreset={onUpdatePreset}
          onDeletePreset={onDeletePreset}
        />,
        document.body
      )}
    </div>
  );
};

// ─── Expanded Prompt Editor with sidebar ─────────────────────────────────

interface ExpandedEditorProps {
  expandedPrompt: string;
  setExpandedPrompt: (v: string) => void;
  expandedTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onClose: (save: boolean) => void;
  onGenerate: () => void;
  promptHistory: PromptHistoryEntry[];
  promptPresets: PromptPreset[];
  onSavePreset: (name: string, text: string) => void;
  onUpdatePreset: (id: string, updates: { name?: string; text?: string }) => void;
  onDeletePreset: (id: string) => void;
}

const ExpandedPromptEditor: React.FC<ExpandedEditorProps> = ({
  expandedPrompt, setExpandedPrompt, expandedTextareaRef,
  onClose, onGenerate,
  promptHistory, promptPresets, onSavePreset, onUpdatePreset, onDeletePreset,
}) => {
  const [sidebarTab, setSidebarTab] = useState<'history' | 'presets'>('history');

  // Preset inline creation
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const newPresetInputRef = useRef<HTMLInputElement>(null);

  // Save-as-preset from history entry
  const [savingFromHistoryId, setSavingFromHistoryId] = useState<string | null>(null);
  const [savingFromHistoryName, setSavingFromHistoryName] = useState('');
  const savingFromHistoryInputRef = useRef<HTMLInputElement>(null);

  // Rename preset inline
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renamingPresetName, setRenamingPresetName] = useState('');
  const renamingInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  useEffect(() => {
    if (isCreatingPreset) newPresetInputRef.current?.focus();
  }, [isCreatingPreset]);

  useEffect(() => {
    if (savingFromHistoryId) savingFromHistoryInputRef.current?.focus();
  }, [savingFromHistoryId]);

  useEffect(() => {
    if (renamingPresetId) renamingInputRef.current?.focus();
  }, [renamingPresetId]);

  const handleSaveNewPreset = () => {
    const name = newPresetName.trim();
    if (!name || !expandedPrompt.trim()) return;
    onSavePreset(name, expandedPrompt.trim());
    setNewPresetName('');
    setIsCreatingPreset(false);
  };

  const handleSaveFromHistory = (text: string) => {
    const name = savingFromHistoryName.trim();
    if (!name) return;
    onSavePreset(name, text);
    setSavingFromHistoryId(null);
    setSavingFromHistoryName('');
  };

  const handleRenamePreset = () => {
    const name = renamingPresetName.trim();
    if (!name || !renamingPresetId) return;
    onUpdatePreset(renamingPresetId, { name });
    setRenamingPresetId(null);
    setRenamingPresetName('');
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onClose(false)} />
      <div className="relative bg-background border border-border rounded-lg shadow-xl w-[960px] max-w-[90vw] h-[70vh] max-h-[700px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-foreground">Edit Prompt</span>
          <button
            className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => onClose(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: sidebar + editor */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-[240px] border-r border-border hidden sm:flex flex-col shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                className={`flex-1 px-3 py-2 text-xs font-medium ${sidebarTab === 'history' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setSidebarTab('history')}
              >
                History
              </button>
              <button
                className={`flex-1 px-3 py-2 text-xs font-medium ${sidebarTab === 'presets' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setSidebarTab('presets')}
              >
                Presets
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {sidebarTab === 'history' && (
                <div>
                  {promptHistory.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No prompt history yet</div>
                  ) : (
                    promptHistory.map((entry) => (
                      <div key={entry.id} className="group relative">
                        {savingFromHistoryId === entry.id ? (
                          <div className="px-3 py-2 border-b border-border/50">
                            <input
                              ref={savingFromHistoryInputRef}
                              type="text"
                              value={savingFromHistoryName}
                              onChange={(e) => setSavingFromHistoryName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveFromHistory(entry.text);
                                if (e.key === 'Escape') { e.stopPropagation(); setSavingFromHistoryId(null); }
                              }}
                              placeholder="Preset name…"
                              className="w-full text-xs px-2 py-1 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-ring"
                            />
                            <div className="flex gap-1 mt-1">
                              <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleSaveFromHistory(entry.text)}>Save</Button>
                              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSavingFromHistoryId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border/50"
                            onClick={() => setExpandedPrompt(entry.text)}
                          >
                            <div className="text-xs text-foreground line-clamp-3">{entry.text}</div>
                            <div className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(entry.timestamp)}</div>
                          </button>
                        )}
                        {savingFromHistoryId !== entry.id && (
                          <button
                            className="absolute top-2 right-2 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Save as preset"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSavingFromHistoryId(entry.id);
                              setSavingFromHistoryName(entry.text.slice(0, 40));
                            }}
                          >
                            <Star className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {sidebarTab === 'presets' && (
                <div>
                  {/* Save current as preset */}
                  <div className="p-2 border-b border-border/50">
                    {isCreatingPreset ? (
                      <div>
                        <input
                          ref={newPresetInputRef}
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNewPreset();
                            if (e.key === 'Escape') { e.stopPropagation(); setIsCreatingPreset(false); }
                          }}
                          placeholder="Preset name…"
                          className="w-full text-xs px-2 py-1 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-ring"
                        />
                        <div className="flex gap-1 mt-1">
                          <Button
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={handleSaveNewPreset}
                            disabled={!newPresetName.trim() || !expandedPrompt.trim()}
                          >
                            Save
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setIsCreatingPreset(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => {
                          setNewPresetName(expandedPrompt.trim().slice(0, 40));
                          setIsCreatingPreset(true);
                        }}
                        disabled={!expandedPrompt.trim()}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        Save current as preset
                      </Button>
                    )}
                  </div>

                  {promptPresets.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No presets yet</div>
                  ) : (
                    promptPresets.map((preset) => (
                      <div key={preset.id} className="group relative border-b border-border/50">
                        {renamingPresetId === preset.id ? (
                          <div className="px-3 py-2">
                            <input
                              ref={renamingInputRef}
                              type="text"
                              value={renamingPresetName}
                              onChange={(e) => setRenamingPresetName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenamePreset();
                                if (e.key === 'Escape') { e.stopPropagation(); setRenamingPresetId(null); }
                              }}
                              className="w-full text-xs px-2 py-1 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-ring"
                            />
                            <div className="flex gap-1 mt-1">
                              <Button size="sm" className="h-6 text-xs px-2" onClick={handleRenamePreset}>Save</Button>
                              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setRenamingPresetId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : deletingPresetId === preset.id ? (
                          <div className="px-3 py-2">
                            <div className="text-xs text-foreground mb-1">Delete &quot;{preset.name}&quot;?</div>
                            <div className="flex gap-1">
                              <Button variant="destructive" size="sm" className="h-6 text-xs px-2" onClick={() => { onDeletePreset(preset.id); setDeletingPresetId(null); }}>Delete</Button>
                              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setDeletingPresetId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-accent"
                            onClick={() => setExpandedPrompt(preset.text)}
                          >
                            <div className="text-xs font-medium text-foreground truncate pr-12">{preset.name}</div>
                            <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{preset.text}</div>
                          </button>
                        )}
                        {renamingPresetId !== preset.id && deletingPresetId !== preset.id && (
                          <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
                              title="Rename"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingPresetId(preset.id);
                                setRenamingPresetName(preset.name);
                              }}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-accent"
                              title="Delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingPresetId(preset.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 flex flex-col p-4 gap-3 min-w-0">
            <textarea
              ref={expandedTextareaRef}
              value={expandedPrompt}
              onChange={(e) => setExpandedPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  onGenerate();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose(false);
                }
              }}
              placeholder="Describe what to generate…"
              className="w-full flex-1 p-3 rounded-md border border-border bg-background text-sm text-foreground resize-none outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Ctrl+Enter to save & generate · Escape to cancel
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onClose(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => onClose(true)}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomBar;
