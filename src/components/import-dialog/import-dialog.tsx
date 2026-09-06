import { DownloadIcon } from '@radix-ui/react-icons'
import { useMemo, useState } from 'react'

import {
  AsyncTi4Error,
  type BattleLocation,
  buildImportConfig,
  factionLabel,
  fetchGame,
  isMappedFaction,
  listBattleLocations,
  parseGameId,
  type WebData,
} from '@/async-ti4'
import type { Ability } from '@/combat'
import { useToast } from '@/components/toast'
import { ButtonIcon } from '@/components/ui/button-icon'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'
import { buildAbilityLookup } from '@/hooks/combat-setup/validation'

import styles from './import-dialog.module.css'

interface ImportDialogProps {
  allAbilities: Ability[]
  onImport: (config: SerializedConfig) => void
}

function locationLabel(location: BattleLocation): string {
  const who = location.factions.map(factionLabel).join(' vs ')
  return `${location.label} — ${who}`
}

/** Pull a battle straight out of a live AsyncTI4 game: the units standing in a
 *  chosen system or planet, plus each side's researched technologies. */
export function ImportDialog({ allAbilities, onImport }: ImportDialogProps) {
  const { toast } = useToast()
  const abilityLookup = useMemo(
    () => buildAbilityLookup(allAbilities),
    [allAbilities],
  )

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [game, setGame] = useState<WebData | null>(null)
  const [locationId, setLocationId] = useState('')
  const [attacker, setAttacker] = useState('')
  const [defender, setDefender] = useState('')

  const locations = useMemo(
    () => (game ? listBattleLocations(game) : []),
    [game],
  )
  const location = locations.find(l => l.id === locationId)

  const players = useMemo(
    () =>
      (game?.playerData ?? [])
        .filter(player => isMappedFaction(player.faction))
        .map(player => ({
          value: player.faction,
          label: player.userName
            ? `${factionLabel(player.faction)} · ${player.userName}`
            : factionLabel(player.faction),
        })),
    [game],
  )

  /** Point both sides at whoever actually holds the chosen location, leaving
   *  any side it can't fill on its previous pick. */
  function selectLocation(id: string): void {
    setLocationId(id)
    const present = (locations.find(l => l.id === id)?.factions ?? []).filter(
      isMappedFaction,
    )
    if (present[0]) setAttacker(present[0])
    if (present[1]) setDefender(present[1])
  }

  async function handleLoad(): Promise<void> {
    const gameId = parseGameId(input)
    if (!gameId) {
      setError('Enter a game id or a link to one')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await fetchGame(gameId)
      const found = listBattleLocations(data)
      if (found.length === 0) {
        setError('That game has no units on the map yet')
        return
      }
      setGame(data)

      const first = found.find(
        l => l.factions.filter(isMappedFaction).length > 1,
      )
      const fallback = found[0]
      const present = (first ?? fallback).factions.filter(isMappedFaction)
      setLocationId((first ?? fallback).id)
      setAttacker(present[0] ?? '')
      setDefender(present[1] ?? present[0] ?? '')
    } catch (e) {
      setError(
        e instanceof AsyncTi4Error ? e.message : 'Could not load that game',
      )
      setGame(null)
    } finally {
      setLoading(false)
    }
  }

  function handleImport(): void {
    if (!game || !location) return
    try {
      const { config, notes } = buildImportConfig(
        game,
        { location, attacker, defender },
        abilityLookup,
      )
      onImport(config)
      setOpen(false)
      if (notes.length > 0) toast(notes.join('; '))
    } catch (e) {
      setError(e instanceof AsyncTi4Error ? e.message : 'Could not import that')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ButtonIcon title="Import from AsyncTI4">
          <DownloadIcon />
        </ButtonIcon>
      </DialogTrigger>
      <DialogContent className={styles.content}>
        <DialogTitle>Import from AsyncTI4</DialogTitle>

        <form
          className={styles.loadRow}
          onSubmit={e => {
            e.preventDefault()
            void handleLoad()
          }}
        >
          <input
            className={styles.textInput}
            type="text"
            value={input}
            placeholder="Game id or link"
            onChange={e => setInput(e.target.value)}
          />
          <ButtonIcon
            className={styles.loadButton}
            type="submit"
            isLoading={loading}
          >
            Load
          </ButtonIcon>
        </form>

        {error && <p className={styles.error}>{error}</p>}

        {game && location && (
          <>
            <p className={styles.meta}>
              {game.gameCustomName || game.gameName}
              {game.gameRound ? ` · round ${game.gameRound}` : ''}
            </p>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Battle</span>
              <Select value={locationId} onValueChange={selectLocation}>
                <SelectTrigger className={styles.select}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {locationLabel(l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Attacker</span>
              <Select value={attacker} onValueChange={setAttacker}>
                <SelectTrigger className={styles.select}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {players.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Defender</span>
              <Select value={defender} onValueChange={setDefender}>
                <SelectTrigger className={styles.select}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {players.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <p className={styles.hint}>
              Brings across the units standing there — damage and galvanize
              included — plus each side&rsquo;s researched technologies.
            </p>

            <ButtonIcon
              className={styles.importButton}
              onClick={handleImport}
              disabled={!attacker || !defender}
            >
              Import battle
            </ButtonIcon>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
