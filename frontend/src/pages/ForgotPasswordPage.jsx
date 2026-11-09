import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

export function ForgotPasswordPage() {
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [devToken, setDevToken] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setDevToken('')
    try {
      const res = await api.forgotPassword({ username: username.trim() })
      setMessage(res?.message || 'If an account exists for that identity, a reset link was issued.')
      if (res?.dev_reset_token) setDevToken(res.dev_reset_token)
    } catch (err) {
      setMessage(err?.message || 'Request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter the username. A reset token is issued if the account exists."
      footer={
        <p className="text-center text-sm text-neutral-500">
          <Link to="/login" className="font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
        {message && <p className="text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}
        {devToken && (
          <p className="break-all text-xs text-neutral-500">
            Lab token (not returned in production):{' '}
            <Link className="text-cyan-600" to={`/reset-password?token=${encodeURIComponent(devToken)}`}>
              continue
            </Link>
          </p>
        )}
        <Button type="submit" className="h-11 w-full gap-2 text-sm font-semibold" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Request reset
        </Button>
      </form>
    </AuthShell>
  )
}
