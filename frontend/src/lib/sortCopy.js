/** Immutable sort — `Array#toSorted` / `Set#toSorted` are missing in some runtimes (Edge legacy). */
export function sortCopy(items, compareFn) {
  const copy = Array.isArray(items) ? [...items] : [...items];
  if (compareFn) copy.sort(compareFn);
  else copy.sort();
  return copy;
}