import {
  GearIcon,
  QuestionMarkCircledIcon,
  ReaderIcon,
} from '@radix-ui/react-icons'
import { useId } from 'react'

import { ButtonIcon } from '@/components/ui/button-icon'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { Settings, Theme } from '@/hooks/use-settings'

import { Divider } from './ui/divider'
import { Tooltip } from './ui/tooltip'

import styles from './settings-panel.module.css'

const themeOptions = [
  { value: 'system' as const, label: 'System' },
  { value: 'dark' as const, label: 'Dark' },
  { value: 'light' as const, label: 'Light' },
]

type PrecisionKind = 'full' | 'limited'

const precisionOptions = [
  { value: 'full' as const, label: 'Full' },
  { value: 'limited' as const, label: 'Limited' },
]

interface SettingsPanelProps {
  settings: Settings
  onSettingsChange: (settings: Settings) => void
}

export function SettingsPanel({
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  const id = useId()
  const anchorName = `--${id}`
  const precisionKind = settings.precision.kind
  const precisionDigits = settings.precision.digits

  function setPrecisionKind(kind: PrecisionKind): void {
    onSettingsChange({
      ...settings,
      precision: { kind, digits: precisionDigits },
    })
  }

  function setDigits(digits: number): void {
    onSettingsChange({
      ...settings,
      precision: { kind: 'limited', digits },
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <ButtonIcon className={styles.button} title="Settings">
          <GearIcon />
        </ButtonIcon>
      </DialogTrigger>
      <DialogContent className={styles.content}>
        <DialogTitle>Settings</DialogTitle>
        <Divider />
        <section className={styles.section}>
          <span className={styles.label}>Theme</span>
          <ToggleGroup<Theme>
            options={themeOptions}
            value={settings.theme}
            onChange={theme => onSettingsChange({ ...settings, theme })}
          />
        </section>
        <section className={styles.section}>
          <span className={styles.label}>
            Dice Roll Precision
            <Tooltip
              anchor={anchorName}
              content={`
                With limited precision, dice result outcomes (in each round) that have a probability less than ${(10 ** -precisionDigits).toFixed(precisionDigits)} (1 being maximum) will be merged with the next possible outcome.
                That almost doesn't affect the total % distribution, even with the lowest value, and significantly improves performance. But removes some ultra-rare outcomes from the details screen.
                `}
            >
              <QuestionMarkCircledIcon
                style={{ anchorName }}
                className={styles.descriptionIcon}
              />
            </Tooltip>
          </span>
          <div className={styles.precisionControls}>
            <ToggleGroup<PrecisionKind>
              options={precisionOptions}
              value={precisionKind}
              onChange={setPrecisionKind}
            />
            <Input
              value={precisionDigits}
              onChange={setDigits}
              min={2}
              max={15}
              step={1}
              disabled={precisionKind !== 'limited'}
            />
          </div>
        </section>
        <Divider />
        <section>
          <p className={styles.description}>
            Source code is available on{' '}
            <a href="https://github.com/dzhiriki/ti-combat">GitHub</a>. Feel
            free to submit any issues. You can also contact me in{' '}
            <a href="https://discordapp.com/users/103507967441121280">
              Discord
            </a>
            , <a href="https://t.me/dzhiriki">Telegram</a> or by{' '}
            <a href="mailto:feedback@ticombat.com">email</a>.
          </p>
        </section>
        <div className={styles.section}>
          <a
            className={styles.abilitiesLink}
            href="https://github.com/dzhiriki/ti-combat/blob/main/docs/abilities-list.md"
            rel="noreferrer"
            target="_blank"
          >
            <ReaderIcon className={styles.abilitiesLinkIcon} />
            View Supported Abilities
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
