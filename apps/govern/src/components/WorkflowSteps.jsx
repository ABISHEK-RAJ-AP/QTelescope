/** Reusable pipeline / wizard step strip (`qre-wizard-steps` markup). */
export default function WorkflowSteps({ steps = [], ariaLabel = 'Workflow', onOpen }) {
  if (!steps.length) return null;

  function go(href) {
    if (!href) return;
    if (onOpen) onOpen(href);
    else window.location.hash = href;
  }

  return (
    <div className="qre-wizard-steps" role="list" aria-label={ariaLabel}>
      {steps.map((step, i) => {
        let cls = 'qre-wizard-step';
        if (step.status === 'done') cls += ' qre-wizard-step--done';
        else if (step.status === 'current') cls += ' qre-wizard-step--current';

        const label = step.href ? (
          <button type="button" className="qre-wizard-step__link fs-link" onClick={() => go(step.href)}>
            {step.label}
          </button>
        ) : (
          step.label
        );

        return (
          <span key={step.id || i} className={cls} role="listitem">
            {label}
          </span>
        );
      })}
    </div>
  );
}