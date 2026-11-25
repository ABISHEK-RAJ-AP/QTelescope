import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { MfaTotpEnrollPanel } from './MfaTotpEnrollPanel.jsx';

export function MfaTotpEnrollModal({
  enroll,
  otp,
  onOtpChange,
  onConfirm,
  onCancel,
  confirming,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    const trap = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', trap);
    panelRef.current?.querySelector('input, button')?.focus();
    return () => {
      window.removeEventListener('keydown', trap);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [onCancel]);

  if (!enroll) return null;

  return (
    <div className="us-mfa-modal" role="presentation">
      <button type="button" className="us-mfa-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div
        ref={panelRef}
        className="us-mfa-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="us-mfa-modal-title"
      >
        <header className="us-mfa-modal__head">
          <div>
            <h2 id="us-mfa-modal-title">Set up two-factor authentication</h2>
            <p className="us-mfa-modal__lede">
              Add an extra layer of protection using a verification code from an authenticator app.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-icon-only" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <p className="us-mfa-modal__privacy" role="note">
          Keep your QR code and setup key private. Anyone with access to your setup key may generate authentication codes.
        </p>
        <MfaTotpEnrollPanel
          enroll={enroll}
          otp={otp}
          onOtpChange={onOtpChange}
          onConfirm={onConfirm}
          onCancel={onCancel}
          confirming={confirming}
          compact
        />
      </div>
    </div>
  );
}