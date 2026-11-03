import GovernPageShell from '../components/GovernPageShell.jsx';

export default function ModulePlaceholder({ title, phase, description, docHint }) {
  return (
    <GovernPageShell eyebrow="Govern" title={title} subtitle={description}>
      <div className="qre-card qre-module-placeholder">
        {phase && <p className="qre-module-placeholder__phase">{phase}</p>}
        <p className="govern-muted">
          {docHint?.includes('OD-QRP-02')
            ? 'Programme decision OD-QRP-02 keeps this module off the Govern surface until charter approval. No placeholder metrics are shown.'
            : 'This capability is on the QRP roadmap. No metrics or actions appear until backend contracts and tests exist.'}
        </p>
        {docHint && (
          <p className="govern-muted" style={{ marginTop: 12 }}>
            Spec: {docHint}
          </p>
        )}
      </div>
    </GovernPageShell>
  );
}
