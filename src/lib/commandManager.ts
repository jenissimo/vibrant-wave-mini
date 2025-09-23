import { Store } from '@/lib/store';
import { Command } from './types';

class CommandManager extends Store<{ undoStack: Command[]; redoStack: Command[] }> {
  constructor() {
    super({
      undoStack: [],
      redoStack: [],
    });
  }

  execute(command: Command) {
    command.execute();
    const state = this.getState();
    this.setState({
      undoStack: [...state.undoStack, command],
      redoStack: [], // Clear redo stack on new command
    });
  }

  undo() {
    const state = this.getState();
    const command = state.undoStack.pop();
    if (command) {
      command.undo();
      this.setState({
        undoStack: [...state.undoStack],
        redoStack: [...state.redoStack, command],
      });
    }
  }

  redo() {
    const state = this.getState();
    const command = state.redoStack.pop();
    if (command) {
      command.execute();
      this.setState({
        undoStack: [...state.undoStack, command],
        redoStack: [...state.redoStack],
      });
    }
  }

  canUndo(): boolean {
    return this.getState().undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.getState().redoStack.length > 0;
  }

  reset() {
    this.setState({
      undoStack: [],
      redoStack: [],
    });
  }
}

export const commandManager = new CommandManager();
