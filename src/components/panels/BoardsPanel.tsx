import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderKanban, Trash2, Loader2 } from 'lucide-react';
import BaseFloatingPanel from '@/components/panels/BaseFloatingPanel';
import { getAllSessions, deleteSession, type SessionMetadata } from '@/lib/boardStorage';

const BOARDS_PANEL_WIDTH = 384;
const BOARDS_LIST_MIN_HEIGHT = 128;
const BOARDS_LIST_MAX_HEIGHT = 384;

interface BoardsPanelProps {
  onLoadBoard: (sessionId: string) => void;
  currentSessionId?: string | null;
}

const BoardsPanel: React.FC<BoardsPanelProps> = ({ onLoadBoard, currentSessionId }) => {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = React.useCallback(async () => {
    try {
      setLoading(true);
      const allSessions = await getAllSessions();
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSession(sessionId);
      await loadSessions(); // Reload list
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <BaseFloatingPanel
      title="Boards"
      initialPosition={{ x: (typeof window !== 'undefined' ? window.innerWidth - (BOARDS_PANEL_WIDTH + 88) : 0), y: 140 }}
      className="w-128"
      storageKey="boards"
      panelWidth={BOARDS_PANEL_WIDTH}
    >
      <div className="space-y-1 overflow-auto" style={{ minHeight: BOARDS_LIST_MIN_HEIGHT, maxHeight: BOARDS_LIST_MAX_HEIGHT }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No boards saved</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.sessionId}
              className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer ${
                currentSessionId === session.sessionId ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
              onClick={() => onLoadBoard(session.sessionId)}
            >
              <div className="w-8 h-8 rounded border bg-muted flex items-center justify-center">
                <FolderKanban className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-foreground truncate">
                  {session.sessionId.slice(0, 20)}...
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatDate(session.updatedAt)} · {session.elementCount} element{session.elementCount !== 1 ? 's' : ''}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title="Delete"
                onClick={(e) => handleDelete(session.sessionId, e)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </BaseFloatingPanel>
  );
};

export default BoardsPanel;

