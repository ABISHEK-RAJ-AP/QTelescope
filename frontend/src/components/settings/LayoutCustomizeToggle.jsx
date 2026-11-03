import React from 'react';
import { Check, LayoutGrid, RotateCcw, Sparkles } from 'lucide-react';

export function LayoutCustomizeToggle({
  customizing = false,
  onToggle,
  onReset,
  onSmartLayout,
  smartLayoutHint,
  label = 'Customize layout',
}) {
  return (
    <div className="layout-customize-toggle">
      <button
        type="button"
        className={`btn btn-secondary layout-customize-toggle__btn${customizing ? ' is-active' : ''}`}
        onClick={onToggle}
        aria-pressed={customizing}
      >
        {customizing ? <Check size={15} aria-hidden /> : <LayoutGrid size={15} aria-hidden />}
        {customizing ? 'Done' : label}
      </button>
      {customizing && (
        <>
          {onSmartLayout && (
            <button
              type="button"
              className="btn btn-secondary layout-customize-toggle__smart"
              onClick={onSmartLayout}
              title={smartLayoutHint || 'Auto-fill row gaps and balance panel widths'}
            >
              <Sparkles size={14} aria-hidden />
              Smart fill
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary layout-customize-toggle__reset"
            onClick={onReset}
            title="Reset to default layout"
          >
            <RotateCcw size={14} aria-hidden />
            Reset
          </button>
        </>
      )}
    </div>
  );
}
