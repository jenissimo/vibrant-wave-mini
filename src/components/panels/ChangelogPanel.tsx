import React from 'react';
import BaseFloatingPanel from '@/components/panels/BaseFloatingPanel';

const CHANGELOG_PANEL_WIDTH = 400;

interface ChangelogEntry {
  date: string;
  changes: string[];
}

const changelog: ChangelogEntry[] = [
  {
    date: 'March 24, 2026',
    changes: [
      'Brush tool (B): freehand drawing with configurable color and stroke size',
      'Text tool (T): click to create, double-click to edit, Enter to confirm',
      'Draggable vertical toolbar on the left with tool selection and color/size controls',
      'Circle cursor for brush that reflects actual size and color',
      'Hotkeys: V/H/B/T for tools, [ ] to adjust brush size',
      'Drawing and text elements support selection, transform, undo/redo, copy/paste, and z-order',
      'Element settings panel shows type-specific controls (stroke, font size, color)',
      'Board export/import (.wv) updated for drawing and text elements',
      'Prompt history: last 10 prompts saved per board, accessible via clock icon in bottom bar',
      'Global prompt presets: save, rename, and delete reusable prompts across all boards',
      'Expanded editor sidebar with History and Presets tabs for full prompt management',
      'Multi-select: Shift/Ctrl+click to select multiple elements on canvas',
      'Marquee selection: drag on empty space to select elements with a rectangle',
      'Shift+click range select and Ctrl+click toggle in Layers panel',
      'Batch operations: delete, copy/paste, and arrow-key nudge for multiple elements',
      'Ctrl+A to select all, Escape to deselect',
      'Single undo/redo for batch operations (multi-delete, multi-drag, multi-paste)',
    ],
  },
  {
    date: 'March 22, 2026',
    changes: [
      'Added expanded prompt editor popup for long text editing',
      'Added board naming, inline rename with double-click',
      'Added delete confirmation for boards',
      'Active board is now protected from deletion',
      'New Board button in the Boards panel',
    ],
  },
  {
    date: 'January 30, 2026',
    changes: [
      'Updated dependencies',
      'Refactored proxy logic',
    ],
  },
  {
    date: 'January 3, 2026',
    changes: [
      'Added OIDC authentication support',
      'Configurable OIDC token endpoint auth method',
      'Improved login flow',
    ],
  },
  {
    date: 'January 1, 2026',
    changes: [
      'Added multi-board support with session management',
      'Board export/import in .wv format',
      'Accept all variants at once',
    ],
  },
  {
    date: 'October 15, 2025',
    changes: [
      'Added aspect ratio support for image generation',
    ],
  },
  {
    date: 'September 24, 2025',
    changes: [
      'Added undo/redo controls to canvas toolbar',
      'Refactored image handling and type safety',
      'Improved variant generation with robust retries',
      'Added download button to element settings',
      'Added image slicing and drag-n-drop support',
      'Added authentication',
    ],
  },
  {
    date: 'September 23, 2025',
    changes: [
      'First version released',
      'Canvas with layers and floating panels',
      'Zoom controls',
      'Theme switching (light/dark/system)',
    ],
  },
];

const ChangelogPanel: React.FC = () => {
  return (
    <BaseFloatingPanel
      title="Changelog"
      initialPosition={{ x: (typeof window !== 'undefined' ? window.innerWidth / 2 - CHANGELOG_PANEL_WIDTH / 2 : 0), y: 80 }}
      className="w-128"
      storageKey="changelog"
      panelWidth={CHANGELOG_PANEL_WIDTH}
    >
      <div className="overflow-auto space-y-4 px-2" style={{ minHeight: 128, maxHeight: 420 }}>
        {changelog.map((entry) => (
          <div key={entry.date}>
            <div className="text-xs font-semibold text-foreground mb-1">{entry.date}</div>
            <ul className="space-y-0.5">
              {entry.changes.map((change, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="shrink-0 mt-[3px] w-1 h-1 rounded-full bg-muted-foreground/50" />
                  {change}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </BaseFloatingPanel>
  );
};

export default ChangelogPanel;
