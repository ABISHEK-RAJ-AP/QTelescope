import { FRIDGE_STAGES, clamp01, stageY } from './quantum-fridge-model.js';

export const SVG_CX = 250;
export const ELLIPSE_RATIO = 0.27;

export function loopProgress(seconds) {
  return 0.5 + 0.42 * Math.sin(seconds * 0.42);
}

export function cableX(cableIndex, stageIndex) {
  const lane = cableIndex % 14;
  const bank = Math.floor(cableIndex / 14);
  const spread = (lane - 6.5) * 7.2;
  const bow = Math.sin((stageIndex + bank * 0.65) * 1.2) * (4 + bank * 1.8);
  return SVG_CX + spread + bow;
}

export function cablePathD(cableIndex, ys) {
  const points = ys.map((y, stageIndex) => [cableX(cableIndex, stageIndex), y + 5]);
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const mid = (py + y) / 2;
    d += ` C ${px.toFixed(1)} ${mid.toFixed(1)}, ${x.toFixed(1)} ${mid.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

export function applySvgProgress(progress, refs) {
  const ys = FRIDGE_STAGES.map((_, index) => stageY(progress, index));
  refs.stageRefs.current.forEach((node, index) => {
    if (!node) return;
    const dy = ys[index] - FRIDGE_STAGES[index].assembledY;
    node.setAttribute('transform', `translate(0 ${dy.toFixed(2)})`);
  });
  refs.cableRefs.current.forEach((node, index) => {
    if (node) node.setAttribute('d', cablePathD(index, ys));
  });
  refs.rodRefs.current.forEach((node) => {
    if (node) node.setAttribute('y2', (ys.at(-1) + 16).toFixed(1));
  });
  const mixingDelta = ys.at(-1) - FRIDGE_STAGES.at(-1).assembledY;
  refs.shieldRef.current?.setAttribute('transform', `translate(0 ${mixingDelta.toFixed(2)})`);
  refs.glassRef.current?.setAttribute('transform', `translate(0 ${(ys[0] - FRIDGE_STAGES[0].assembledY) * 0.15})`);
  if (refs.qpuRef.current) {
    const glow = clamp01((progress - 0.78) / 0.18);
    refs.qpuRef.current.style.opacity = String(0.45 + glow * 0.55);
    refs.qpuGlowRef.current?.setAttribute('opacity', String(0.15 + glow * 0.5));
  }
}
