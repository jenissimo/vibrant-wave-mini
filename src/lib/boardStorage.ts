import type { DocState } from './types';

const DB_NAME = 'vibrant-wave-boards';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const CHANNEL_NAME = 'vibrant-wave-sessions';

export interface SessionData {
  sessionId: string;
  docState: DocState;
  updatedAt: number;
  createdAt: number;
}

export interface SessionMetadata {
  sessionId: string;
  updatedAt: number;
  createdAt: number;
  elementCount: number;
}

let dbInstance: IDBDatabase | null = null;

// Initialize IndexedDB
async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

// Generate unique session ID
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Save session to IndexedDB
export async function saveSession(sessionId: string, docState: DocState): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Check if session exists
    const existingRequest = store.get(sessionId);
    const existing = await new Promise<SessionData | undefined>((resolve) => {
      existingRequest.onsuccess = () => resolve(existingRequest.result);
      existingRequest.onerror = () => resolve(undefined);
    });

    const now = Date.now();
    const sessionData: SessionData = {
      sessionId,
      docState,
      updatedAt: now,
      createdAt: existing?.createdAt || now,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(sessionData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save session:', error);
    throw error;
  }
}

// Load session from IndexedDB
export async function loadSession(sessionId: string): Promise<SessionData | null> {
  if (typeof window === 'undefined') return null;

  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }
}

// Get last session (by updatedAt timestamp)
export async function getLastSession(): Promise<SessionData | null> {
  if (typeof window === 'undefined') return null;

  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('updatedAt');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, 'prev'); // prev = descending order
      let lastSession: SessionData | null = null;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          lastSession = cursor.value;
          cursor.continue();
        } else {
          resolve(lastSession);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get last session:', error);
    return null;
  }
}

// Get all sessions with metadata
export async function getAllSessions(): Promise<SessionMetadata[]> {
  if (typeof window === 'undefined') return [];

  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const sessions = (request.result as SessionData[]).map((session) => ({
          sessionId: session.sessionId,
          updatedAt: session.updatedAt,
          createdAt: session.createdAt,
          elementCount: session.docState.elements.length,
        }));
        // Sort by updatedAt descending (most recent first)
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get all sessions:', error);
    return [];
  }
}

// Delete session from IndexedDB
export async function deleteSession(sessionId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(sessionId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete session:', error);
    throw error;
  }
}

// BroadcastChannel helpers
export type ChannelMessage = 
  | { type: 'ping'; sessionId: string }
  | { type: 'pong'; sessionId: string }
  | { type: 'heartbeat'; sessionId: string }
  | { type: 'session-closed'; sessionId: string };

let channelInstance: BroadcastChannel | null = null;

// Initialize BroadcastChannel
export function initializeChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (channelInstance) return channelInstance;

  try {
    channelInstance = new BroadcastChannel(CHANNEL_NAME);
    return channelInstance;
  } catch (error) {
    console.error('Failed to initialize BroadcastChannel:', error);
    return null;
  }
}

// Check for active tabs (returns true if active tabs found)
export function checkActiveTabs(channel: BroadcastChannel | null, currentSessionId: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!channel) {
      resolve(false);
      return;
    }

    let hasResponse = false;
    const handler = (event: MessageEvent<ChannelMessage>) => {
      const msg = event.data;
      // Ignore our own messages
      if (msg.sessionId === currentSessionId) return;

      if (msg.type === 'ping') {
        // Respond to ping
        channel.postMessage({ type: 'pong', sessionId: currentSessionId });
      } else if (msg.type === 'pong' || msg.type === 'heartbeat') {
        // Found active tab
        if (!hasResponse) {
          hasResponse = true;
          clearTimeout(timeout);
          channel.removeEventListener('message', handler);
          resolve(true);
        }
      }
    };

    channel.addEventListener('message', handler);
    
    const timeout = setTimeout(() => {
      if (!hasResponse) {
        channel.removeEventListener('message', handler);
        resolve(false);
      }
    }, 500); // Wait 500ms for responses
    
    // Send ping
    channel.postMessage({ type: 'ping', sessionId: currentSessionId });
  });
}

// Start heartbeat (returns cleanup function)
export function startHeartbeat(channel: BroadcastChannel | null, sessionId: string): () => void {
  if (!channel) return () => {};

  let intervalId: number | null = null;

  // Send initial heartbeat
  channel.postMessage({ type: 'heartbeat', sessionId });

  // Set up interval (every 2-3 seconds)
  intervalId = window.setInterval(() => {
    channel.postMessage({ type: 'heartbeat', sessionId });
  }, 2500);

  // Cleanup function
  return () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    // Send session-closed message
    channel.postMessage({ type: 'session-closed', sessionId });
  };
}

