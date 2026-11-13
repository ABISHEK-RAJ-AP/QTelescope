import React, { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { api } from '@/services/api'
import { fieldClass } from '@/components/AuthShell'
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 min-h-11">
        <label className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
          Image verification
          <InfoTooltip label="Image verification">
            Type the characters shown. Proves a person is signing in. After an API restart, click New image.
          </InfoTooltip>
        </label>
        <button
          type="button"
          onClick={fetchNewCaptcha}
          disabled={loading}
          className="inline-flex items-center gap-1.5 min-h-11 px-2 text-sm font-medium text-[var(--accent)] hover:opacity-90 disabled:opacity-50"
        >
          <RotateCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          New image
        </button>
      </div>

      <div className="flex items-stretch gap-3">
        <div className="flex h-[72px] w-[220px] shrink-0 items-center justify-center overflow-hidden rounded-[calc(var(--ds-radius-card)-4px)] border border-[var(--border-color)] bg-[#efe8d8] dark:bg-neutral-950">
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
        </div>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Characters"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
          className={`${fieldClass} h-[72px] font-mono text-base tracking-widest tabular-nums uppercase`}
          maxLength={8}
          required
          aria-label="Characters from the image"
          aria-invalid={Boolean(error)}
        />
      </div>
      {error ? (
        <p className="text-sm text-[var(--ds-status-critical)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default CaptchaField
