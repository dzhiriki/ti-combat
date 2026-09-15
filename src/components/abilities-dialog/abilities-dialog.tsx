import {
  CheckCircledIcon,
  CrossCircledIcon,
  ReaderIcon,
} from '@radix-ui/react-icons'

import abilitiesAst from '@/../docs/abilities-list.md'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import type {
  AbilityEntry,
  Section,
  Subsection,
} from './utils/parse-abilities-md'
import { parseAbilitiesMd } from './utils/parse-abilities-md'

import styles from './abilities-dialog.module.css'

const abilitiesData = parseAbilitiesMd(abilitiesAst)

function StatusIcon({ done }: { done: boolean }) {
  return done ? (
    <CheckCircledIcon className={styles.iconDone} />
  ) : (
    <CrossCircledIcon className={styles.iconPending} />
  )
}

function AbilityRow({ ability }: { ability: AbilityEntry }) {
  return (
    <li className={`${styles.row} ${ability.done ? '' : styles.pending}`}>
      <StatusIcon done={ability.done} />
      <span className={styles.name}>{ability.name}</span>
      {ability.type && <span className={styles.type}>{ability.type}</span>}
      {ability.description && (
        <span className={styles.description}>
          {ability.description.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </span>
      )}
    </li>
  )
}

function FactionGroup({ subsection }: { subsection: Subsection }) {
  if (subsection.abilities.length === 0) return null
  return (
    <div className={styles.faction}>
      <h4 className={styles.factionTitle}>{subsection.title}</h4>
      <ul className={styles.list}>
        {subsection.abilities.map(a => (
          <AbilityRow key={a.name} ability={a} />
        ))}
      </ul>
    </div>
  )
}

function SectionBlock({ section }: { section: Section }) {
  const hasSubsections =
    section.subsections && section.subsections.some(s => s.abilities.length > 0)
  const hasAbilities = section.abilities && section.abilities.length > 0

  if (!hasSubsections && !hasAbilities) return null

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{section.title}</h3>
      {section.subsections?.map(sub => (
        <FactionGroup key={sub.title} subsection={sub} />
      ))}
      {section.abilities && (
        <ul className={styles.list}>
          {section.abilities.map(a => (
            <AbilityRow key={a.name} ability={a} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function AbilitiesDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={styles.trigger}>
          <ReaderIcon className={styles.triggerIcon} />
          View Supported Abilities
        </button>
      </DialogTrigger>
      <DialogContent className={styles.content}>
        <DialogTitle>Supported Abilities</DialogTitle>
        <div className={styles.body}>
          {abilitiesData.map(section => (
            <SectionBlock key={section.title} section={section} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
