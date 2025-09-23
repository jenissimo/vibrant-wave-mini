import React from 'react';

interface AssistantNoteProps {
  message: string;
  onDismiss: () => void;
}

const AssistantNote: React.FC<AssistantNoteProps> = ({ message, onDismiss }) => {
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-30 bg-background border border-border shadow px-3 py-2 rounded text-xs max-w-[80%] flex items-start gap-2">
      <div className="flex-1 text-foreground">{message}</div>
      <button 
        className="text-muted-foreground hover:text-foreground" 
        onClick={onDismiss} 
        aria-label="Dismiss note"
      >
        ×
      </button>
    </div>
  );
};

export default AssistantNote;
