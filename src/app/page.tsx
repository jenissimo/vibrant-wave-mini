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
import { CompositeCommand } from '@/lib/commands/CompositeCommand';
import { CanvasElementData, InteractionMode, ShapeType } from '@/components/Canvas';
import { STICKY_SQUARE, STICKY_HORIZONTAL, STICKY_PADDING, STICKY_CORNER_RADIUS, STICKY_DEFAULT_COLOR, SHAPE_DEFAULT_SIZE, SHAPE_DEFAULT_BG, SHAPE_DEFAULT_BORDER, SHAPE_DEFAULT_BORDER_WIDTH, SHAPE_DEFAULT_PADDING } from '@/lib/canvasDefaults';
import { getGroupChildIds, expandSelectionToGroups } from '@/lib/groupUtils';
import { GroupElementsCommand, UngroupCommand } from '@/lib/commands/GroupElementsCommand';
import { calcStickyFontSize } from '@/lib/calcStickyFontSize';
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
  renameSession,
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

  if (!el || (el.type !== 'text' && el.type !== 'sticky' && el.type !== 'shape') || !screenPos) return null;

  const isSticky = el.type === 'sticky';
  const isShape = el.type === 'shape';
  const shapePad = isShape ? (el.padding ?? SHAPE_DEFAULT_PADDING) : 0;
  const pad = isSticky ? STICKY_PADDING * screenPos.scale : isShape ? shapePad * screenPos.scale : 0;
  const defaultFontSize = isSticky
    ? calcStickyFontSize(el.text || '', el.width, el.height, el.fontFamily || 'Inter', el.fontStyle || 'normal', STICKY_PADDING)
    : 24;

  const innerWidth = isSticky ? el.width - 2 * STICKY_PADDING : isShape ? el.width - 2 * shapePad : el.width;
  const innerHeight = isSticky ? el.height - 2 * STICKY_PADDING : isShape ? el.height - 2 * shapePad : (el.fontSize || 24) * 1.5;

  return (
    <textarea
      ref={textareaRef}
      defaultValue={el.text || ''}
      style={{
        position: 'absolute',
        left: screenPos.x + pad,
        top: screenPos.y + pad,
        fontSize: `${(isSticky ? defaultFontSize : (el.fontSize || defaultFontSize)) * screenPos.scale}px`,
        fontFamily: el.fontFamily || 'Inter',
        fontWeight: (el.fontStyle || '').includes('bold') ? 'bold' : 'normal',
        fontStyle: (el.fontStyle || '').includes('italic') ? 'italic' : 'normal',
        color: el.fill || '#000000',
        width: `${(innerWidth || 200) * screenPos.scale}px`,
        minHeight: `${(innerHeight || 100) * screenPos.scale}px`,
        background: isSticky ? (el.stickyColor || STICKY_DEFAULT_COLOR) : isShape ? (el.bgColor || SHAPE_DEFAULT_BG) : 'transparent',
        border: isSticky || isShape ? 'none' : '1px dashed var(--border)',
        borderRadius: isSticky ? `${STICKY_CORNER_RADIUS * screenPos.scale}px`
          : (isShape && el.shapeType === 'roundedRect') ? `${(el.cornerRadius ?? 12) * screenPos.scale}px`
          : undefined,
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        transformOrigin: 'top left',
        transform: `rotate(${el.rotation || 0}deg)`,
        zIndex: 20,
        padding: 0,
        margin: 0,
        lineHeight: '1.2',
        textAlign: isSticky ? 'center' : isShape ? (el.textAlign || 'center') : undefined,
      }}
      onBlur={(e) => onFinalize(editingTextId, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onFinalize(editingTextId, e.currentTarget.value);
        }
        // For sticky notes and shapes, Enter inserts newline; for text, Enter finalizes
        if (e.key === 'Enter' && !e.shiftKey && !isSticky && !isShape) {
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
    backgroundPattern: 'dots',
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
  const [stickyColor, setStickyColor] = useState(STICKY_DEFAULT_COLOR);
  const [stickyShape, setStickyShape] = useState<'square' | 'horizontal'>('square');
  const [shapeType, setShapeType] = useState<ShapeType>('rectangle');
  const [shapeBgColor, setShapeBgColor] = useState(SHAPE_DEFAULT_BG);
  const [shapeBorderColor, setShapeBorderColor] = useState(SHAPE_DEFAULT_BORDER);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [enteredGroupId, setEnteredGroupId] = useState<string | null>(null);
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
  const [boardName, setBoardName] = useState<string>('Board 1');

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
      setEnteredGroupId(null);
      lastClickedRef.current = null;
      return;
    }
    if (id === 'generation-area') {
      setSelectedElementIds(['generation-area']);
      setEnteredGroupId(null);
      lastClickedRef.current = null;
      return;
    }

    // Group-aware selection: if element is in a group and we haven't entered that group,
    // select the entire group
    const el = elements.find(e => e.id === id);
    if (el?.groupId && el.groupId !== enteredGroupId && !opts?.shift && !opts?.ctrl) {
      const groupChildIds = getGroupChildIds(elements, el.groupId);
      setSelectedElementIds([el.groupId, ...groupChildIds]);
      lastClickedRef.current = id;
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
  }, [elements, enteredGroupId]);
  const handleMarqueeSelect = useCallback((ids: string[], opts?: { shift?: boolean }) => {
    // Expand selection to include whole groups when child elements are marquee-selected
    const expandedIds = expandSelectionToGroups(ids, elements, enteredGroupId);
    if (opts?.shift) {
      setSelectedElementIds(prev => {
        const merged = new Set([...prev.filter(x => x !== 'generation-area'), ...expandedIds]);
        return Array.from(merged);
      });
    } else {
      setSelectedElementIds(expandedIds.length > 0 ? expandedIds : []);
    }
    if (expandedIds.length > 0) lastClickedRef.current = expandedIds[expandedIds.length - 1];
  }, [elements, enteredGroupId]);

  // Moved element handlers to a reusable hook
  const { moveUp, moveDown, bringToFront, sendToBack } = zOrder;

  // Add element from references into canvas center
  const addElementFromRef = async (index: number, src: string) => {
    if (!src) return;
    const id = await addElementFromRefOp(src, generationArea);
    setSelectedElementIds([id]);
  };

  // Keep selection and entered group valid across history changes
  useEffect(() => {
    setSelectedElementIds(prev => {
      const valid = prev.filter(id => id === 'generation-area' || elements.some(e => e.id === id));
      return valid.length !== prev.length ? valid : prev;
    });
    // Clear enteredGroupId if the group no longer exists
    if (enteredGroupId && !elements.some(e => e.id === enteredGroupId)) {
      setEnteredGroupId(null);
    }
  }, [elements, enteredGroupId]);

  // Group/ungroup handlers
  const handleGroup = useCallback(() => {
    const ids = selectedElementIds.filter(id => id !== 'generation-area');
    // Only group non-grouped elements (skip elements already in a group and group elements themselves)
    const groupableIds = ids.filter(id => {
      const el = elements.find(e => e.id === id);
      return el && el.type !== 'group' && !el.groupId;
    });
    if (groupableIds.length < 2) return;
    const cmd = new GroupElementsCommand(groupableIds);
    commandManager.execute(cmd);
    setSelectedElementIds([cmd.groupId, ...groupableIds]);
  }, [selectedElementIds, elements]);

  const handleUngroup = useCallback(() => {
    const ids = selectedElementIds.filter(id => id !== 'generation-area');
    const groupEl = ids.map(id => elements.find(e => e.id === id)).find(e => e?.type === 'group');
    if (!groupEl) return;
    const childIds = getGroupChildIds(elements, groupEl.id);
    commandManager.execute(new UngroupCommand(groupEl.id));
    setSelectedElementIds(childIds);
    setEnteredGroupId(null);
  }, [selectedElementIds, elements]);

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
    onGroup: handleGroup,
    onUngroup: handleUngroup,
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
              setBoardName(lastSession.name || 'Untitled Board');
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
        setBoardName(sessionData.name || 'Untitled Board');
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
      backgroundPattern: 'dots',
      generationFillColor: '#ffffff',
    };
    const emptyDocState = { elements: [], settings: defaultSettings };
    const existingSessions = await getAllSessions();
    const newBoardName = `Board ${existingSessions.length + 1}`;
    docHistory.reset(emptyDocState);
    setSessionId(newSessionId);
    setBoardName(newBoardName);
    updateSessionUrl(newSessionId);
    await saveSession(newSessionId, emptyDocState, newBoardName);
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
      fontFamily: 'Inter',
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
    const el = elements.find(e => e.id === id);
    // If element is in a group we haven't entered, enter the group first
    if (el?.groupId && el.groupId !== enteredGroupId) {
      setEnteredGroupId(el.groupId);
      setSelectedElementIds([id]);
      return;
    }
    pendingTextIdRef.current = null;
    setEditingTextId(id);
  }, [elements, enteredGroupId]);

  const handleStickyCreate = useCallback((worldPos: { x: number; y: number }) => {
    const id = crypto.randomUUID();
    const size = stickyShape === 'square' ? STICKY_SQUARE : STICKY_HORIZONTAL;
    const element: CanvasElementData = {
      id,
      type: 'sticky',
      x: worldPos.x - size.width / 2,
      y: worldPos.y - size.height / 2,
      width: size.width,
      height: size.height,
      text: '',
      fontFamily: 'Inter',
      fill: '#000000',
      stickyColor,
      stickyShape,
      visible: true,
      locked: false,
    };
    commandManager.execute(new AddElementCommand(element));
    pendingTextIdRef.current = id;
    setSelectedElementIds([id]);
    setEditingTextId(id);
    setInteractionMode('select');
  }, [stickyColor, stickyShape]);

  const handleShapeCreate = useCallback((worldPos: { x: number; y: number }) => {
    const id = crypto.randomUUID();
    const element: CanvasElementData = {
      id,
      type: 'shape',
      shapeType,
      x: worldPos.x - SHAPE_DEFAULT_SIZE.width / 2,
      y: worldPos.y - SHAPE_DEFAULT_SIZE.height / 2,
      width: SHAPE_DEFAULT_SIZE.width,
      height: SHAPE_DEFAULT_SIZE.height,
      text: '',
      fontSize: 16,
      fontFamily: 'Inter',
      fill: '#000000',
      bgColor: shapeBgColor,
      borderColor: shapeBorderColor,
      borderWidth: SHAPE_DEFAULT_BORDER_WIDTH,
      textAlign: 'center',
      verticalAlign: 'middle',
      padding: SHAPE_DEFAULT_PADDING,
      visible: true,
      locked: false,
    };
    commandManager.execute(new AddElementCommand(element));
    setSelectedElementIds([id]);
    setInteractionMode('select');
  }, [shapeType, shapeBgColor, shapeBorderColor]);

  const handleShapeEdit = useCallback((id: string) => {
    const el = elements.find(e => e.id === id);
    if (el?.groupId && el.groupId !== enteredGroupId) {
      setEnteredGroupId(el.groupId);
      setSelectedElementIds([id]);
      return;
    }
    pendingTextIdRef.current = null;
    setEditingTextId(id);
  }, [elements, enteredGroupId]);

  const handleStickyEdit = useCallback((id: string) => {
    const el = elements.find(e => e.id === id);
    if (el?.groupId && el.groupId !== enteredGroupId) {
      setEnteredGroupId(el.groupId);
      setSelectedElementIds([id]);
      return;
    }
    pendingTextIdRef.current = null;
    setEditingTextId(id);
  }, []);

  const finalizeTextEdit = useCallback((id: string, newText: string) => {
    const el = elements.find(e => e.id === id);
    if (!el) { setEditingTextId(null); pendingTextIdRef.current = null; return; }
    if (!newText.trim()) {
      if (el.type === 'sticky') {
        // Sticky notes persist when empty — just clear text if it changed
        if (el.text) {
          commandManager.execute(new UpdateElementCommand(id, { text: el.text }, { text: '' }));
        }
      } else if (pendingTextIdRef.current === id) {
        // Undo the AddElement instead of creating a separate RemoveElement
        commandManager.undo();
        setSelectedElementIds([]);
      } else {
        commandManager.execute(new RemoveElementCommand(id));
        setSelectedElementIds([]);
      }
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
            stickyColor={stickyColor}
            onStickyColorChange={setStickyColor}
            stickyShape={stickyShape}
            onStickyShapeChange={setStickyShape}
            shapeType={shapeType}
            onShapeTypeChange={setShapeType}
            shapeBgColor={shapeBgColor}
            onShapeBgColorChange={setShapeBgColor}
            shapeBorderColor={shapeBorderColor}
            onShapeBorderColorChange={setShapeBorderColor}
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
            boardName={boardName}
            onRenameBoard={async (name: string) => {
              setBoardName(name);
              if (sessionId) await renameSession(sessionId, name);
            }}
            onOpenBoards={() => setShowBoardsPanel(!showBoardsPanel)}
            onOpenChangelog={() => setShowChangelog(!showChangelog)}
            backgroundPattern={settings.backgroundPattern ?? 'dots'}
            onPatternChange={(p) => updateSettings({ backgroundPattern: p })}
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
              backgroundPattern={settings.backgroundPattern ?? 'dots'}
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
              onStickyCreate={handleStickyCreate}
              onStickyEdit={handleStickyEdit}
              onShapeCreate={handleShapeCreate}
              onShapeEdit={handleShapeEdit}
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
                  const oldProps: Partial<CanvasElementData> = {};
                  for (const key of Object.keys(updates) as (keyof CanvasElementData)[]) {
                    (oldProps as Record<string, unknown>)[key] = el[key];
                  }
                  commandManager.execute(new UpdateElementCommand(el.id, oldProps, updates));
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
            onDelete={(id)=>{
              const el = elements.find(e => e.id === id);
              // If deleting a group, delete children too
              if (el?.type === 'group') {
                const childIds = getGroupChildIds(elements, id);
                const allIds = [id, ...childIds];
                commandManager.execute(new CompositeCommand(allIds.map(cid => new RemoveElementCommand(cid))));
              } else {
                removeElement(id);
                // If deleting last child in a group, clean up the empty group
                if (el?.groupId) {
                  const siblings = getGroupChildIds(elements, el.groupId).filter(cid => cid !== id);
                  if (siblings.length === 0) {
                    removeElement(el.groupId);
                  }
                }
              }
              setSelectedElementIds(prev => prev.filter(x => x !== id));
            }}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onBringToFront={bringToFront}
            onSendToBack={sendToBack}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
            enteredGroupId={enteredGroupId}
            onEnterGroup={setEnteredGroupId}
            onToggleGroupCollapsed={(groupId) => {
              const el = elements.find(e => e.id === groupId);
              if (el) {
                commandManager.execute(new UpdateElementCommand(groupId, { collapsed: el.collapsed ?? false }, { collapsed: !el.collapsed }));
              }
            }}
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
              onRenameBoard={(sid, name) => {
                if (sid === sessionId) setBoardName(name);
              }}
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
