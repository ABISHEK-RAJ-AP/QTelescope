export default function EmptyState({ title, body, action = null }) {
  return (
    <div className="qf-empty">
      <h3 className="qf-empty__title">{title}</h3>
      {body ? <p className="qf-empty__body">{body}</p> : null}
      {action}
    </div>
  );
}
