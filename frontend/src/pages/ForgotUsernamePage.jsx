import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
import { CaptchaField } from '@/components/CaptchaField'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { COPY } from '@/copy/operator.js'

export function ForgotUsernamePage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    const addr = email.trim().toLowerCase()
    if (!addr || !addr.includes('@')) {
      setError('Enter the email address on your account.')
      setBusy(false)
      return
    }
    if (!captchaCode.trim()) {
      setError('Enter the characters shown in the image.')
      setBusy(false)
      return
    }
    try {
      const res = await api.remindUsername({
        email: addr,
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      })
      setMessage(res?.message || COPY.auth.forgotUsernameSuccess)
    } catch (err) {
      setError(err?.message || 'Request failed.')
      setCaptchaKey((k) => k + 1)
      setCaptchaCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Forgot username"
      subtitle={COPY.auth.forgotUsernameSubtitle}
      footer={
        <p className="text-center text-sm text-[var(--text-muted)]">
          <Link to="/login" className="font-semibold text-[var(--accent)] hover:opacity-90">
            Back to sign in
          </Link>
          {' · '}
          <Link to="/forgot-password" className="font-semibold text-[var(--accent)] hover:opacity-90">
            Reset password
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Account email" forId="forgot-email">
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <CaptchaField
          key={captchaKey}
          value={captchaCode}
          onChange={setCaptchaCode}
          onChallenge={setCaptchaId}
        />
        {error ? (
          <div className="auth-inline-alert auth-inline-alert--error" role="alert">
            {error}
          </div>
        ) : null}
        {message ? (
          <p className="text-sm text-[var(--text-secondary)]" role="status">
            {message}
          </p>
        ) : null}
        <Button type="submit" className="auth-cta h-11 w-full gap-2 text-sm font-semibold" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Email my username
        </Button>
      </form>
    </AuthShell>
  )
}