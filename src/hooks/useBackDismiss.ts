import { useEffect, useRef } from 'react';
import { pushSub } from '../utils/navStack';

/**
 * Makes the browser Back button dismiss an open overlay (modal, detail panel)
 * instead of navigating away. While `open` is true, a dismissible history entry
 * is held; pressing Back pops it and calls `onClose`. Closing the overlay by any
 * other means consumes that entry so history stays balanced.
 */
export function useBackDismiss(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    return pushSub(() => onCloseRef.current());
  }, [open]);
}
