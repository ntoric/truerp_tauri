'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CheckCircle2, IndianRupee, Loader2 } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { API_BASE, cn } from '@/lib/utils'
import {
  firstValidationMessage,
  validateForgotPasswordForm,
  validateResetOTPForm,
  validateResetPasswordForm,
} from '@/lib/authValidation'

type Step = 'email' | 'otp' | 'password' | 'done'

export default function ForgotPasswordPage() {
  const {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    showErrorToast,
  } = useFormErrors()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validateForgotPasswordForm({ email })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setFieldErrors({})
      setStep('otp')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      showErrorToast(message)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validateResetOTPForm({ otp })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.fields?.otp || 'Verification failed')
      setFieldErrors({})
      setStep('password')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      showErrorToast(message)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validateResetPasswordForm({ password, confirmPassword })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          new_password: password,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      setStep('done')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      showErrorToast(message)
    } finally {
      setLoading(false)
    }
  }

  const stepDescription = {
    email: 'Enter your email and we will send you a 6-digit verification code',
    otp: `Enter the 6-digit code sent to ${email}`,
    password: 'Choose a new password for your account',
    done: 'Your password has been reset successfully',
  }[step]

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <IndianRupee className="h-7 w-7" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Forgot password</CardTitle>
          <CardDescription>{stepDescription}</CardDescription>
        </CardHeader>

        {step === 'done' ? (
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
              <CheckCircle2 className="h-8 w-8" />
              <p>Your password has been updated. You can now log in with your new password.</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        ) : step === 'email' ? (
          <form onSubmit={handleEmailSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    clearFieldError('email')
                    setEmail(e.target.value)
                  }}
                  className={cn(fieldErrors.email && 'border-red-500')}
                  required
                />
                <FieldError message={fieldErrors.email} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send verification code
              </Button>
              <p className="text-sm text-muted-foreground">
                Remember your password?{' '}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Login
                </Link>
              </p>
            </CardFooter>
          </form>
        ) : step === 'otp' ? (
          <form onSubmit={handleOtpSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    clearFieldError('otp')
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }}
                  className={cn(fieldErrors.otp && 'border-red-500', 'tracking-widest text-center text-lg')}
                  required
                />
                <FieldError message={fieldErrors.otp} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify code
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => {
                  setError('')
                  setOtp('')
                  setFieldErrors({})
                  setStep('email')
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Use a different email
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    clearFieldError('password')
                    setPassword(e.target.value)
                  }}
                  className={cn(fieldErrors.password && 'border-red-500')}
                  required
                  minLength={6}
                />
                <FieldError message={fieldErrors.password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    clearFieldError('confirmPassword')
                    setConfirmPassword(e.target.value)
                  }}
                  className={cn(fieldErrors.confirmPassword && 'border-red-500')}
                  required
                  minLength={6}
                />
                <FieldError message={fieldErrors.confirmPassword} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reset password
              </Button>
              <p className="text-sm text-muted-foreground">
                <Link href="/login" className="text-blue-600 hover:underline">
                  Back to login
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
