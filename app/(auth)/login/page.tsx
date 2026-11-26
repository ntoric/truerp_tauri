'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { cn } from '@/lib/utils'
import {
  firstValidationMessage,
  validateLoginForm,
} from '@/lib/authValidation'

export default function LoginPage() {
  const { login } = useAuth()
  const {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    showErrorToast,
  } = useFormErrors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [needs2fa, setNeeds2fa] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validateLoginForm({ email, password, totpCode, needs2fa })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setLoading(true)
    try {
      const result = await login(email.trim(), password, needs2fa ? totpCode.trim() : undefined)
      // Keep the spinner up while the browser loads the next page.
      setRedirecting(true)
      if (result.requiresPasswordChange) {
        window.location.href = '/change-password-required'
        return
      }
      const params = new URLSearchParams(window.location.search)
      const next = params.get('next')
      const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
      window.location.href = dest
    } catch (err: any) {
      if (err.requires2fa) {
        setNeeds2fa(true)
        setError('Enter the 6-digit code from your authenticator app')
      } else {
        setError(err.message)
        showErrorToast(err.message)
      }
      setLoading(false)
    }
  }

  const inputClass = (invalid?: string) =>
    cn(
      'h-11 rounded-md border-input bg-card pl-[42px] pr-3.5 text-base text-heading placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_hsl(var(--theme-50))] md:text-sm',
      invalid && 'border-red-500',
    )

  return (
    <AuthSplitLayout
      headline={<>Your business.<br />Your workspace.</>}
      benefits={['Bill with confidence', 'Keep your inventory in sync', 'See your business clearly']}
    >
      <h2 id="login-heading" className="text-2xl font-bold leading-tight tracking-tight text-heading">Welcome back</h2>
      <p className="mb-7 mt-1.5 text-sm leading-6 text-muted-foreground">Sign in to your TruERP workspace.</p>
      <form onSubmit={handleSubmit} className="space-y-[18px]" aria-busy={loading}>
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-5 text-destructive">
            <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium text-heading">Work email</Label>
          <div className="relative flex items-center">
            <Mail className="pointer-events-none absolute left-3.5 h-[18px] w-[18px] text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              disabled={loading}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              onChange={(e) => {
                clearFieldError('email')
                setEmail(e.target.value)
              }}
              className={inputClass(fieldErrors.email)}
              required
            />
          </div>
          <div id="email-error"><FieldError message={fieldErrors.email} className="text-xs text-destructive" /></div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password" className="text-[13px] font-medium text-heading">Password</Label>
            <Link href="/forgot-password" className="rounded-sm text-[13px] font-medium text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--theme-700))]">Forgot password?</Link>
          </div>
          <div className="relative flex items-center">
            <Lock className="pointer-events-none absolute left-3.5 h-[18px] w-[18px] text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              disabled={loading}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              onChange={(e) => {
                clearFieldError('password')
                setPassword(e.target.value)
              }}
              className={cn(inputClass(fieldErrors.password), 'pr-12')}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-controls="password"
              disabled={loading}
              className="absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint hover:text-primary disabled:opacity-50"
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <Eye className="h-[18px] w-[18px]" aria-hidden="true" />}
            </button>
          </div>
          <div id="password-error"><FieldError message={fieldErrors.password} className="text-xs text-destructive" /></div>
        </div>
        {needs2fa && (
          <div className="space-y-1.5">
            <Label htmlFor="totp" className="text-[13px] font-medium text-heading">Authenticator code</Label>
            <div className="relative flex items-center">
              <ShieldCheck className="pointer-events-none absolute left-3.5 h-[18px] w-[18px] text-muted-foreground" aria-hidden="true" />
              <Input
                id="totp"
                name="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                value={totpCode}
                disabled={loading}
                aria-describedby={fieldErrors.totpCode ? 'totp-error' : 'totp-help'}
                onChange={(e) => {
                  clearFieldError('totpCode')
                  setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }}
                className={cn(inputClass(fieldErrors.totpCode), 'tracking-[0.25em]')}
                maxLength={6}
                required
              />
            </div>
            <p id="totp-help" className="text-xs leading-5 text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
            <div id="totp-error"><FieldError message={fieldErrors.totpCode} className="text-xs text-destructive" /></div>
          </div>
        )}
        <Button
          type="submit"
          className="!mt-6 h-[52px] w-full gap-2 rounded-lg bg-button-gradient text-[15px] font-semibold text-white transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:bg-button-gradient hover:shadow-gr-accent disabled:translate-y-0 disabled:shadow-none"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {redirecting ? 'Opening your workspace…' : loading ? 'Signing in…' : needs2fa ? 'Verify and sign in' : 'Sign in'}
          {!loading && <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Need an account? Ask your workspace admin to invite you.
      </p>
    </AuthSplitLayout>
  )
}
