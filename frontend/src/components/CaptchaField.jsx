import React, { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { api } from '@/services/api';
import { COPY } from '@/copy/operator.js';
import { fieldClass } from '@/components/AuthShell';
import { InfoTooltip } from '@/components/observability/InfoTooltip.jsx';

export function CaptchaField({ value, onChange, onChallenge }) {
  const [captchaImage, setCaptchaImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchNewCaptcha = async () => {
    setLoading(true);
    setError('');
    onChange('');
    try {
      const res = await api.getCaptcha();
      if (res?.captcha_id) {
        setCaptchaImage(res.captcha_image);
        onChallenge?.(res.captcha_id);
      }
    } catch {
      setError(COPY.auth.captchaUnavailable);
      onChallenge?.('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewCaptcha();
    // ponytail: mount-only challenge fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="captcha-field">
      <div className="captcha-field__head">
        <span className="captcha-field__legend" id="auth-captcha-legend">
          Security check
        </span>
        <button
          type="button"
          onClick={fetchNewCaptcha}
          disabled={loading}
          className="captcha-field__refresh"
          aria-label="New image"
          title="New image"
        >
          <RotateCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          <span className="captcha-field__refresh-label">New image</span>
        </button>
      </div>
      <div
        className="captcha-field__row"
        role="group"
        aria-labelledby="auth-captcha-legend"
      >
        <div className="captcha-field__image" aria-live="polite">
          {loading ? (
            <span className="captcha-field__placeholder">Generating…</span>
          ) : captchaImage ? (
            <img
              src={captchaImage}
              alt="Enter the characters shown"
              className="captcha-field__img"
              width={148}
              height={52}
              draggable={false}
            />
          ) : (
            <span className="captcha-field__placeholder">Challenge offline</span>
          )}
        </div>
        <div className="auth-outline-field captcha-field__input">
          <label htmlFor="auth-captcha" className="auth-outline-field__name">
            Characters
          </label>
          <input
            id="auth-captcha"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
            className={`${fieldClass} captcha-field__control font-mono text-base tracking-widest tabular-nums uppercase`}
            maxLength={8}
            required
            aria-invalid={Boolean(error)}
          />
        </div>
      </div>
      <p className="captcha-field__help">
        Type the characters from the image.
        <InfoTooltip label="Image verification">
          Proves a person is signing in. After an API restart, click the refresh icon for a new image.
        </InfoTooltip>
      </p>
      {error ? (
        <p className="captcha-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default CaptchaField;