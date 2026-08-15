'use client'

import { useEffect, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COLOR_THEMES, normalizeHex } from '@/lib/colorThemes'
import { useColorTheme } from '@/hooks/useColorTheme'
import { cn } from '@/lib/utils'

export default function AppearanceSettingsCard() {
  const { themeId, customHex, setTheme } = useColorTheme()
  const [hexDraft, setHexDraft] = useState(customHex)

  useEffect(() => {
    setHexDraft(customHex)
  }, [customHex])

  const applyCustomHex = (value: string) => {
    const hex = normalizeHex(value)
    setHexDraft(hex)
    setTheme('custom', hex)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-2">
        <Palette className="mt-0.5 h-5 w-5 text-blue-600" />
        <div className="space-y-1">
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose a colour theme for buttons, navigation, and highlights across the app.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Colour theme</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {COLOR_THEMES.map((theme) => {
              const selected = themeId === theme.id
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setTheme(theme.id)}
                  className={cn(
                    'relative flex flex-col gap-2 rounded-lg border-2 p-3 text-left transition-colors',
                    selected ? 'border-blue-600 bg-blue-50/70' : 'border-transparent bg-muted/50 hover:border-border'
                  )}
                >
                  <div className="flex h-10 overflow-hidden rounded-md shadow-sm">
                    <span className="flex-1" style={{ backgroundColor: theme.swatch }} />
                    <span className="w-1/3" style={{ backgroundColor: `hsl(${theme.scale[100]})` }} />
                    <span className="w-1/4" style={{ backgroundColor: `hsl(${theme.scale[50]})` }} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium leading-none">{theme.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{theme.description}</p>
                    </div>
                    {selected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="custom-theme-hex">Custom colour</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick any accent colour if none of the presets fit.
              </p>
            </div>
            {themeId === 'custom' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="custom-theme-hex-picker"
              type="color"
              value={customHex}
              onChange={(e) => applyCustomHex(e.target.value)}
              className="h-10 w-16 cursor-pointer p-1"
            />
            <Input
              id="custom-theme-hex"
              value={hexDraft}
              onChange={(e) => {
                const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                if (/^#([0-9a-fA-F]{0,6})$/.test(value)) {
                  setHexDraft(value)
                  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
                    setTheme('custom', value)
                  }
                }
              }}
              onBlur={() => applyCustomHex(hexDraft)}
              className="w-32 font-mono uppercase"
              maxLength={7}
            />
            <Button type="button" variant="outline" onClick={() => applyCustomHex(hexDraft)}>
              Apply custom
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">Preview</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button">Primary action</Button>
            <Button type="button" variant="outline">
              Secondary
            </Button>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              Active item
            </span>
            <span className="text-sm font-medium text-blue-600">Link colour</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
