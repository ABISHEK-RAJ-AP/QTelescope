import React, { useEffect, useState } from 'react'
import { RotateCw, ShieldCheck } from 'lucide-react'
import { api } from '@/services/api'
import { fieldClass } from '@/components/AuthShell'

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
      setError('Unable to load image challenge. Is the backend running?')
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
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
          Image verification
        </label>
        <button
          type="button"
          onClick={fetchNewCaptcha}
          disabled={loading}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-400"
        >
          <RotateCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          New image
        </button>
      </div>

      <div className="flex items-stretch gap-3">
        <div className="flex h-[72px] w-[220px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-300 bg-[#efe8d8] dark:border-neutral-700 dark:bg-neutral-950">
          {loading ? (
            <span className="text-[11px] text-neutral-500">Generating…</span>
          ) : captchaImage ? (
            <img
              src={captchaImage}
              alt="Enter the six characters shown"
              className="h-full w-full object-contain select-none"
              draggable={false}
            />
          ) : (
            <span className="px-2 text-center text-[11px] text-neutral-500">Challenge offline</span>
          )}
        </div>
        <div className="relative flex-1">
          <ShieldCheck className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="6 characters"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
            className={`${fieldClass} h-[72px] pl-8 font-mono text-base uppercase tracking-[0.28em]`}
            maxLength={8}
            required
            aria-label="Characters from the image"
          />
        </div>
      </div>
      {error ? <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  )
}

export default CaptchaField
