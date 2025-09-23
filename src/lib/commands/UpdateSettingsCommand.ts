import { Command, DocSettings } from '@/lib/types';
import { settingsStore } from '@/lib/settingsStore';

export class UpdateSettingsCommand implements Command {
  private oldSettings: DocSettings;
  private newSettings: DocSettings;

  constructor(oldSettings: DocSettings, newSettings: DocSettings) {
    this.oldSettings = oldSettings;
    this.newSettings = newSettings;
  }

  execute(): void {
    this.setSettings(this.newSettings);
  }

  undo(): void {
    this.setSettings(this.oldSettings);
  }

  private setSettings(settings: DocSettings): void {
    const currentDoc = settingsStore.getState().doc;
    if (currentDoc) {
      settingsStore.setState({ doc: { ...currentDoc, settings } });
    }
  }
}
