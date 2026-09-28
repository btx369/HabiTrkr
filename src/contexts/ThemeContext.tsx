import { createContext, useContext, useEffect, useState } from 'react'
import { getLocalStorageString, setLocalStorageString } from '@/lib/localStorageUtils'
import { THEME_KEY } from '@/lib/storageKeys'

type Theme = 'dark' | 'light'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'light',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = THEME_KEY,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => {
      const stored = getLocalStorageString(storageKey, defaultTheme) as Theme;
      // If stored theme is invalid, default to light
      if (stored !== 'light' && stored !== 'dark') {
        return defaultTheme;
      }
      return stored;
    }
  )

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      setLocalStorageString(storageKey, newTheme)
      setTheme(newTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}