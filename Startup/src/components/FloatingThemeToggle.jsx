import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import './floatingThemeToggle.css';

/**
 * FloatingThemeToggle Component
 * A prominent, floating pill at the bottom-left corner of the viewport.
 * Unmissable on any page, ensuring instant 1-click theme switching.
 */
export default function FloatingThemeToggle() {
  const { theme, setTheme } = useTheme();

  const isLight = theme === 'light' || 
    (theme === 'system' && typeof window !== 'undefined' && !window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    setTheme(isLight ? 'dark' : 'light');
  };

  return (
    <motion.button
      type="button"
      className={`floating-theme-pill ${isLight ? 'is-light' : 'is-dark'}`}
      onClick={toggleTheme}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
    >
      <div className="floating-theme-icon">
        <AnimatePresence mode="wait" initial={false}>
          {isLight ? (
            <motion.span
              key="sun"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              ☀️
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              🌙
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className="floating-theme-text">
        {isLight ? 'Dark Theme' : 'Light Theme'}
      </span>
    </motion.button>
  );
}
