// Centralized browser-history coordination.
//
// The app is a single page with state-driven views (no router), plus overlays
// (modals, glossary detail) and a multi-step creation wizard. We mirror all of
// that into the History API through ONE popstate listener so that Back/Forward:
//   1. closes the topmost open overlay, if any, else
//   2. steps the wizard back one step, if active, else
//   3. navigates between top-level views (home / characters / sheet / glossary).
//
// History entries carry `{ loc, _depth }`. A top-level view sits at `_depth: 0`.
// Each overlay or wizard step pushes a "sub" entry whose depth is its position
// in the sub-stack. On Back we pop sub-entries down to the target entry's depth,
// invoking each one's handler (close overlay / step back); once the sub-stack is
// empty we hand the remaining navigation to the registered view-restore handler.

type SubHandler = () => void;

interface SubEntry {
  handler: SubHandler;
  removed: boolean;
}

interface HistoryState {
  loc?: unknown;
  _depth?: number;
}

const subStack: SubEntry[] = [];
// Number of programmatic `history.back()` calls whose popstate we must ignore
// (used to balance history when an overlay closes by means other than Back).
let suppress = 0;
let viewRestore: ((loc: unknown) => void) | null = null;

function currentLoc(): unknown {
  const s = (window.history.state ?? {}) as HistoryState;
  return s.loc;
}

function onPopState(e: PopStateEvent) {
  if (suppress > 0) {
    suppress--;
    return;
  }
  const state = (e.state ?? {}) as HistoryState;
  const targetDepth = typeof state._depth === 'number' ? state._depth : 0;

  // Close overlays / step the wizard back down to the target depth.
  while (subStack.length > targetDepth) {
    const entry = subStack.pop()!;
    entry.removed = true;
    try {
      entry.handler();
    } catch (err) {
      console.error('navStack sub-handler failed:', err);
    }
  }

  // Back at the base level → let the app restore the top-level view.
  if (subStack.length === 0 && viewRestore) {
    viewRestore(state.loc);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', onPopState);
}

/** Register how the app restores a top-level view from a popped history entry. */
export function setViewRestoreHandler(fn: (loc: unknown) => void): void {
  viewRestore = fn;
}

/** Anchor the current history entry to a view (used once on initial load). */
export function replaceView(loc: unknown, url?: string): void {
  subStack.length = 0;
  window.history.replaceState({ loc, _depth: 0 }, '', url);
}

/** Push a new top-level view entry, discarding any open overlays/steps. */
export function pushView(loc: unknown, url?: string): void {
  subStack.length = 0;
  window.history.pushState({ loc, _depth: 0 }, '', url);
}

/**
 * Push a dismissible sub-state (overlay or wizard step). `handler` runs when the
 * user navigates Back to dismiss it. The returned function unregisters the
 * sub-state when it is closed by other means (e.g. an X button), keeping the
 * history balanced. Assumes last-in-first-out close order.
 */
export function pushSub(handler: SubHandler): () => void {
  const entry: SubEntry = { handler, removed: false };
  subStack.push(entry);
  window.history.pushState({ loc: currentLoc(), _depth: subStack.length }, '', window.location.href);

  return () => {
    if (entry.removed) return; // already dismissed via Back
    const idx = subStack.indexOf(entry);
    if (idx === -1) return;
    subStack.splice(idx, 1);
    // Consume the matching history entry without triggering the handler again.
    suppress++;
    window.history.back();
  };
}
