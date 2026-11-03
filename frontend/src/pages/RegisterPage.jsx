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
      title="Create Account"
      subtitle="Create an operator account for your lab."
      footer={
        <p className="text-center text-sm text-neutral-500">
          Already registered?{' '}
          <Link
            to="/login"
            className="font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:underline"
          >
            Sign in here
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <Field label="Full Name">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={fieldClass}
              placeholder="Dr. Raman"
            />
          </Field>
        </div>

        <Field label="Email Address">
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

        <Field label="Confirm Password">
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

        {error && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
            {success}
          </div>
        )}

        <Button type="submit" className="h-11 w-full gap-2 text-sm font-semibold" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Create profile <ArrowRight className="size-4" />
        </Button>
      </form>
    </AuthShell>
  )
}
