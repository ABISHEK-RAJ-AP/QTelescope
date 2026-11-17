import React, { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { api } from '@/services/api'
import { Field, fieldClass } from '@/components/AuthShell'
import { InfoTooltip } from '@/components/observability/InfoTooltip.jsx'

export function CaptchaField({ value, onChange, onChallenge }) {
  const [captchaImage, setCaptchaImage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchNewCaptcha = async () => {
    setLoading(true)
    setError('')
    onChange('')
    try {
      const res = await api.getCaptcha()
      if (res?.captcha_id) {
        setCaptchaImage(res.captcha_image)
        onChallenge?.(res.captcha_id)
      }
    } catch {
      setError('Could not load the image. Confirm the API is up, then retry.')
      onChallenge?.('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNewCaptcha()
    // ponytail: mount-only challenge fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-1">
      <div className="flex items-stretch gap-3">
        <div className="relative flex h-[52px] w-[min(42%,220px)] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-color)] bg-[#efe8d8] dark:bg-neutral-950">
          {loading ? (
            <span className="text-xs text-[var(--text-muted)]" aria-live="polite">
              Generating…
            </span>
          ) : captchaImage ? (
            <img
              src={captchaImage}
              alt="Enter the characters shown"
              className="h-full w-full object-contain select-none"
              draggable={false}
            />
          ) : (
            <span className="px-2 text-center text-xs text-[var(--text-muted)]">Challenge offline</span>
          )}
          <button
            type="button"
            onClick={fetchNewCaptcha}
            disabled={loading}
            className="absolute right-1 top-1 inline-flex min-h-8 min-w-8 items-center justify-center rounded-md bg-[var(--bg-card)]/90 text-[var(--accent)] hover:opacity-90 disabled:opacity-50"
            aria-label="New image"
            title="New image"
          >
            <RotateCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        </div>
        <Field label="Characters" forId="auth-captcha" className="auth-outline-field--flush min-h-[52px] flex-1">
          <input
            id="auth-captcha"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
            className={`${fieldClass} font-mono text-base tracking-widest tabular-nums uppercase`}
            maxLength={8}
            required
            aria-invalid={Boolean(error)}
          />
        </Field>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        Type the characters from the image.
        <InfoTooltip label="Image verification">
          Proves a person is signing in. After an API restart, click the refresh icon for a new image.
        </InfoTooltip>
      </p>
      {error ? (
        <p className="text-sm text-[var(--ds-status-critical)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default CaptchaField
