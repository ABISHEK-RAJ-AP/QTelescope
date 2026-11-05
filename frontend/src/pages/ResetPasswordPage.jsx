import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
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
    setBusy(true)
    try {
      await api.resetPassword({ token: token.trim(), new_password: password, confirm_password: confirm })
      navigate('/login')
    } catch (err) {
      setError(err?.message || 'Reset failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Use the reset token from the request step."
      footer={
        <p className="text-center text-sm text-neutral-500">
          <Link to="/login" className="font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!tokenFromUrl && (
          <Field label="Reset token">
            <input value={token} onChange={(e) => setToken(e.target.value)} className={fieldClass} required />
          </Field>
        )}
        <Field label="New password">
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} required />
        </Field>
        <Field label="Confirm password">
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldClass} required />
        </Field>
        {error && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}
        <Button type="submit" className="h-11 w-full gap-2 text-sm font-semibold" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
