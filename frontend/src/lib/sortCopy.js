/** Immutable sort — `Array#toSorted` missing in some runtimes (Edge legacy). */
export function sortCopy(items, compareFn) {
  const copy = Array.isArray(items) ? [...items] : [...items];
  if (compareFn) copy.sort(compareFn);
  else copy.sort();
  return copy;
}

/** ponytail: one-time polyfill so existing `.toSorted()` call sites work in older browsers. */
function defineToSorted(Ctor) {
  if (typeof Ctor?.prototype?.toSorted === 'function') return;
  Object.defineProperty(Ctor.prototype, 'toSorted', {
    value(compareFn) {
      return [...this].sort(compareFn);
    },
    writable: true,
    configurable: true,
  });
}

export function installImmutableSortPolyfill() {
  defineToSorted(Array);
  defineToSorted(Set);
}