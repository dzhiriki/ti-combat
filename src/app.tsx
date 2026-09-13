import { clsx } from 'clsx'
import { useEffect } from 'react'

import { CombatSimulator } from '@/components/combat-simulator'
import { SettingsPanel } from '@/components/settings-panel'
import { ShareButton } from '@/components/share-button'
import { ToastProvider } from '@/components/toast'
import { useSettings } from '@/hooks/use-settings'

import styles from './app.module.css'

function App() {
  const [settings, setSettings] = useSettings()

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark')
      return
    }
    if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark')
      return
    }
    // system
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    document.documentElement.classList.toggle('dark', mq.matches)
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings.theme])

  return (
    <ToastProvider>
      <div className={styles.root}>
        {/* Background layers */}
        <div className={styles.starfield} />
        <div className={styles.nebulaOverlay} />

        {/* Header */}
        <header className={clsx(styles.header, styles.animateFadeUp)}>
          <h1 className={styles.title}>
            <a href="/" className={styles.titleLink}>
              Twilight Imperium Combat Calculator
            </a>
          </h1>
          <SettingsPanel settings={settings} onSettingsChange={setSettings} />
          {import.meta.env.VITE_SHARE_ENABLED === 'true' && <ShareButton />}
        </header>

        {/* Combat simulator */}
        <CombatSimulator
          className={clsx(styles.animateFadeUp, styles.animateDelay100)}
          precision={settings.precision}
          preferredEditorMode={settings.editorMode}
          onEditorModePreferenceChange={editorMode =>
            setSettings({ ...settings, editorMode })
          }
        />
      </div>
    </ToastProvider>
  )
}

export default App
