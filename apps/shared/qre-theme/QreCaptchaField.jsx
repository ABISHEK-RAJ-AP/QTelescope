import { RefreshCw } from 'lucide-react';

export default function QreCaptchaField({
  captchaImage,
  captchaCode,
  onCaptchaCodeChange,
  onReload,
  busy = false,
  id = 'captcha-code',
}) {
  return (
    <div className="qre-field qre-captcha-field">
      <span className="qre-field__label" id={`${id}-label`}>
        Verification
      </span>
      <div className="qre-captcha-field__row">
        {captchaImage ? (
          <img src={captchaImage} alt="Captcha challenge" className="qre-captcha-field__image" />
        ) : (
          <div className="qre-captcha-field__image qre-captcha-field__image--placeholder" aria-hidden />
        )}
        <button
          type="button"
          className="qre-captcha-field__reload"
          onClick={onReload}
          disabled={busy}
          aria-label={busy ? 'Loading captcha' : 'Reload captcha image'}
          title="Reload captcha"
        >
          <RefreshCw size={20} className={busy ? 'qre-captcha-field__spin' : ''} aria-hidden />
        </button>
        <input
          id={id}
          className="qre-field__input qre-captcha-field__input"
          value={captchaCode}
          onChange={(e) => onCaptchaCodeChange(e.target.value)}
          placeholder="Enter code"
          autoComplete="off"
          required
          aria-labelledby={`${id}-label`}
        />
      </div>
    </div>
  );
}
