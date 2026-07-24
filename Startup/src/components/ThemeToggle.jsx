import { useTheme } from '../contexts/ThemeContext'
import './navbar.css'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    setTheme(themes[(currentIndex + 1) % themes.length])
  }

  const getIcon = () => {
    if (theme === 'light') return '☀️'
    if (theme === 'dark') return '🌙'
    return '💻'
  }

  return (
    <button
      className="theme-toggle"
      aria-label="Toggle theme"
      onClick={cycleTheme}
      title={`Current theme: ${theme}`}
    >
      {getIcon()}
    </button>
  )
}

