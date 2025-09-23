import { useEffect, useState } from 'react';
import { commandManager } from './commandManager';
import { settingsStore } from './settingsStore';
import { DocState } from './types';

export interface HistoryApi<T> {
  present: T;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  reset: (next: T) => void;
}

export function useHistoryState(initial: DocState): HistoryApi<DocState> {
  const [docState, setDocState] = useState(initial);
  const [canUndo, setCanUndo] = useState(commandManager.canUndo());
  const [canRedo, setCanRedo] = useState(commandManager.canRedo());

  useEffect(() => {
    const unsubscribe = commandManager.subscribe(() => {
      setCanUndo(commandManager.canUndo());
      setCanRedo(commandManager.canRedo());
    });
    const unsubscribeDoc = settingsStore.subscribe(state => {
      if (state.doc) {
        setDocState(state.doc);
      }
    });

    // Initialize doc in settingsStore
    if (!settingsStore.getState().doc) {
      settingsStore.setState({ doc: initial });
    }

    return () => {
      unsubscribe();
      unsubscribeDoc();
    };
  }, [initial]);

  const undo = () => {
    commandManager.undo();
  };

  const redo = () => {
    commandManager.redo();
  };

  const reset = (next: DocState) => {
    settingsStore.setState({ doc: next });
    commandManager.reset();
  };

  return {
    present: docState,
    canUndo,
    canRedo,
    undo,
    redo,
    reset,
  };
}


