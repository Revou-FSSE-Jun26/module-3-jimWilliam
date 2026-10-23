"use client";

import { useEffect, useEffectEvent, useState } from "react";

/**
 * Load data that needs the signed-in user's token (orders, profiles) - it can only be fetched in
 * the browser, where the token lives. Pass `key: null` until there is something to load (e.g.
 * while the session is still being read); a new key loads again.
 *
 * Returns the data for the current key (null while loading) or the error, so each page decides
 * what a 404 or 403 looks like; anything else it can rethrow to its error.tsx boundary.
 */
export function useApiData<T>(key: string | null, load: () => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: unknown }>({ key: null });
  const run = useEffectEvent(load);

  useEffect(() => {
    if (key === null) return;
    let live = true;
    run().then(
      (data) => live && setState({ key, data }),
      (error: unknown) => live && setState({ key, error })
    );
    return () => {
      live = false;
    };
  }, [key]);

  const current = state.key === key;
  return {
    data: current ? (state.data ?? null) : null,
    error: current ? state.error : undefined,
    /** replace the loaded data after a local change (e.g. an order's new status) */
    setData: (data: T) => setState({ key, data }),
  };
}
