import { createContext, useContext } from "react"

export type Theme = "light" | "dark" | "system"

export interface ThemeState {
  theme: Theme
  resolved: "light" | "dark"
  setTheme: (t: Theme) => void
}

export const ThemeContext = createContext<ThemeState>({
  theme: "system",
  resolved: "dark",
  setTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)
