'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Canvas, { CanvasRef } from '@/components/Canvas';
import CanvasTopToolbar from '@/components/CanvasTopToolbar';
import CanvasBottomZoom from '@/components/CanvasBottomZoom';
import AssistantNote from '@/components/AssistantNote';
import BottomBar from '@/components/BottomBar';
import LayersPanel from '@/components/panels/LayersPanel';
import ElementSettingsPanel from '@/components/panels/ElementSettingsPanel';
import GenerationSettingsPanel from '@/components/panels/GenerationSettingsPanel';
import BoardsPanel from '@/components/panels/BoardsPanel';
import VariantSwitcher from '@/components/VariantSwitcher';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useHistoryState } from '@/lib/useHistoryState';
import { useTheme } from '@/lib/useTheme';
import { useCanvasLayout, useGenerationArea } from '@/lib/useCanvasLayout';
import { useElementHistoryOps } from '@/lib/useElementHistoryOps';
import { useGenerationFlow } from '@/lib/useGenerationFlow';
import { useGlobalHotkeys } from '@/lib/useGlobalHotkeys';
import type { DocSettings } from '@/lib/types';
import { settingsStore } from '@/lib/settingsStore';
import { commandManager } from '@/lib/commandManager';
import { UpdateSettingsCommand } from '@/lib/commands/UpdateSettingsCommand';
import { UpdateElementCommand } from '@/lib/commands/UpdateElementCommand';
import { AddElementCommand } from '@/lib/commands/AddElementCommand';
import { CanvasElementData } from '@/components/Canvas';
import { exportSliceAsImage, isSlice } from '@/lib/sliceUtils';
import { insertImageToCanvas, getImageFromFile, isImageFile } from '@/lib/imageUtils';
import { 
  generateSessionId, 
  saveSession, 
  loadSession, 
  getLastSession,
  initializeChannel,
  checkActiveTabs,
  startHeartbeat,
} from '@/lib/boardStorage';
import { exportBoardToWv, importBoardFromWv } from '@/lib/boardFileFormat';

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
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
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const { isHydrated } = useTheme();
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeFocus, setActiveFocus] = useState<'canvas' | 'prompt' | null>(null);
  const gen = useGenerationFlow();
  
  // Session management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionInitializedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof initializeChannel> | null>(null);
  const heartbeatCleanupRef = useRef<(() => void) | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const [showBoardsPanel, setShowBoardsPanel] = useState(false);

  const { canvasContainerRef, canvasSize, isCanvasReady } = useCanvasLayout();
  const generationArea = useGenerationArea(settings, canvasSize);

  // Element operations hook
  const ops = useElementHistoryOps();
  const {
    onElementTransformStart,
    onElementTransformEnd,
    onElementDragStart,
    onElementDragEnd,
    zOrder,
    addElementFromRef: addElementFromRefOp,
    removeElement,
  } = ops;
  
  const handleGenerate = async (variantCount: number = 1) => {
    const base64 = canvasRef.current?.exportGenerationArea();
    if (!base64) return;
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
    const id = `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
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
    setSelectedElementId(id);
  };

  const handleAcceptVariant = async (variant: { image: string | null; text: string | null }) => {
    if (variant.image) {
      await addVariantToCanvas(variant.image);
    }
    gen.setGeneratedVariants(null);
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
      setSelectedElementId(addedIds[addedIds.length - 1]);
    }

    gen.setGeneratedVariants(null);
  };

  const handleCancelVariants = () => {
    gen.setGeneratedVariants(null);
  };

  const onSelectElement = (id: string | null) => setSelectedElementId(id);
  // Moved element handlers to a reusable hook
  const { moveUp, moveDown, bringToFront, sendToBack } = zOrder;

  // Add element from references into canvas center
  const addElementFromRef = async (index: number, src: string) => {
    if (!src) return;
    const id = await addElementFromRefOp(src, generationArea);
    setSelectedElementId(id);
  };

  // Keep selection valid across history changes
  useEffect(() => {
    if (!selectedElementId || selectedElementId === 'generation-area') return;
    if (!elements.some(e => e.id === selectedElementId)) setSelectedElementId(null);
  }, [elements, selectedElementId]);

  // Global hotkeys
  useGlobalHotkeys({
    enabled: true,
    selectedElementId,
    elements,
    removeElement: (id) => { removeElement(id); if (selectedElementId === id) setSelectedElementId(null); },
    addElement: async (el) => await addElementFromRefOp(el.src, el),
    addReference: (src) => setReferences([...references, src]),
    setSelectedElementId,
    undo: docHistory.undo,
    redo: docHistory.redo,
    activeFocus,
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
          await saveSession(urlSessionId, docHistory.present);
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
            await saveSession(newSessionId, docHistory.present);
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
              await saveSession(newSessionId, docHistory.present);
            }
          }
        } else {
          // BroadcastChannel not available, create new session
          const newSessionId = generateSessionId();
          setSessionId(newSessionId);
          updateSessionUrl(newSessionId);
          await saveSession(newSessionId, docHistory.present);
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
          {/* Canvas top-left toolbar (icons) */}
          <CanvasTopToolbar
            interactionMode={interactionMode}
            setInteractionMode={setInteractionMode}
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
            onSignOut={() => signOut()}
            showSignOut={!!session}
            onUndo={docHistory.undo}
            onRedo={docHistory.redo}
            canUndo={docHistory.canUndo}
            canRedo={docHistory.canRedo}
            onSaveBoard={handleSaveBoard}
            onLoadBoard={handleLoadClick}
            onOpenBoards={() => setShowBoardsPanel(!showBoardsPanel)}
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
              selectedElementId={selectedElementId}
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
                    setSelectedElementId(element.id);
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


          {/* Canvas bottom-center controls */}
          <CanvasBottomZoom
            onZoomOut={() => canvasRef.current?.zoomOut()}
            onReset={() => canvasRef.current?.resetView()}
            onZoomIn={() => canvasRef.current?.zoomIn()}
            onFit={() => canvasRef.current?.fitToArea()}
          />
          {/* Settings panels */}
          {selectedElementId === 'generation-area' && (
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
          {selectedElementId && selectedElementId !== 'generation-area' && (() => {
            const el = elements.find(e => e.id === selectedElementId);
            if (!el) return null;
            return (
              <ElementSettingsPanel
                element={el}
                onChange={(updates)=> {
                  const oldProps = (({ x, y, width, height, rotation, visible, locked, src, name }) => ({ x, y, width, height, rotation, visible, locked, src, name }))(el);
                  const newProps = { ...oldProps, ...updates };
                  commandManager.execute(new UpdateElementCommand(el.id, oldProps, newProps));
                }}
                onDelete={()=>{ removeElement(el.id); setSelectedElementId(null); }}
                onDuplicate={()=>{
                  const id = `el_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
                  const newEl = { ...el, id, x: el.x + 16, y: el.y + 16 };
                  commandManager.execute(new AddElementCommand(newEl));
                  setSelectedElementId(id);
                }}
              />
            );
          })()}
          <LayersPanel
            elements={elements}
            selectedId={selectedElementId}
            onSelect={(id)=>{
              setSelectedElementId(id as string);
            }}
            onToggleVisible={(id)=> {
              const el = elements.find(e => e.id === id);
              if (el) {
                const oldProps = { visible: el.visible };
                const newProps = { visible: !el.visible };
                commandManager.execute(new UpdateElementCommand(el.id, oldProps, newProps));
              }
            }}
            onToggleLocked={()=> {/* lock removed */}}
            onDelete={(id)=>{ removeElement(id); if(selectedElementId===id) setSelectedElementId(null); }}
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
                  setSelectedElementId(element.id);
                });
              } catch (err) {
                console.error('Failed to import image:', err);
              }
            }}
          />
          {showBoardsPanel && (
            <BoardsPanel
              onLoadBoard={handleLoadBoardFromSession}
              currentSessionId={sessionId}
            />
          )}
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
