/** True only if a WebGL context can actually be created (not just API present). */
export function canCreateWebGLContext() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const attrs = {
      alpha: true,
      antialias: false,
      depth: true,
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'default',
    };
    const gl =
      canvas.getContext('webgl2', attrs)
      || canvas.getContext('webgl', attrs)
      || canvas.getContext('experimental-webgl', attrs);
    if (!gl) return false;
    gl.getParameter(gl.VERSION);
    const ext = gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
    return true;
  } catch {
    return false;
  }
}
