import { Command } from '@/lib/types';

export class CompositeCommand implements Command {
  constructor(private commands: Command[]) {}
  execute() { this.commands.forEach(cmd => cmd.execute()); }
  undo() { [...this.commands].reverse().forEach(cmd => cmd.undo()); }
}
