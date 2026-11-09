import { useEffect, useState } from 'react';

/** Debounce controlled values (search, filters). Default 280ms. */
export function useDebouncedValue(value, delayMs = 280) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
