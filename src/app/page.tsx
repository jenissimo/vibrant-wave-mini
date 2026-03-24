'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Canvas, { CanvasRef } from '@/components/Canvas';
import CanvasTopToolbar from '@/components/CanvasTopToolbar';
import CanvasLeftToolbar from '@/components/CanvasLeftToolbar';
import CanvasBottomZoom from '@/components/CanvasBottomZoom';
import AssistantNote from '@/components/AssistantNote';
import BottomBar from '@/components/BottomBar';
import LayersPanel from '@/components/panels/LayersPanel';
import ElementSettingsPanel from '@/components/panels/ElementSettingsPanel';
import GenerationSettingsPanel from '@/components/panels/GenerationSettingsPanel';
import BoardsPanel from '@/components/panels/BoardsPanel';
import ChangelogPanel from '@/components/panels/ChangelogPanel';
import VariantSwitcher from '@/components/VariantSwitcher';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useHistoryState } from '@/lib/useHistoryState';
import { useTheme } from '@/lib/useTheme';
import { useCanvasLayout, useGenerationArea } from '@/lib/useCanvasLayout';
import { useElementHistoryOps } from '@/lib/useElementHistoryOps';
import { useGenerationFlow } from '@/lib/useGenerationFlow';
import { useGlobalHotkeys } from '@/lib/useGlobalHotkeys';
import type { DocSettings, PromptHistoryEntry } from '@/lib/types';
import { settingsStore, PromptPreset } from '@/lib/settingsStore';
import { commandManager } from '@/lib/commandManager';
import { UpdateSettingsCommand } from '@/lib/commands/UpdateSettingsCommand';
import { UpdateElementCommand } from '@/lib/commands/UpdateElementCommand';
import { AddElementCommand } from '@/lib/commands/AddElementCommand';
import { RemoveElementCommand } from '@/lib/commands/RemoveElementCommand';
import { CanvasElementData, InteractionMode } from '@/components/Canvas';
import { exportSliceAsImage, isSlice } from '@/lib/sliceUtils';
import { insertImageToCanvas, getImageFromFile, isImageFile } from '@/lib/imageUtils';
import {
  generateSessionId,
  saveSession,
  loadSession,
  getLastSession,
  getAllSessions,
  initializeChannel,
  checkActiveTabs,
  startHeartbeat,
} from '@/lib/boardStorage';
import { exportBoardToWv, importBoardFromWv } from '@/lib/boardFileFormat';

function TextEditOverlay({ editingTextId, elements, canvasRef, onFinalize }: {
  editingTextId: string;
  elements: CanvasElementData[];
  canvasRef: React.RefObject<CanvasRef | null>;
  onFinalize: (id: string, text: string) => void;
}) {
  const el = elements.find(e => e.id === editingTextId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [screenPos, setScreenPos] = useState<{ x: number; y: number; scale: number } | null>(null);

  // Recompute position on every animation frame to track zoom/pan
  useEffect(() => {
    let rafId: number;
    const update = () => {
      const pos = canvasRef.current?.getScreenPosition(el?.x ?? 0, el?.y ?? 0);
      if (pos) setScreenPos(pos);
      rafId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(rafId);
  }, [editingTextId, el?.x, el?.y, canvasRef]);

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [editingTextId]);

  if (!el || el.type !== 'text' || !screenPos) return null;

  return (
    <textarea
      ref={textareaRef}
      defaultValue={el.text || ''}
      style={{
        position: 'absolute',
        left: screenPos.x,
        top: screenPos.y,
        fontSize: `${(el.fontSize || 24) * screenPos.scale}px`,
        fontFamily: el.fontFamily || 'Arial',
        color: el.fill || '#000000',
        width: `${(el.width || 200) * screenPos.scale}px`,
        minHeight: `${(el.fontSize || 24) * 1.5 * screenPos.scale}px`,
        background: 'transparent',
        border: '1px dashed var(--border)',
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        transformOrigin: 'top left',
        transform: `rotate(${el.rotation || 0}deg)`,
        zIndex: 20,
        padding: 0,
        margin: 0,
        lineHeight: '1.2',
      }}
      onBlur={(e) => onFinalize(editingTextId, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onFinalize(editingTextId, e.currentTarget.value);
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onFinalize(editingTextId, e.currentTarget.value);
        }
      }}
    />
  );
}

export default function Home() {
  const { data: session } = useSession();
  const initialSettings: DocSettings = {
    aspectRatio: '1:1',
    gridEnabled: false,
    gridCols: 2,
    gridRows: 2,
    gridThickness: 1,
    gridColor: '#d1d5db',
    backgroundColor: '#f5f5f5',
    generationFillColor: '#ffffff',
  };
  const docHistory = useHistoryState({ elements: [], settings: initialSettings });
  const elements = docHistory.present.elements;
  const settings = docHistory.present.settings;
  const [references, setReferences] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const canvasRef = useRef<CanvasRef>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('select');
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(3);
  const [textColor, setTextColor] = useState('#000000');
  const [textFontSize, setTextFontSize] = useState(24);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const { isHydrated } = useTheme();
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const lastClickedRef = useRef<string | null>(null);
  const [activeFocus, setActiveFocus] = useState<'canvas' | 'prompt' | null>(null);
  const gen = useGenerationFlow();
  
  // Session management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionInitializedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof initializeChannel> | null>(null);
  const heartbeatCleanupRef = useRef<(() => void) | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [showBoardsPanel, setShowBoardsPanel] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  // Prompt presets (global, from settingsStore)
  const [promptPresets, setPromptPresets] = useState<PromptPreset[]>(() => settingsStore.getPresets());
  useEffect(() => {
    return settingsStore.subscribe((state) => {
      setPromptPresets(state.settings.promptPresets ?? []);
    });
  }, []);

  const { canvasContainerRef, canvasSize, isCanvasReady } = useCanvasLayout();
  const generationArea = useGenerationArea(settings, canvasSize);

  // Element operations hook
  const ops = useElementHistoryOps();
  const {
    onElementTransformStart,
    onElementTransformEnd,
    onElementDragStart,
    onElementDragEnd,
    onMultiDragStart,
    onMultiDragEnd,
    zOrder,
    addElementFromRef: addElementFromRefOp,
    removeElement,
  } = ops;
  
  const MAX_PROMPT_HISTORY = 10;

  const appendPromptHistory = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    docHistory.updatePresent((doc) => {
      const history = doc.promptHistory ?? [];
      if (history.length > 0 && history[0].text === trimmed) return doc;
      const entry: PromptHistoryEntry = {
        id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text: trimmed,
        timestamp: Date.now(),
      };
      return { ...doc, promptHistory: [entry, ...history].slice(0, MAX_PROMPT_HISTORY) };
    });
  }, [docHistory.updatePresent]);

  const handleGenerate = async (variantCount: number = 1) => {
    const base64 = canvasRef.current?.exportGenerationArea();
    if (!base64) return;
    appendPromptHistory(prompt);
    await gen.handleGenerate({
      variantCount,
      payload: { prompt, canvas: base64, attachments: references, aspectRatio: settings.aspectRatio },
      onSingleVariant: async (imageUrl) => { await addVariantToCanvas(imageUrl); },
    });
  };

  const addVariantToCanvas = async (imageUrl: string) => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load generated image'));
      img.src = imageUrl;
    });
    const ratio = Math.min(
      generationArea.width / Math.max(1, img.width),
      generationArea.height / Math.max(1, img.height),
      1
    );
    const w = Math.max(1, img.width * ratio);
    const h = Math.max(1, img.height * ratio);
    const x = (generationArea.width - w) / 2;
    const y = (generationArea.height - h) / 2;
    const id = crypto.randomUUID();
    const newElement: CanvasElementData = {
      id,
      type: 'image',
      src: imageUrl,
      x,
      y,
      width: w, 
      height: h, 
      originalWidth: img.width,
      originalHeight: img.height,
      visible: true, 
      locked: false 
    };
    commandManager.execute(new AddElementCommand(newElement));
    setSelectedElementIds([id]);
  };

  const handleAcceptVariant = async (variant: { image: string | null; text: string | null }) => {
    if (variant.image) {
      await addVariantToCanvas(variant.image);
    }
    gen.setGeneratedVariants(null);
  };

  const handleSignOut = async () => {
    // Check if OIDC logout URI is configured
    try {
      const configRes = await fetch('/api/auth/config');
      const config = await configRes.json();
      
      if (config.oidcEnabled && config.oidcLogoutUri) {
        // Sign out locally first, then redirect to OIDC logout
        await signOut({ redirect: false });
        window.location.href = config.oidcLogoutUri;
      } else {
        // Standard logout
        await signOut({ callbackUrl: '/login' });
      }
    } catch {
      // Fallback to standard logout
      await signOut({ callbackUrl: '/login' });
    }
  };

  const handleAcceptAllVariants = async (variants: Array<{ image: string | null; text: string | null }>) => {
    // Filter out variants without images
    const validVariants = variants.filter(v => v.image);
    if (validVariants.length === 0) {
      gen.setGeneratedVariants(null);
      return;
    }

    // Calculate optimal grid layout
    const cols = Math.ceil(Math.sqrt(validVariants.length));
    const rows = Math.ceil(validVariants.length / cols);
    const cellWidth = generationArea.width / cols;
    const cellHeight = generationArea.height / rows;

    // Load all images and calculate positions
    const imageData = await Promise.all(
      validVariants.map(async (variant) => {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load generated image'));
          img.src = variant.image!;
        });
        return { img, variant };
      })
    );

    // Add all variants to canvas in grid layout
    const addedIds: string[] = [];
    for (let index = 0; index < imageData.length; index++) {
      const { img, variant } = imageData[index];
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Calculate cell position
      const cellX = generationArea.x + col * cellWidth;
      const cellY = generationArea.y + row * cellHeight;
      
      // Scale image to fit in cell (with some padding)
      const padding = 10;
      const availableWidth = cellWidth - padding * 2;
      const availableHeight = cellHeight - padding * 2;
      const ratio = Math.min(
        availableWidth / Math.max(1, img.width),
        availableHeight / Math.max(1, img.height),
        1
      );
      
      const w = Math.max(1, img.width * ratio);
      const h = Math.max(1, img.height * ratio);
      
      // Center image in cell
      const x = cellX + (cellWidth - w) / 2;
      const y = cellY + (cellHeight - h) / 2;
      
      const id = `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${index}`;
      const newElement: CanvasElementData = {
        id,
        type: 'image',
        src: variant.image!,
        x,
        y,
        width: w,
        height: h,
        originalWidth: img.width,
        originalHeight: img.height,
        visible: true,
        locked: false,
      };
      
      commandManager.execute(new AddElementCommand(newElement));
      addedIds.push(id);
    }

    // Select the last added element
    if (addedIds.length > 0) {
      setSelectedElementIds([addedIds[addedIds.length - 1]]);
    }

    gen.setGeneratedVariants(null);
  };

  const handleCancelVariants = () => {
    gen.setGeneratedVariants(null);
  };

  const onSelectElement = useCallback((id: string | null, opts?: { shift?: boolean; ctrl?: boolean }) => {
    if (!id) {
      setSelectedElementIds([]);
      lastClickedRef.current = null;
      return;
    }
    if (id === 'generation-area') {
      setSelectedElementIds(['generation-area']);
      lastClickedRef.current = null;
      return;
    }
    if (opts?.shift && lastClickedRef.current) {
      setSelectedElementIds(prev => {
        const elementIds = elements.map(e => e.id);
        const startIdx = elementIds.indexOf(lastClickedRef.current!);
        const endIdx = elementIds.indexOf(id);
        if (startIdx === -1 || endIdx === -1) return [id];
        const low = Math.min(startIdx, endIdx);
        const high = Math.max(startIdx, endIdx);
        const rangeIds = elementIds.slice(low, high + 1);
        const merged = new Set([...prev.filter(x => x !== 'generation-area'), ...rangeIds]);
        return Array.from(merged);
      });
      return;
    }
    if (opts?.ctrl) {
      setSelectedElementIds(prev => {
        const filtered = prev.filter(x => x !== 'generation-area');
        return filtered.includes(id) ? filtered.filter(x => x !== id) : [...filtered, id];
      });
    } else {
      setSelectedElementIds([id]);
    }
    lastClickedRef.current = id;
  }, [elements]);
  const handleMarqueeSelect = useCallback((ids: string[], opts?: { shift?: boolean }) => {
    if (opts?.shift) {
      setSelectedElementIds(prev => {
        const merged = new Set([...prev.filter(x => x !== 'generation-area'), ...ids]);
        return Array.from(merged);
      });
    } else {
      setSelectedElementIds(ids.length > 0 ? ids : []);
    }
    if (ids.length > 0) lastClickedRef.current = ids[ids.length - 1];
  }, []);

  // Moved element handlers to a reusable hook
  const { moveUp, moveDown, bringToFront, sendToBack } = zOrder;

  // Add element from references into canvas center
  const addElementFromRef = async (index: number, src: string) => {
    if (!src) return;
    const id = await addElementFromRefOp(src, generationArea);
    setSelectedElementIds([id]);
  };

  // Keep selection valid across history changes
  useEffect(() => {
    setSelectedElementIds(prev => {
      const valid = prev.filter(id => id === 'generation-area' || elements.some(e => e.id === id));
      return valid.length !== prev.length ? valid : prev;
    });
  }, [elements]);

  // Global hotkeys
  useGlobalHotkeys({
    enabled: true,
    selectedElementIds,
    elements,
    removeElement,
    addElement: async (el) => await addElementFromRefOp(el.src || '', el),
    addReference: (src) => setReferences([...references, src]),
    setSelectedElementIds,
    undo: docHistory.undo,
    redo: docHistory.redo,
    activeFocus,
    interactionMode,
    setInteractionMode,
    brushSize,
    setBrushSize,
  });

  // Update URL with sessionId
  const updateSessionUrl = useCallback((newSessionId: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('session', newSessionId);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Initialize session on mount
  useEffect(() => {
    if (sessionInitializedRef.current || typeof window === 'undefined') return;
    sessionInitializedRef.current = true;

    const initializeSession = async () => {
      const getDefaultBoardName = async () => {
        const existing = await getAllSessions();
        return `Board ${existing.length + 1}`;
      };

      // Get sessionId from URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlSessionId = urlParams.get('session');

      if (urlSessionId) {
        // Try to load session from IndexedDB
        const sessionData = await loadSession(urlSessionId);
        if (sessionData) {
          // Load existing session
          docHistory.reset(sessionData.docState);
          setSessionId(urlSessionId);
        } else {
          // Session not found, create new one with this ID
          setSessionId(urlSessionId);
          await saveSession(urlSessionId, docHistory.present, await getDefaultBoardName());
        }
      } else {
        // No sessionId in URL, determine which session to use
        const channel = initializeChannel();
        channelRef.current = channel;

        if (channel) {
          // Check for active tabs
          const tempSessionId = generateSessionId();
          const hasActiveTabs = await checkActiveTabs(channel, tempSessionId);

          if (hasActiveTabs) {
            // Other tabs are active, create new session
            const newSessionId = generateSessionId();
            setSessionId(newSessionId);
            updateSessionUrl(newSessionId);
            await saveSession(newSessionId, docHistory.present, await getDefaultBoardName());
          } else {
            // No active tabs, load last session
            const lastSession = await getLastSession();
            if (lastSession) {
              docHistory.reset(lastSession.docState);
              setSessionId(lastSession.sessionId);
              updateSessionUrl(lastSession.sessionId);
            } else {
              // No sessions found, create new one
              const newSessionId = generateSessionId();
              setSessionId(newSessionId);
              updateSessionUrl(newSessionId);
              await saveSession(newSessionId, docHistory.present, await getDefaultBoardName());
            }
          }
        } else {
          // BroadcastChannel not available, create new session
          const newSessionId = generateSessionId();
          setSessionId(newSessionId);
          updateSessionUrl(newSessionId);
          await saveSession(newSessionId, docHistory.present, await getDefaultBoardName());
        }
      }
    };

    initializeSession();
  }, [docHistory, updateSessionUrl]);

  // Start heartbeat when sessionId is set
  useEffect(() => {
    if (!sessionId || !channelRef.current) return;

    const cleanup = startHeartbeat(channelRef.current, sessionId);
    heartbeatCleanupRef.current = cleanup;

    return () => {
      cleanup();
      heartbeatCleanupRef.current = null;
    };
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatCleanupRef.current) {
        heartbeatCleanupRef.current();
      }
    };
  }, []);

  // Auto-save with debounce
  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;

    // Clear existing timeout
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for saving (500ms debounce)
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        await saveSession(sessionId, docHistory.present);
      } catch (error) {
        console.error('Failed to auto-save session:', error);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [sessionId, docHistory.present]);

  // File save/load handlers
  const handleSaveBoard = useCallback(async () => {
    try {
      const blob = await exportBoardToWv(docHistory.present);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename with timestamp
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      a.download = `board_${timestamp}.wv`;
      
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to save board:', error);
    }
  }, [docHistory.present]);

  const handleLoadBoard = useCallback(async (file: File) => {
    try {
      const docState = await importBoardFromWv(file);
      docHistory.reset(docState);
      // Auto-save will handle saving to IndexedDB if sessionId is set
    } catch (error) {
      console.error('Failed to load board:', error);
    }
  }, [docHistory]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLoadBoard(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleLoadBoard]);

  const handleLoadBoardFromSession = useCallback(async (sessionIdToLoad: string) => {
    try {
      const sessionData = await loadSession(sessionIdToLoad);
      if (sessionData) {
        docHistory.reset(sessionData.docState);
        setSessionId(sessionIdToLoad);
        updateSessionUrl(sessionIdToLoad);
        setShowBoardsPanel(false);
      }
    } catch (error) {
      console.error('Failed to load board from session:', error);
    }
  }, [docHistory, updateSessionUrl]);

  const handleCreateNewBoard = useCallback(async () => {
    const newSessionId = generateSessionId();
    const defaultSettings: DocSettings = {
      aspectRatio: '1:1',
      gridEnabled: false,
      gridCols: 2,
      gridRows: 2,
      gridThickness: 1,
      gridColor: '#d1d5db',
      backgroundColor: '#f5f5f5',
      generationFillColor: '#ffffff',
    };
    const emptyDocState = { elements: [], settings: defaultSettings };
    const existingSessions = await getAllSessions();
    const boardName = `Board ${existingSessions.length + 1}`;
    docHistory.reset(emptyDocState);
    setSessionId(newSessionId);
    updateSessionUrl(newSessionId);
    await saveSession(newSessionId, emptyDocState, boardName);
    setShowBoardsPanel(false);
  }, [docHistory, updateSessionUrl]);

  // Settings update helpers
  const updateSettings = (partial: Partial<DocSettings>) => {
    const currentDoc = settingsStore.getState().doc;
    if (currentDoc) {
      const oldSettings = currentDoc.settings;
      const newSettings = { ...oldSettings, ...partial };
      const command = new UpdateSettingsCommand(oldSettings, newSettings);
      commandManager.execute(command);
    }
  };

  // --- Drawing/Text/Eraser handlers ---
  const handleDrawingComplete = useCallback((element: CanvasElementData) => {
    commandManager.execute(new AddElementCommand(element));
  }, []);

  // Track pending text element id (created but not yet confirmed)
  const pendingTextIdRef = useRef<string | null>(null);

  const handleTextCreate = useCallback((worldPos: { x: number; y: number }) => {
    const id = crypto.randomUUID();
    const element: CanvasElementData = {
      id,
      type: 'text',
      x: worldPos.x,
      y: worldPos.y,
      width: 200,
      height: textFontSize * 1.5,
      text: '',
      fontSize: textFontSize,
      fontFamily: 'Arial',
      fill: textColor,
      visible: true,
      locked: false,
    };
    commandManager.execute(new AddElementCommand(element));
    pendingTextIdRef.current = id;
    setSelectedElementIds([id]);
    setEditingTextId(id);
  }, [textFontSize, textColor]);

  const handleTextEdit = useCallback((id: string) => {
    pendingTextIdRef.current = null;
    setEditingTextId(id);
  }, []);

  const finalizeTextEdit = useCallback((id: string, newText: string) => {
    const el = elements.find(e => e.id === id);
    if (!el) { setEditingTextId(null); pendingTextIdRef.current = null; return; }
    if (!newText.trim()) {
      // Undo the AddElement instead of creating a separate RemoveElement
      if (pendingTextIdRef.current === id) {
        commandManager.undo();
      } else {
        commandManager.execute(new RemoveElementCommand(id));
      }
      setSelectedElementIds([]);
    } else if (newText !== el.text) {
      commandManager.execute(new UpdateElementCommand(id, { text: el.text }, { text: newText }));
    }
    setEditingTextId(null);
    pendingTextIdRef.current = null;
  }, [elements]);

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div
          ref={canvasContainerRef}
          className="flex-1 relative bg-background min-h-0"
          onFocus={() => setActiveFocus('canvas')}
          onBlur={() => setActiveFocus(null)}
          tabIndex={-1} // Make div focusable
        >
          {gen.assistantNote && (
            <AssistantNote
              message={gen.assistantNote}
              onDismiss={() => gen.setAssistantNote(null)}
            />
          )}
          {/* Canvas left toolbar (tools) */}
          <CanvasLeftToolbar
            interactionMode={interactionMode}
            setInteractionMode={setInteractionMode}
            color={interactionMode === 'text' ? textColor : brushColor}
            onColorChange={interactionMode === 'text' ? setTextColor : setBrushColor}
            size={interactionMode === 'text' ? textFontSize : brushSize}
            onSizeChange={interactionMode === 'text' ? setTextFontSize : setBrushSize}
            sizeMin={interactionMode === 'text' ? 8 : 1}
            sizeMax={interactionMode === 'text' ? 200 : 50}
          />
          {/* Canvas top toolbar (actions) */}
          <CanvasTopToolbar
            snapEnabled={snapEnabled}
            onToggleSnap={setSnapEnabled}
            theme={settingsStore.getState().settings.theme}
            isHydrated={isHydrated}
            onToggleTheme={() => {
              const currentTheme = settingsStore.getState().settings.theme;
              if (currentTheme === 'light') {
                settingsStore.setTheme('dark');
              } else if (currentTheme === 'dark') {
                settingsStore.setTheme('system');
              } else {
                settingsStore.setTheme('light');
              }
            }}
            onDownload={() => {
              const dataUrl = canvasRef.current?.exportGenerationArea();
              if (!dataUrl) return;
              const a = document.createElement('a');
              a.href = dataUrl;
              a.download = 'generation.png';
              a.click();
            }}
            onSignOut={handleSignOut}
            showSignOut={!!session}
            onUndo={docHistory.undo}
            onRedo={docHistory.redo}
            canUndo={docHistory.canUndo}
            canRedo={docHistory.canRedo}
            onSaveBoard={handleSaveBoard}
            onLoadBoard={handleLoadClick}
            onOpenBoards={() => setShowBoardsPanel(!showBoardsPanel)}
            onOpenChangelog={() => setShowChangelog(!showChangelog)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".wv"
            className="hidden"
            onChange={handleFileChange}
          />

          {isCanvasReady ? (
            <Canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              generationArea={generationArea}
              gridEnabled={settings.gridEnabled}
              backgroundColor={settings.backgroundColor}
              gridCols={settings.gridCols}
              gridRows={settings.gridRows}
              gridColor={settings.gridColor}
              gridThickness={settings.gridThickness}
              generationFillColor={settings.generationFillColor}
              attachmentCount={references.length}
              elements={elements}
              selectedElementIds={selectedElementIds}
              interactionMode={interactionMode}
              snapEnabled={snapEnabled}
              onSelectElement={onSelectElement}
              onElementPositionChange={() => {}}
              onElementTransform={() => {}}
              onElementTransformStart={(id) => onElementTransformStart(id, elements)}
              onElementTransformMove={() => {}}
              onElementTransformEnd={(id, finalRect) => onElementTransformEnd(id, finalRect)}
              onElementDragStart={(id) => onElementDragStart(id, elements)}
              onElementDragEnd={(id, finalPosition) => onElementDragEnd(id, finalPosition)}
              onElementNudge={() => {}}
              onMultiDragStart={(ids) => onMultiDragStart(ids, elements)}
              onMultiDragEnd={(positions) => onMultiDragEnd(positions)}
              onMarqueeSelect={handleMarqueeSelect}
              brushColor={brushColor}
              brushSize={brushSize}
              onDrawingComplete={handleDrawingComplete}
              onTextCreate={handleTextCreate}
              onTextEdit={handleTextEdit}
              editingTextId={editingTextId}
              onImageDrop={async (file, position) => {
                if (!isImageFile(file)) return;
                
                try {
                  const src = await getImageFromFile(file);
                  await insertImageToCanvas({
                    src,
                    name: file.name,
                    targetArea: generationArea,
                    maxSize: { width: generationArea.width, height: generationArea.height },
                    offset: { x: position.x - generationArea.x, y: position.y - generationArea.y }
                  }, (element) => {
                    setSelectedElementIds([element.id]);
                  });
                } catch (err) {
                  console.error('Failed to drop image:', err);
                }
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-block size-4 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
                Initializing canvas...
              </div>
            </div>
          )}

          {/* Text editing overlay */}
          {editingTextId && <TextEditOverlay
            editingTextId={editingTextId}
            elements={elements}
            canvasRef={canvasRef}
            onFinalize={finalizeTextEdit}
          />}

          {/* Canvas bottom-center controls */}
          <CanvasBottomZoom
            onZoomOut={() => canvasRef.current?.zoomOut()}
            onReset={() => canvasRef.current?.resetView()}
            onZoomIn={() => canvasRef.current?.zoomIn()}
            onFit={() => canvasRef.current?.fitToArea()}
          />
          {/* Settings panels */}
          {selectedElementIds.includes('generation-area') && (
            <GenerationSettingsPanel
              aspectRatio={settings.aspectRatio}
              setAspectRatio={(v) => updateSettings({ aspectRatio: v })}
              gridEnabled={settings.gridEnabled}
              setGridEnabled={(v) => updateSettings({ gridEnabled: v })}
              gridCols={settings.gridCols}
              setGridCols={(n) => updateSettings({ gridCols: n })}
              gridRows={settings.gridRows}
              setGridRows={(n: number) => updateSettings({ gridRows: n })}
              gridThickness={settings.gridThickness}
              setGridThickness={(n) => updateSettings({ gridThickness: n })}
              gridColor={settings.gridColor}
              setGridColor={(v) => updateSettings({ gridColor: v })}
              generationFillColor={settings.generationFillColor}
              setGenerationFillColor={(v) => updateSettings({ generationFillColor: v })}
            />
          )}
          {selectedElementIds.length === 1 && selectedElementIds[0] !== 'generation-area' && (() => {
            const el = elements.find(e => e.id === selectedElementIds[0]);
            if (!el) return null;
            return (
              <ElementSettingsPanel
                element={el}
                onChange={(updates)=> {
                  const oldProps = (({ x, y, width, height, rotation, visible, locked, src, name }) => ({ x, y, width, height, rotation, visible, locked, src, name }))(el);
                  const newProps = { ...oldProps, ...updates };
                  commandManager.execute(new UpdateElementCommand(el.id, oldProps, newProps));
                }}
                onDelete={()=>{ removeElement(el.id); setSelectedElementIds([]); }}
                onDuplicate={()=>{
                  const id = `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
                  const newEl = { ...el, id, x: el.x + 16, y: el.y + 16 };
                  commandManager.execute(new AddElementCommand(newEl));
                  setSelectedElementIds([id]);
                }}
              />
            );
          })()}
          <LayersPanel
            elements={elements}
            selectedIds={selectedElementIds}
            onSelect={onSelectElement}
            onToggleVisible={(id)=> {
              const el = elements.find(e => e.id === id);
              if (el) {
                const oldProps = { visible: el.visible };
                const newProps = { visible: !el.visible };
                commandManager.execute(new UpdateElementCommand(el.id, oldProps, newProps));
              }
            }}
            onToggleLocked={()=> {/* lock removed */}}
            onDelete={(id)=>{ removeElement(id); setSelectedElementIds(prev => prev.filter(x => x !== id)); }}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onBringToFront={bringToFront}
            onSendToBack={sendToBack}
            onDownload={async (id) => {
              const el = elements.find(e => e.id === id);
              if (!el || !el.src) return;
              
              try {
                let dataUrl: string;
                if (isSlice(el)) {
                  // Export slice as separate image
                  dataUrl = await exportSliceAsImage(el);
                } else {
                  // Use original image
                  dataUrl = el.src;
                }
                
                const a = document.createElement('a');
                a.href = dataUrl;
                // Use element name without extension, or fallback to element ID
                const downloadName = el.name || `element-${id}`;
                a.download = `${downloadName}.png`;
                a.click();
              } catch (error) {
                console.error('Failed to export element:', error);
              }
            }}
            onImportImage={async (file) => {
              if (!isImageFile(file)) return;
              
              try {
                const src = await getImageFromFile(file);
                await insertImageToCanvas({
                  src,
                  name: file.name,
                  targetArea: generationArea,
                  maxSize: { width: generationArea.width, height: generationArea.height }
                }, (element) => {
                  setSelectedElementIds([element.id]);
                });
              } catch (err) {
                console.error('Failed to import image:', err);
              }
            }}
          />
          {showBoardsPanel && (
            <BoardsPanel
              onLoadBoard={handleLoadBoardFromSession}
              onCreateBoard={handleCreateNewBoard}
              currentSessionId={sessionId}
            />
          )}
          {showChangelog && <ChangelogPanel />}
        </div>
        
        {/* Sidebar removed */}
      </div>
      
      {/* Bottom panel */}
      <BottomBar
        references={references}
        setReferences={setReferences}
        prompt={prompt}
        setPrompt={setPrompt}
        onGenerate={handleGenerate}
        onAddRefToCanvas={addElementFromRef}
        onPromptFocus={() => setActiveFocus('prompt')}
        onPromptBlur={() => setActiveFocus(null)}
        promptHistory={docHistory.present.promptHistory ?? []}
        promptPresets={promptPresets}
        onSavePreset={(name, text) => settingsStore.addPreset(name, text)}
        onUpdatePreset={(id, updates) => settingsStore.updatePreset(id, updates)}
        onDeletePreset={(id) => settingsStore.deletePreset(id)}
      />

      {/* Variant Switcher */}
      {gen.generatedVariants && (
        <VariantSwitcher
          variants={gen.generatedVariants}
          onAccept={handleAcceptVariant}
          onAcceptAll={handleAcceptAllVariants}
          onCancel={handleCancelVariants}
        />
      )}

      {/* Loading Indicator */}
      <LoadingIndicator 
        isVisible={gen.isGenerating} 
        progress={gen.generationProgress}
        message="Generating image..."
      />

      {gen.errorMsg && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => gen.setErrorMsg(null)} />
          <div className="relative z-50 bg-background border border-border rounded-lg shadow-xl max-w-md w-[92%] p-4">
            <div className="text-sm font-semibold text-foreground mb-2">Generation error</div>
            <div className="text-sm text-foreground whitespace-pre-wrap mb-4">{gen.errorMsg}</div>
            <div className="flex justify-end">
              <button className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground" onClick={() => gen.setErrorMsg(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
