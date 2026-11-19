/**
 * Default passive touch listeners (Chrome scroll-blocking violation noise).
 * Does not force passive on wheel — ECharts may need preventDefault for zoom.
 */
if (typeof window !== 'undefined' && typeof EventTarget !== 'undefined') {
  const passiveTypes = new Set(['touchstart', 'touchmove']);
  const native = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function patchedAdd(type, listener, options) {
    if (!passiveTypes.has(type)) {
      return native.call(this, type, listener, options);
    }
    if (options === undefined) {
      return native.call(this, type, listener, { passive: true });
    }
    if (options === true) {
      return native.call(this, type, listener, { capture: true, passive: true });
    }
    if (options === false) {
      return native.call(this, type, listener, { passive: true });
    }
    if (typeof options === 'object' && options.passive === undefined) {
      return native.call(this, type, listener, { ...options, passive: true });
    }
    return native.call(this, type, listener, options);
  };
}