/**
 * Local diagram library, backed by IndexedDB.
 *
 * This replaces the "Save diagram" flow that previously handed the diagram to
 * mermaid.ai. IndexedDB rather than localStorage because a saved library is
 * structured records, not one blob: localStorage caps out around 5MB across the
 * whole origin (which the editor already uses for state and history), stores
 * strings only, and is synchronous — it would block the editor on every save.
 *
 * Everything stays on the user's machine, so no diagram leaves the browser.
 * Sharing across devices would need a server; the URL hash remains the way to
 * share a single diagram.
 */

import type { State } from '$/types';

const DB_NAME = 'mermaid-diagrams';
const DB_VERSION = 1;
const STORE = 'diagrams';

export interface SavedDiagram {
  code: string;
  /** Mermaid config JSON, so a reload restores theme and settings too. */
  config: string;
  createdAt: number;
  /** Starred diagrams sort to the top of the dashboard. */
  favorite?: boolean;
  id: string;
  name: string;
  updatedAt: number;
}

/**
 * Fields we persist from the editor state. Manual layout is not among them:
 * it lives inside `code` as a `%%` comment, so it travels with the diagram
 * for free and cannot drift out of sync with it.
 */
export type DiagramDraft = Pick<State, 'code' | 'mermaid'>;

/** The stored fields, in the shape the editor state expects them back. */
export const draftOf = (diagram: SavedDiagram): DiagramDraft => ({
  code: diagram.code,
  mermaid: diagram.config
});

let connection: Promise<IDBDatabase> | undefined;

const open = (): Promise<IDBDatabase> => {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        // Sorting the library by recency is the only query we need.
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the diagram store.'));
  });
  return connection;
};

/** Wraps a transaction in a promise, since IndexedDB is callback-based. */
const run = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Diagram store request failed.'));
  });
};

export const listDiagrams = async (): Promise<SavedDiagram[]> => {
  const all = await run<SavedDiagram[]>('readonly', (store) => store.getAll());
  // Favourites first, then most recently edited.
  return all.sort(
    (a, b) => Number(b.favorite ?? false) - Number(a.favorite ?? false) || b.updatedAt - a.updatedAt
  );
};

export const getDiagram = (id: string): Promise<SavedDiagram | undefined> =>
  run<SavedDiagram | undefined>('readonly', (store) => store.get(id));

/**
 * Creates a new saved diagram. Returns the record so callers can track the id
 * and switch into "update this one" mode.
 */
export const saveDiagram = async (name: string, draft: DiagramDraft): Promise<SavedDiagram> => {
  const now = Date.now();
  const record: SavedDiagram = {
    code: draft.code,
    config: draft.mermaid,
    createdAt: now,
    id: crypto.randomUUID(),
    name: name.trim() || 'Untitled diagram',
    updatedAt: now
  };
  await run('readwrite', (store) => store.add(record));
  return record;
};

/** Overwrites an existing diagram, preserving its creation time. */
export const updateDiagram = async (
  id: string,
  patch: Partial<Pick<SavedDiagram, 'code' | 'config' | 'favorite' | 'name'>>
): Promise<SavedDiagram | undefined> => {
  const existing = await getDiagram(id);
  if (!existing) {
    return undefined;
  }
  const record: SavedDiagram = { ...existing, ...patch, updatedAt: Date.now() };
  await run('readwrite', (store) => store.put(record));
  return record;
};

/** Copies a diagram under a new name, leaving the original untouched. */
export const duplicateDiagram = async (id: string): Promise<SavedDiagram | undefined> => {
  const existing = await getDiagram(id);
  if (!existing) {
    return undefined;
  }
  return saveDiagram(`${existing.name} copy`, draftOf(existing));
};

/** Toggles the star used to sort a diagram to the top of the dashboard. */
export const toggleFavorite = async (id: string): Promise<SavedDiagram | undefined> => {
  const existing = await getDiagram(id);
  return existing ? updateDiagram(id, { favorite: !existing.favorite }) : undefined;
};

export const deleteDiagram = (id: string): Promise<undefined> =>
  run<undefined>('readwrite', (store) => store.delete(id));

/** True when IndexedDB is usable (it is absent in some private modes). */
export const isStorageAvailable = (): boolean =>
  typeof indexedDB !== 'undefined' && indexedDB !== null;
