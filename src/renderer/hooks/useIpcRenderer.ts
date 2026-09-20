import { useEffect, useRef } from 'react';
import type { ElectronAPI } from '@main/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export function useIpcRenderer(): ElectronAPI {
  return window.electronAPI;
}

type EventName = keyof ElectronAPI['on'];

export function useAgentEvent<K extends EventName>(
  eventName: K,
  callback: Parameters<ElectronAPI['on'][K]>[0]
): void {
  const ipc = useIpcRenderer();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = ((...args: unknown[]) => {
      (callbackRef.current as (...args: unknown[]) => void)(...args);
    }) as Parameters<ElectronAPI['on'][K]>[0];

    const cleanup = (ipc.on[eventName] as (cb: unknown) => () => void)(handler);
    return cleanup;
  }, [eventName, ipc]);
}
