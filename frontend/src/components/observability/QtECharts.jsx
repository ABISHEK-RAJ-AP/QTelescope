import React, { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '../ui/ThemeProvider.jsx';
import { polishChartOption } from './chartTheme.js';

/** ECharts with legend/grid spacing tuned for accessibility font scale. */
export const QtECharts = React.forwardRef(function QtECharts({ option, isDark, legendPosition, ...rest }, ref) {
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
  return <ReactECharts ref={ref} option={polished} {...rest} />;
});
