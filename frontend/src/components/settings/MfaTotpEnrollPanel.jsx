import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Shield } from 'lucide-react';
import { notifyError, notifySuccess } from '@/lib/toast.js';

/** Cert-studio–style TOTP enroll: QR, manual secret, verification code. */
export function MfaTotpEnrollPanel({ enroll, otp, onOtpChange, onConfirm, confirming }) {
  const [qrSrc, setQrSrc] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = enroll?.otpauth_url;
    if (!url) {
      setQrSrc('');
      return undefined;
    }
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 192,
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
  }, [enroll?.otpauth_url]);

  const copySecret = useCallback(async () => {
    const secret = enroll?.secret;
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      notifySuccess('Secret copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notifyError('Could not copy — select the secret and copy manually.');
    }
  }, [enroll?.secret]);

  if (!enroll) return null;

  return (
    <div className="us-mfa-enroll">
      <div className="us-mfa-enroll__hero">
        <Shield size={18} aria-hidden />
        <div>
          <p className="us-mfa-enroll__title">Link your authenticator</p>
          <p className="us-mfa-enroll__lede">
            Google Authenticator, 1Password, or any TOTP app — not SMS or email OTP.
          </p>
        </div>
      </div>

      <div className="us-mfa-enroll__grid">
        <figure className="us-mfa-enroll__qr-card">
          {qrSrc ? (
            <img src={qrSrc} width={192} height={192} alt="QR code for authenticator app" />
          ) : (
            <span className="us-mfa-enroll__qr-placeholder" aria-hidden />
          )}
          <figcaption>Scan with your app</figcaption>
        </figure>

        <div className="us-mfa-enroll__manual">
          <p className="us-mfa-enroll__step-label">Can&apos;t scan?</p>
          <ol className="us-mfa-enroll__steps">
            <li>Add a new time-based token in your app.</li>
            <li>Paste the account name <strong>Q-TeleScope</strong>.</li>
            <li>Enter this key when asked for a secret.</li>
          </ol>
          <div className="us-mfa-enroll__secret-row">
            <code className="us-mfa-enroll__secret" title={enroll.secret}>
              {enroll.secret}
            </code>
            <button
              type="button"
              className="btn btn-secondary btn--sm us-mfa-enroll__copy"
              onClick={copySecret}
              aria-label="Copy secret key"
            >
              {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <div className="us-mfa-enroll__verify auth-outline-field">
        <label htmlFor="mfa-enroll-otp" className="auth-outline-field__name">
          Verification code
        </label>
        <input
          id="mfa-enroll-otp"
          className="auth-outline-field__control us-mfa-enroll__otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          value={otp}
          onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="6-digit code"
        />
        <p className="auth-outline-field__hint">Enter the rolling code from your app to finish setup.</p>
      </div>

      <button
        type="button"
        className="btn btn-primary us-mfa-enroll__confirm"
        disabled={confirming || otp.length < 6}
        onClick={onConfirm}
      >
        {confirming ? 'Enabling…' : 'Confirm & enable'}
      </button>
    </div>
  );
}