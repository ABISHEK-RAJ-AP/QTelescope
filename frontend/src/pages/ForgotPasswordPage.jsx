import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
import { CaptchaField } from '@/components/CaptchaField'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

export function ForgotPasswordPage() {
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [devToken, setDevToken] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    setDevToken('')
    if (!username.trim()) {
      setError('Enter a username.')
      setBusy(false)
      return
    }
    if (!captchaCode.trim()) {
      setError('Enter the characters shown in the image.')
      setBusy(false)
      return
    }
    try {
      const res = await api.forgotPassword({
        username: username.trim(),
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      })
      setMessage(res?.message || 'If an account exists for that identity, a reset link was issued.')
      if (res?.dev_reset_token) setDevToken(res.dev_reset_token)
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
      title="Reset password"
      subtitle="Enter your username. A reset link is issued only if the account exists."
      footer={
        <p className="text-center text-sm text-[var(--text-muted)]">
          <Link to="/login" className="font-semibold text-[var(--accent)] hover:opacity-90">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Username" forId="forgot-username">
          <input
            id="forgot-username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
        {devToken ? (
          <p className="break-all text-xs text-[var(--text-muted)]">
            Lab token (not returned in production):{' '}
            <Link className="text-[var(--accent)]" to={`/reset-password?token=${encodeURIComponent(devToken)}`}>
              continue
            </Link>
          </p>
        ) : null}
        <Button type="submit" className="auth-cta h-11 w-full gap-2 text-sm font-semibold" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Request reset
        </Button>
      </form>
    </AuthShell>
  )
}
