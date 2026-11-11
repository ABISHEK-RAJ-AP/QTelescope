/** Page a list into fixed windows. `page` wraps. Size >= length returns one page. */
export function deckSlice(items, page, size = 4) {
  const list = Array.isArray(items) ? items : [];
  const windowSize = Math.max(1, size | 0);
  if (list.length <= windowSize) return { page: 0, pages: 1, items: list };
  const pages = Math.ceil(list.length / windowSize);
  const p = ((page % pages) + pages) % pages;
  return { page: p, pages, items: list.slice(p * windowSize, p * windowSize + windowSize) };
}
