import { useCallback, useRef } from 'react';
import type { ViewInstance } from 'react-native';
import type { TriggerRect } from '../types';

const ZERO_RECT: TriggerRect = { x: 0, y: 0, width: 0, height: 0 };

/**
 * Wraps measureInWindow with a small retry path for the known Android case
 * where the first measurement returns zero (often fixed by collapsable={false}
 * on the measured native view).
 */
export function useMeasureTrigger(): {
  ref: React.MutableRefObject<ViewInstance | null>;
  measure: () => Promise<TriggerRect>;
} {
  const ref = useRef<ViewInstance | null>(null);

  const measure = useCallback((): Promise<TriggerRect> => {
    return new Promise((resolve) => {
      const node = ref.current;
      if (!node || typeof node.measureInWindow !== 'function') {
        resolve(ZERO_RECT);
        return;
      }

      let settled = false;
      const settle = (rect: TriggerRect) => {
        if (settled) return;
        settled = true;
        resolve(rect);
      };

      const attempt = (retriesLeft: number) => {
        node.measureInWindow((x: number, y: number, width: number, height: number) => {
          const ok =
            typeof x === 'number' &&
            typeof y === 'number' &&
            (width > 0 || height > 0);
          if (ok || retriesLeft <= 0) {
            settle({ x: x ?? 0, y: y ?? 0, width: width ?? 0, height: height ?? 0 });
            return;
          }
          setTimeout(() => attempt(retriesLeft - 1), 16);
        });
      };

      attempt(2);

      // Safety fallback: if the native callback never fires (e.g. in test
      // environments where the host view's measureInWindow is a no-op), resolve
      // to a zero rect so the caller is not blocked indefinitely.
      setTimeout(() => settle(ZERO_RECT), 100);
    });
  }, []);

  return { ref, measure };
}
