import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../ui/ThemeProvider.jsx';
import { polishChartOption } from './chartTheme.js';

/** Lazy-loaded ECharts — keeps ~1.1MB off the initial app chunk until a chart mounts. */
const LazyReactECharts = React.lazy(() => import('echarts-for-react'));

function ChartSkeleton({ height, className }) {
  const h = typeof height === 'number' ? `${height}px` : height;
  return (
    <div
      className={className}
      role="status"
      aria-label="Loading chart"
      style={{
        height: h || 240,
        minHeight: 120,
        borderRadius: 8,
        background: 'var(--bg-card-hover)',
        border: '1px solid var(--border-color)',
      }}
    />
  );
}

/** ECharts with legend/grid spacing tuned for accessibility font scale. */
export const QtECharts = React.forwardRef(function QtECharts({ option, isDark, legendPosition, style, className, ...rest }, ref) {
  const { resolved } = useTheme();
  const dark = isDark ?? resolved === 'dark';
  const [a11yRev, setA11yRev] = useState(0);
  const [chartPainted, setChartPainted] = useState(false);
  const finishedRef = useRef(false);
  const instanceRef = useRef(null);

  useEffect(() => () => {
    try {
      instanceRef.current?.dispose?.();
    } catch {
      /* ignore */
    }
    instanceRef.current = null;
  }, []);

  useEffect(() => {
    const bump = () => setA11yRev((n) => n + 1);
    window.addEventListener('qtelescope-a11y-changed', bump);
    return () => window.removeEventListener('qtelescope-a11y-changed', bump);
  }, []);

  useEffect(() => {
    finishedRef.current = false;
    setChartPainted(false);
  }, [option, dark, legendPosition, a11yRev]);

  const polished = useMemo(
    () => polishChartOption(option, dark, legendPosition ? { legendPosition } : undefined),
    [option, dark, legendPosition, a11yRev],
  );

  const onChartReady = (instance) => {
    if (!instance) return;
    instanceRef.current = instance;
    if (finishedRef.current) return;
    const mark = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setChartPainted(true);
    };
    instance.on('finished', mark);
    requestAnimationFrame(() => {
      try {
        if (instance.getWidth() > 0 && instance.getHeight() > 0) mark();
      } catch {
        /* ignore */
      }
    });
  };

  return (
    <div
      className="qt-echart-shell"
      data-qt-echart-pending={chartPainted ? 'false' : 'true'}
      style={{ width: style?.width, height: style?.height, minHeight: style?.minHeight }}
    >
      <Suspense fallback={<ChartSkeleton height={style?.height} className={className} />}>
        <LazyReactECharts
          ref={ref}
          option={polished}
          style={{ ...style, width: '100%', height: '100%' }}
          className={className}
          onChartReady={onChartReady}
          {...rest}
        />
      </Suspense>
    </div>
  );
});
