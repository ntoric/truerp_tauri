'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { IndianRupee, Loader2 } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { cn } from '@/lib/utils'
import {
  firstValidationMessage,
  validateRegisterForm,
} from '@/lib/authValidation'

export default function RegisterPage() {
  const { register } = useAuth()
  const {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    showErrorToast,
  } = useFormErrors()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validateRegisterForm({ name, email, password, phone })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setLoading(true)
    try {
      await register(name.trim(), email.trim(), password, phone.trim())
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.message)
      showErrorToast(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <IndianRupee className="h-7 w-7" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Create account</CardTitle>
          <CardDescription>Start your free TruERP trial</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => {
                  clearFieldError('name')
                  setName(e.target.value)
                }}
                className={cn(fieldErrors.name && 'border-red-500')}
                required
              />
              <FieldError message={fieldErrors.name} />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => {
                  clearFieldError('phone')
                  setPhone(e.target.value)
                }}
                className={cn(fieldErrors.phone && 'border-red-500')}
              />
              <FieldError message={fieldErrors.phone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => {
                  clearFieldError('password')
                  setPassword(e.target.value)
                }}
                className={cn(fieldErrors.password && 'border-red-500')}
                required
              />
              <FieldError message={fieldErrors.password} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Account
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:underline">
                Login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
