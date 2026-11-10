import React, { Suspense, useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    const bump = () => setA11yRev((n) => n + 1);
    window.addEventListener('qtelescope-a11y-changed', bump);
    return () => window.removeEventListener('qtelescope-a11y-changed', bump);
  }, []);

  const polished = useMemo(
    () => polishChartOption(option, dark, legendPosition ? { legendPosition } : undefined),
    [option, dark, legendPosition, a11yRev],
  );

  return (
    <Suspense fallback={<ChartSkeleton height={style?.height} className={className} />}>
      <LazyReactECharts ref={ref} option={polished} style={style} className={className} {...rest} />
    </Suspense>
  );
});
