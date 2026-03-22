import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FolderKanban, Trash2, Loader2, Plus } from 'lucide-react';
import BaseFloatingPanel from '@/components/panels/BaseFloatingPanel';
import { getAllSessions, deleteSession, renameSession, type SessionMetadata } from '@/lib/boardStorage';

const BOARDS_PANEL_WIDTH = 384;
const BOARDS_LIST_MIN_HEIGHT = 128;
const BOARDS_LIST_MAX_HEIGHT = 384;

interface BoardsPanelProps {
  onLoadBoard: (sessionId: string) => void;
  onCreateBoard: () => void;
  currentSessionId?: string | null;
}

const BoardsPanel: React.FC<BoardsPanelProps> = ({ onLoadBoard, onCreateBoard, currentSessionId }) => {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const session = sessions.find(s => s.sessionId === sessionId);
    const boardName = session?.name || 'Untitled Board';
    if (!window.confirm(`Delete "${boardName}"? This cannot be undone.`)) return;
    try {
      await deleteSession(sessionId);
      await loadSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const startEditing = (session: SessionMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.sessionId);
    setEditingName(session.name || 'Untitled Board');
  };

  const commitRename = async () => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (trimmed) {
      try {
        await renameSession(editingId, trimmed);
        await loadSessions();
      } catch (error) {
        console.error('Failed to rename session:', error);
      }
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
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
      <div className="px-2 pb-1">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={onCreateBoard}
        >
          <Plus className="w-3.5 h-3.5" />
          New Board
        </Button>
      </div>
      <div className="space-y-1 overflow-auto" style={{ minHeight: BOARDS_LIST_MIN_HEIGHT, maxHeight: BOARDS_LIST_MAX_HEIGHT }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No boards saved</div>
        ) : (
          sessions.map((session) => {
            const isActive = currentSessionId === session.sessionId;
            const isEditing = editingId === session.sessionId;

            return (
              <div
                key={session.sessionId}
                className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer ${
                  isActive ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
                onClick={() => onLoadBoard(session.sessionId)}
              >
                <div className="w-8 h-8 rounded border bg-muted flex items-center justify-center shrink-0">
                  <FolderKanban className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      className="text-xs text-foreground bg-background border border-border rounded px-1 py-0.5 w-full outline-none focus:ring-1 focus:ring-ring"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      onBlur={commitRename}
                    />
                  ) : (
                    <div
                      className="text-xs text-foreground truncate"
                      onDoubleClick={(e) => startEditing(session, e)}
                    >
                      {session.name || 'Untitled Board'}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {formatDate(session.updatedAt)} · {session.elementCount} element{session.elementCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 shrink-0 ${isActive ? 'opacity-30 cursor-not-allowed' : ''}`}
                  title={isActive ? 'Cannot delete active board' : 'Delete'}
                  disabled={isActive}
                  onClick={(e) => handleDelete(session.sessionId, e)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </BaseFloatingPanel>
  );
};

export default BoardsPanel;
