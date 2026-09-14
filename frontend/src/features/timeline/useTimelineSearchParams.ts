import { useCallback, useRef } from "react";
import { createSearchParams, useSearchParams, type SetURLSearchParams } from "react-router";

// React Router's functional search-param updates do not queue like setState.
// Retain the latest requested value so rapid changes to two date inputs do not
// restore the previous value of the other filter before the next render.
export function useTimelineSearchParams() {
  const [params, setParams] = useSearchParams();
  const current = useRef(params);
  current.current = params;
  const update: SetURLSearchParams = useCallback((next, options) => {
    current.current = createSearchParams(typeof next === "function" ? next(current.current) : next);
    setParams(current.current, options);
  }, [setParams]);
  return [params, update] as const;
}
