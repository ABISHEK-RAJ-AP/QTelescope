"use client";

import { useEffect, useRef, type ReactNode } from "react";

const RING_COUNT = 6;
const Z_NEAR = 0.72;
const Z_FAR = 2.85;
const WORLD_R = 0.88;
const WORLD_GLYPH = 0.13;
const MIN_FONT_PX = 10;
const RING_PAD_PX = 40;
const CHAR_GAP_RATIO = 0.22;
const OMEGA_NEAR = 0.46;
const OMEGA_FAR = 0.09;
const STATIC_TIME = 2.2;
const MOTE_COUNT = 36;
const CONTENT_FEATHER_PX = 72;
const MAX_CHARS_PER_RING = 96;
const DT_MAX = 0.05;

export interface TextRingFunnelProps {
  ringText?: string;
  children?: ReactNode;
  className?: string;
}

export function TextRingFunnel({
  ringText = "Q-TELESCOPE — LIVE TELEMETRY — T1 · T2 · FIDELITY — ",
  children,
  className = "",
}: TextRingFunnelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fgColor = "";
    let mutedColor = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fgColor =
        cs.getPropertyValue("--foreground").trim()
        || cs.getPropertyValue("--text-primary").trim()
        || "#0f172a";
      mutedColor =
        cs.getPropertyValue("--ns-muted").trim()
        || cs.getPropertyValue("--text-muted").trim()
        || "#64748b";
    };

    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;
    let rootW = 0;
    let rootH = 0;
    let cx = 0;
    let cy = 0;
    let K1 = 0;

    type CharItem = { angle: number; ch: string };
    type Ring = {
      z: number;
      omega: number;
      angle: number;
      radiusPx: number;
      fontPx: number;
      color: string;
      alpha: number;
      layout: CharItem[];
    };
    let rings: Ring[] = [];

    type Mote = { ringGap: number; theta: number; drift: number; r: number };
    const motes: Mote[] = [];
    for (let i = 0; i < MOTE_COUNT; i++) {
      motes.push({
        ringGap: Math.random() * (RING_COUNT - 1),
        theta: Math.random() * Math.PI * 2,
        drift: 0.04 + Math.random() * 0.08,
        r: 0.6 + Math.random() * 1.1,
      });
    }

    const content = contentRef.current;
    const hasContent = !!content;
    let contentRadiusPx = 0;
    const measureContent = () => {
      if (!content) return;
      const r = content.getBoundingClientRect();
      contentRadiusPx = Math.sqrt((r.width / 2) ** 2 + (r.height / 2) ** 2);
    };
    measureContent();
    const contentRO = content ? new ResizeObserver(measureContent) : null;
    if (content) contentRO?.observe(content);

    const measureCache = new Map<string, number>();
    const measureChar = (
      offCtx: CanvasRenderingContext2D,
      ch: string,
      fontPx: number,
      fontFamily: string,
    ) => {
      const key = `${fontPx}|${ch}`;
      const cached = measureCache.get(key);
      if (cached !== undefined) return cached;
      offCtx.font = `500 ${fontPx}px ${fontFamily}`;
      const w = Math.max(1, offCtx.measureText(ch).width);
      measureCache.set(key, w);
      return w;
    };

    const buildLayout = (
      offCtx: CanvasRenderingContext2D,
      radiusPx: number,
      fontPx: number,
      fontFamily: string,
    ) => {
      const layout: CharItem[] = [];
      const text = ringText.length ? ringText : " ";
      const full = Math.PI * 2;
      let angle = 0;
      let i = 0;
      const gapPx = Math.max(2, fontPx * CHAR_GAP_RATIO);
      while (angle < full && layout.length < MAX_CHARS_PER_RING) {
        const ch = text[i % text.length];
        i++;
        if (ch === " ") continue;
        const w = measureChar(offCtx, ch, fontPx, fontFamily);
        const charAngle = (w + gapPx) / radiusPx;
        layout.push({ angle: angle + charAngle / 2, ch });
        angle += charAngle;
      }
      return layout;
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      rootW = width;
      rootH = height;
      cx = width / 2;
      cy = height / 2;
      const half = Math.min(width, height) / 2 - RING_PAD_PX;
      // Nearest ring is largest; keep full circle + glyph inside viewport
      K1 = Math.max(40, half * Z_NEAR / WORLD_R);

      const off = document.createElement("canvas");
      const offCtx = off.getContext("2d");
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCache.clear();

      const next: Ring[] = [];
      for (let i = 0; i < RING_COUNT; i++) {
        const z = Z_NEAR + (i * (Z_FAR - Z_NEAR)) / (RING_COUNT - 1);
        const ooz = 1 / z;
        const fontPx = Math.max(MIN_FONT_PX, K1 * ooz * WORLD_GLYPH);
        let radiusPx = K1 * ooz * WORLD_R;
        const maxR = half - fontPx * 0.85;
        if (radiusPx > maxR) radiusPx = maxR;
        radiusPx = Math.max(fontPx * 2.8, radiusPx);
        const depthT = i / (RING_COUNT - 1);
        const far = depthT >= 0.5;
        const layout = offCtx
          ? buildLayout(offCtx, radiusPx, fontPx, fontFamily)
          : [];
        const prevAngle = rings[i]?.angle ?? Math.random() * Math.PI * 2;
        next.push({
          z,
          omega: OMEGA_NEAR + (OMEGA_FAR - OMEGA_NEAR) * depthT,
          angle: prevAngle,
          radiusPx,
          fontPx,
          color: far ? mutedColor : fgColor,
          alpha: far ? 0.85 - (depthT - 0.5) * 0.9 : 1 - depthT * 0.35,
          layout,
        });
      }
      rings = next;
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw();
      }, 150);
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, rootW, rootH);

      ctx.fillStyle = mutedColor;
      for (const m of motes) {
        const lo = Math.floor(m.ringGap);
        const hi = Math.min(RING_COUNT - 1, lo + 1);
        const t = m.ringGap - lo;
        const rr =
          rings[lo] && rings[hi]
            ? rings[lo].radiusPx + (rings[hi].radiusPx - rings[lo].radiusPx) * t
            : 0;
        if (!rr) continue;
        const theta = m.theta;
        const x = cx + Math.cos(theta) * rr;
        const y = cy + Math.sin(theta) * rr;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(x, y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        if (!ring.layout.length) continue;

        let alpha = ring.alpha;
        if (hasContent && contentRadiusPx > 0) {
          const d = ring.radiusPx - contentRadiusPx;
          if (d < -CONTENT_FEATHER_PX) continue;
          if (d < CONTENT_FEATHER_PX) {
            const t = Math.min(
              1,
              Math.max(0, (d + CONTENT_FEATHER_PX) / (2 * CONTENT_FEATHER_PX)),
            );
            alpha *= t * t * (3 - 2 * t);
          }
        }
        if (alpha <= 0.02) continue;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ring.angle);
        ctx.font = `500 ${ring.fontPx}px ${getComputedStyle(canvas).fontFamily}`;
        if ("letterSpacing" in ctx) {
          (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.max(0.5, ring.fontPx * 0.06)}px`;
        }
        ctx.fillStyle = ring.color;
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const item of ring.layout) {
          ctx.save();
          ctx.rotate(item.angle);
          ctx.translate(0, -ring.radiusPx);
          ctx.rotate(Math.PI / 2);
          ctx.fillText(item.ch, 0, 0);
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let last = 0;

    const placeContent = () => {
      const el = contentRef.current;
      if (!el) return;
      el.style.transform = "translate(-50%, -50%)";
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      for (const ring of rings) ring.angle += ring.omega * dt;
      for (const m of motes) {
        m.theta += m.drift * dt;
        m.ringGap += dt * 0.12;
        if (m.ringGap > RING_COUNT - 1) m.ringGap -= RING_COUNT - 1;
      }
      draw();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        if (visible && !document.hidden && !reduced && ready && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        } else if (!visible && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 },
    );
    io.observe(root);

    const onVis = () => {
      if (!document.hidden && !reduced && ready && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      } else if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      resize();
      if (reduced) draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const ro = new ResizeObserver(() => onResize());
    ro.observe(root);

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      ready = true;
      placeContent();
      if (reduced) {
        for (const ring of rings) ring.angle += ring.omega * STATIC_TIME;
        draw();
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      io.disconnect();
      ro.disconnect();
      contentRO?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ringText]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full w-full overflow-visible bg-transparent ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 block h-full w-full pointer-events-none"
      />
      <span className="sr-only">{ringText.trim()}</span>
      {children ? (
        <div
          ref={contentRef}
          className="pointer-events-auto absolute left-1/2 top-1/2 z-10 flex w-full max-w-2xl flex-col items-center gap-4 px-6 text-center"
          style={{ transform: "translate(-50%, -50%)" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default TextRingFunnel;
