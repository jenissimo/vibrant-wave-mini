import React from 'react';

interface AssistantNoteProps {
  message: string;
  onDismiss: () => void;
}

const AssistantNote: React.FC<AssistantNoteProps> = ({ message, onDismiss }) => {
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-30 bg-background border border-border shadow px-3 py-2 rounded text-xs max-w-[80%] max-h-[30vh] flex items-start gap-2 overflow-hidden">
      <div className="flex-1 text-foreground overflow-y-auto max-h-full">{message}</div>
      <button 
        className="text-muted-foreground hover:text-foreground sticky top-0" 
        onClick={onDismiss} 
        aria-label="Dismiss note"
      >
        ×
      </button>
    </div>
  );
};

export default AssistantNote;
