import { useCallback, useLayoutEffect, useRef } from "react";

/** Stable callback identity with the latest committed state; keeps memoized lists quiet. */
export function useEvent<Args extends unknown[], Result>(handler: (...args: Args) => Result): (...args: Args) => Result {
  const ref = useRef(handler);
  useLayoutEffect(() => { ref.current = handler; });
  return useCallback((...args: Args) => ref.current(...args), []);
}
