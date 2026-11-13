import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowRight, User, Lock, Mail, Building } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
import { CaptchaField } from '@/components/CaptchaField'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { markOnboardingPending } from '@/lib/onboardingState'

export function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [org, setOrg] = useState('')
  const [role, setRole] = useState('Operator')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!username.trim() || !email.trim() || !password) {
      setError('Fill username, email, and password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!captchaCode.trim()) {
      setError('Enter the characters shown in the image.')
      return
    }

    setBusy(true)
    try {
      const res = await api.register({
        username: username.trim(),
        full_name: fullName.trim() || username.trim(),
        email: email.trim(),
        org: org.trim() || 'C-DAC',
        role,
        password,
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      })
      if (res?.status === 'SUCCESS') {
        markOnboardingPending(username.trim())
        setSuccess('Account created. Redirecting to sign in…')
        setTimeout(() => navigate('/login'), 1200)
      }
    } catch (err) {
      setError(err?.message || 'Registration failed.')
      setCaptchaKey((k) => k + 1)
      setCaptchaCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Operator account for your lab. Admin roles are assigned after review."
      footer={
        <p className="text-center text-sm text-[var(--text-muted)]">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-[var(--accent)] hover:opacity-90">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username">
            <div className="relative">
              <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${fieldClass} pl-9`}
                placeholder="quantum_op"
              />
            </div>
          </Field>
          <Field label="Full name">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={fieldClass}
              placeholder="Dr. Raman"
            />
          </Field>
        </div>

        <Field label="Email">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${fieldClass} pl-9`}
              placeholder="operator@cdac.in"
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Organisation">
            <div className="relative">
              <Building className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                className={`${fieldClass} pl-9`}
                placeholder="C-DAC / Lab"
              />
            </div>
          </Field>
          <Field label="Console role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={`${fieldClass} input-control`}
            >
              <option value="Operator">Operator</option>
              <option value="Researcher">Researcher</option>
            </select>
          </Field>
        </div>

        <Field label="Password">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${fieldClass} pl-9 pr-10`}
              placeholder="Min 6 characters"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <Field label="Confirm password">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type={showPw ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${fieldClass} pl-9`}
              placeholder="Re-enter password"
            />
          </div>
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

        {success ? (
          <div className="auth-inline-alert auth-inline-alert--success" role="status">
            {success}
          </div>
        ) : null}

        <Button type="submit" className="auth-cta h-11 w-full gap-2 text-sm font-semibold" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Create account <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
    </AuthShell>
  )
}
