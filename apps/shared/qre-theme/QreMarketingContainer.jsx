/** Cert Studio Container — shared max-width + header-aligned gutters. */
const LANDING_GUTTER = 'clamp(24px, 4vw, 56px)';

export default function QreMarketingContainer({ children, narrow = false, className = '', style = {} }) {
  const cls = ['qre-marketing-container', narrow ? 'qre-marketing-container--narrow' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      style={{
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: LANDING_GUTTER,
        paddingRight: LANDING_GUTTER,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
