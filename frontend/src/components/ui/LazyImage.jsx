import React, { useState } from 'react';

/** loading="lazy" + decode async — below-fold friendly without extra deps. */
export function LazyImage({ src, alt, className, width, height, ...rest }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return null;
  return (
    <img
      src={src}
      alt={alt || ''}
      className={className}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => setOk(false)}
      {...rest}
    />
  );
}
