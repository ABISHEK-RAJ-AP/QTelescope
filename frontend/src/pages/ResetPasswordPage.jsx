import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
import { CaptchaField } from '@/components/CaptchaField'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tokenFromUrl = useMemo(() => params.get('token') || '', [params])
  const [token, setToken] = useState(tokenFromUrl)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Password confirmation does not match.')
      return
    }
    if (!captchaCode.trim()) {
      setError('Enter the characters shown in the image.')
      return
    }
    setBusy(true)
    try {
      await api.resetPassword({
        token: token.trim(),
        new_password: password,
        confirm_password: confirm,
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      })
      navigate('/login')
    } catch (err) {
      setError(err?.message || 'Reset failed.')
      setCaptchaKey((k) => k + 1)
      setCaptchaCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Use the reset token from the request step, then set a new password."
      footer={
        <p className="text-center text-sm text-[var(--text-muted)]">
          <Link to="/login" className="font-semibold text-[var(--accent)] hover:opacity-90">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {!tokenFromUrl && (
          <Field label="Reset token">
            <input value={token} onChange={(e) => setToken(e.target.value)} className={fieldClass} required />
          </Field>
        )}
        <Field label="New password">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
            required
            minLength={6}
          />
        </Field>
        <Field label="Confirm password">
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={fieldClass}
            required
            minLength={6}
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
        <Button type="submit" className="auth-cta h-11 w-full gap-2 text-sm font-semibold" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
