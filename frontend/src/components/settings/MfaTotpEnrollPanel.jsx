import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Shield } from 'lucide-react';
import { notifyError, notifySuccess } from '@/lib/toast.js';

/** TOTP enroll: QR, optional manual secret, compact verification code. */
export function MfaTotpEnrollPanel({
  enroll,
  otp,
  onOtpChange,
  onConfirm,
  onCancel,
  confirming,
  compact = false,
}) {
  const [qrSrc, setQrSrc] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    const url = enroll?.otpauth_url;
    if (!url) {
      setQrSrc('');
      return undefined;
    }
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: compact ? 168 : 192,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0e7490', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [enroll?.otpauth_url, compact]);

  const copySecret = useCallback(async () => {
    const secret = enroll?.secret;
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      notifySuccess('Setup key copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notifyError('Could not copy — select the key and copy manually.');
    }
  }, [enroll?.secret]);

  if (!enroll) return null;

  return (
    <div className={`us-mfa-enroll${compact ? ' us-mfa-enroll--compact' : ''}`}>
      {!compact && (
        <div className="us-mfa-enroll__hero">
          <Shield size={18} aria-hidden />
          <div>
            <p className="us-mfa-enroll__title">Connect your authenticator</p>
            <p className="us-mfa-enroll__lede">
              Use Google Authenticator, 1Password, or any TOTP app that supports time-based codes.
            </p>
          </div>
        </div>
      )}

      <ol className="us-mfa-enroll__flow">
        <li>
          <span className="us-mfa-enroll__flow-label">1. Scan the QR code</span>
          <div className="us-mfa-enroll__grid">
            <figure className="us-mfa-enroll__qr-card">
              {qrSrc ? (
                <img
                  src={qrSrc}
                  width={compact ? 168 : 192}
                  height={compact ? 168 : 192}
                  alt="QR code for authenticator app"
                />
              ) : (
                <span className="us-mfa-enroll__qr-placeholder" aria-hidden />
              )}
              <figcaption>Scan with your app</figcaption>
            </figure>
            <div className="us-mfa-enroll__manual">
              <p className="us-mfa-enroll__step-label">Can&apos;t scan?</p>
              <button
                type="button"
                className="btn btn-secondary btn--sm"
                onClick={() => setShowSecret((s) => !s)}
              >
                {showSecret ? 'Hide setup key' : 'Show setup key'}
              </button>
              {showSecret ? (
                <div className="us-mfa-enroll__secret-row">
                  <code className="us-mfa-enroll__secret">{enroll.secret}</code>
                  <button
                    type="button"
                    className="btn btn-secondary btn--sm us-mfa-enroll__copy"
                    onClick={copySecret}
                    aria-label="Copy setup key"
                  >
                    {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </li>
        <li>
          <span className="us-mfa-enroll__flow-label">2. Verify your authenticator</span>
          <div className="us-mfa-enroll__verify auth-outline-field">
            <label htmlFor="mfa-enroll-otp" className="auth-outline-field__name">
              Six-digit code
            </label>
            <input
              id="mfa-enroll-otp"
              className="auth-outline-field__control us-mfa-enroll__otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={otp}
              onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="000000"
            />
            <p className="auth-outline-field__hint">Enter the current code from your authenticator app.</p>
          </div>
        </li>
      </ol>

      <footer className="us-mfa-enroll__actions">
        {onCancel ? (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={confirming}>
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary us-mfa-enroll__confirm"
          disabled={confirming || otp.length < 6}
          onClick={onConfirm}
        >
          {confirming ? 'Verifying…' : 'Verify and enable'}
        </button>
      </footer>
    </div>
  );
}