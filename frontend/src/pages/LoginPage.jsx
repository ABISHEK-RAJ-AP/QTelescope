import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowRight, User, Lock } from 'lucide-react'
import { AuthShell, Field, fieldClass } from '@/components/AuthShell'
import { CaptchaField } from '@/components/CaptchaField'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { shouldRunOnboarding } from '@/lib/onboardingState'
import { landingPathForRole } from '@/lib/permissions.js'
import { safePostLoginRedirect } from '@/lib/safePostLoginRedirect'

export function LoginPage({ onLoginSuccess }) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [showDevPresets, setShowDevPresets] = useState(true)
  const [ldapHint, setLdapHint] = useState('')

  const finishSession = async (res) => {
    let user = res.user
    try {
      localStorage.setItem('quantum_user', JSON.stringify(res.user))
      const me = await api.getMe()
      if (me?.authenticated) {
        user = {
          ...res.user,
          permissions: me.permissions,
          role_label: me.role_label,
          full_name: me.full_name ?? res.user.full_name,
          email: me.email ?? res.user.email,
          org: me.org ?? res.user.org,
        }
      }
    } catch { /* keep login payload */ }
    localStorage.setItem('quantum_user', JSON.stringify(user))
    onLoginSuccess?.(user)
    const postLogin = safePostLoginRedirect(sessionStorage.getItem('qre_post_login_redirect'))
    sessionStorage.removeItem('qre_post_login_redirect')
    if (postLogin) {
      navigate(postLogin)
      return
    }
    if (shouldRunOnboarding(res.user)) {
      navigate('/app/onboarding')
      return
    }
    let landing = landingPathForRole(res.user?.role)
    if (res.user?.role === 'Operator' && landing === '/app/operate') {
      try {
        const profile = await api.getDeploymentProfile()
        if (profile?.ux?.operator_landing && profile.ux.operator_landing !== 'operations') {
          landing = '/app/overview'
        }
      } catch { /* keep operate */ }
    }
    navigate(landing)
  }

  useEffect(() => {
    api.getConfigStatus()
      .then((s) => {
        if (s?.bootstrap && Object.prototype.hasOwnProperty.call(s.bootstrap, 'show_dev_login_presets')) {
          setShowDevPresets(Boolean(s.bootstrap.show_dev_login_presets))
        }
        if (s?.ldap?.enabled) {
          setLdapHint(`Directory login on ${s.ldap.host || 'LDAP'} — local accounts still work.`)
        }
      })
      .catch(() => setShowDevPresets(true))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Enter username and password.')
      return
    }
    if (!captchaCode.trim()) {
      setError('Enter the characters shown in the image.')
      return
    }

    setLoading(true)
    try {
      const res = await api.login({
        username: username.trim(),
        password: password.trim(),
        captcha_id: captchaId,
        captcha_code: captchaCode.trim(),
      })

      if (res?.status === 'MFA_REQUIRED' && res.mfa_token) {
        setMfaToken(res.mfa_token)
        setMfaCode('')
        return
      }
      if (res?.status === 'SUCCESS') {
        await finishSession(res)
      }
    } catch (err) {
      setError(err?.message || 'Sign-in failed. Check the image and credentials.')
      setCaptchaKey((k) => k + 1)
      setCaptchaCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Sign In"
      subtitle={ldapHint || 'Sign in to the operations console. Local account or LDAP if configured.'}
      footer={
        <div className="space-y-4">
          <p className="text-center text-sm text-neutral-500">
            <Link to="/forgot-password" className="font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
              Forgot password
            </Link>
            {' · '}
            Need an operator account?{' '}
            <Link
              to="/register"
              className="font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:underline"
            >
              Register
            </Link>
          </p>
          {showDevPresets ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Demo accounts
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setUsername('admin'); setPassword('quantum2026'); setError('') }}
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => { setUsername('user_researcher'); setPassword('quantum2026'); setError('') }}
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  Researcher
                </button>
              </div>
            </div>
          ) : null}
        </div>
      }
    >
      {mfaToken ? (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          if (!mfaCode.trim()) {
            setError('Enter the authenticator code.')
            return
          }
          setLoading(true)
          try {
            const res = await api.loginMfa({ mfa_token: mfaToken, code: mfaCode.trim() })
            if (res?.status === 'SUCCESS') await finishSession(res)
          } catch (err) {
            setError(err?.message || 'Authenticator verification failed.')
          } finally {
            setLoading(false)
          }
        }}
      >
        <Field label="Authenticator code" forId="login-mfa-code">
          <input
            id="login-mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            className={fieldClass}
            placeholder="6-digit code"
          />
        </Field>
        {error && (
          <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}
        <Button type="submit" className="h-11 w-full gap-2 text-sm font-semibold" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          Verify and sign in
        </Button>
        <button
          type="button"
          className="w-full text-center text-xs text-neutral-500 underline"
          onClick={() => { setMfaToken(''); setMfaCode(''); setError('') }}
        >
          Back to password
        </button>
      </form>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Username" forId="login-username">
          <div className="relative">
            <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`${fieldClass} pl-9`}
              placeholder="admin or user_researcher"
            />
          </div>
        </Field>

        <Field label="Password" forId="login-password">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${fieldClass} pl-9 pr-10`}
              placeholder="••••••••••••"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <CaptchaField
          key={captchaKey}
          value={captchaCode}
          onChange={setCaptchaCode}
          onChallenge={setCaptchaId}
        />

        {error && (
          <div
            data-testid="login-error"
            className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
          >
            {error}
          </div>
        )}

        <Button type="submit" data-testid="login-submit" className="h-11 w-full gap-2 text-sm font-semibold" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign in <ArrowRight className="size-4" />
        </Button>
      </form>
      )}
    </AuthShell>
  )
}
