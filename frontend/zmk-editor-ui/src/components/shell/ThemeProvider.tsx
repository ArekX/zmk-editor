import { useEffect, useMemo, useState, type ReactNode } from "react"

import { ThemeContext, type Theme } from "@/lib/theme/context"

const STORAGE_KEY = "zmk-editor-theme"

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark",
  )
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark")
  }, [resolved])

  const value = useMemo(
    () => ({
      theme,
      resolved,
      setTheme: (t: Theme) => {
        localStorage.setItem(STORAGE_KEY, t)
        setTheme(t)
      },
    }),
    [theme, resolved],
  ) as { theme: Theme; resolved: "light" | "dark"; setTheme: (t: Theme) => void }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
