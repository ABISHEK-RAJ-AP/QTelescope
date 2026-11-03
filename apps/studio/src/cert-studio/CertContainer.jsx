export default function CertContainer({ children, narrow = false, className = '', style = {} }) {
  const maxW = narrow ? 900 : 1200;
  return (
    <div
      className={className}
      style={{
        width: '100%',
        maxWidth: maxW,
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: 'var(--space-6)',
        paddingRight: 'var(--space-6)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
