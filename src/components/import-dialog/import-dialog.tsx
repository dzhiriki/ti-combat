import { DownloadIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { useMemo, useState } from 'react'

import {
  AsyncTi4Error,
  type BattleLocation,
  buildImportConfig,
  factionLabel,
  fetchGame,
  findActiveCombat,
  isMappedFaction,
  listBattleLocations,
  locationAreaLabel,
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
import { SystemMap } from './system-map'

interface ImportDialogProps {
  allAbilities: Ability[]
  onImport: (config: SerializedConfig) => void
}

function locationLabel(location: BattleLocation): string {
  const who = location.factions.map(factionLabel).join(' vs ')
  const suffix = location.isActiveCombat ? ' (in combat)' : ''
  return `${location.label} — ${who}${suffix}`
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
  const [selectedTile, setSelectedTile] = useState<string | null>(null)

  const locations = useMemo(
    () => (game ? listBattleLocations(game) : []),
    [game],
  )
  const location = locations.find(l => l.id === locationId)
  // Space first, then planets: an invasion is decided in orbit before it
  // reaches the ground, and it is the commoner pick.
  const tileLocations = locations
    .filter(l => l.tile === selectedTile)
    .sort((a, b) => {
      if (a.mode !== b.mode) return a.mode === 'SPACE' ? -1 : 1
      return (a.planet ?? '').localeCompare(b.planet ?? '')
    })

  /** Tapping a system selects it outright when there is only one place to
   *  fight there; otherwise its areas are listed to choose from. */
  function selectTile(tile: string): void {
    setSelectedTile(tile)
    const here = locations.filter(l => l.tile === tile)
    if (here.length === 1) selectLocation(here[0].id)
  }

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

  /** Fill the sides from the chosen location.
   *
   *  Whoever holds it is the defender — the import's job is to say what you
   *  would be attacking into, and the attacker's fleet is assembled by hand
   *  because it rarely comes from one place. A live combat is the exception:
   *  its participants are already ordered with the active player first. */
  function selectLocation(id: string): void {
    setLocationId(id)
    const tile = locations.find(l => l.id === id)?.tile
    if (tile) setSelectedTile(tile)
    const active = game ? findActiveCombat(game) : null
    if (active?.locationId === id && active.factions.length > 1) {
      const [first, second] = active.factions.filter(isMappedFaction)
      if (first) setAttacker(first)
      if (second) setDefender(second)
      return
    }
    const present = (locations.find(l => l.id === id)?.factions ?? []).filter(
      isMappedFaction,
    )
    if (present[0]) setDefender(present[0])
    if (present[1]) setAttacker(present[1])
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

      // `found` is already ordered likeliest-battle-first, so its head is the
      // best default. Sides come from the live combat's own participants when
      // there is one — a side can be in a fight without holding the location
      // (its space cannon fires from a planet it still owns).
      const target = found[0]
      const active = findActiveCombat(data)
      const inCombat =
        active?.locationId === target.id && active.factions.length > 1
      const sides = (inCombat ? active.factions : target.factions).filter(
        isMappedFaction,
      )
      // A live combat lists the active player first; anywhere else the side
      // standing there is the one being attacked.
      const [first, second] = inCombat ? sides : [sides[1], sides[0]]

      setLocationId(target.id)
      setSelectedTile(target.tile)
      setAttacker(first ?? second ?? '')
      setDefender(second ?? first ?? '')
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
          <button
            className={styles.loadButton}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Loading' : 'Load'}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}

        {game && location && (
          <>
            <p className={styles.meta}>
              {game.gameCustomName || game.gameName}
              {game.gameRound ? ` · round ${game.gameRound}` : ''}
            </p>

            <div className={clsx(styles.board, 'theme-defender')}>
              <SystemMap
                positions={Object.keys(game.tileUnitData)}
                locations={locations}
                ringCount={game.ringCount ?? 3}
                selectedTile={selectedTile}
                onSelectTile={selectTile}
              />

              {tileLocations.length > 0 && (
                <div className={styles.areas}>
                  {tileLocations.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      className={clsx(styles.area, {
                        // Space takes the full width: it is a different fight
                        // from the ground below it, not one planet among many.
                        [styles.area_space]: l.mode === 'SPACE',
                        [styles.area_selected]: l.id === locationId,
                      })}
                      onClick={() => selectLocation(l.id)}
                    >
                      <span className={styles.areaName}>
                        {locationAreaLabel(l)}
                        {l.isActiveCombat && (
                          <span className={styles.areaBadge}>in combat</span>
                        )}
                      </span>
                      <span className={styles.areaWho}>
                        {l.factions.length === 0
                          ? 'Unclaimed'
                          : l.factions.map(factionLabel).join(' vs ')}
                        {l.unitCount > 0
                          ? ` · ${l.unitCount} ${l.unitCount === 1 ? 'unit' : 'units'}`
                          : ' · no units'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className={styles.chosen}>
              {location ? locationLabel(location) : 'Pick a system above'}
            </p>

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

            <button
              className={styles.importButton}
              type="button"
              onClick={handleImport}
              disabled={!attacker || !defender}
            >
              Import battle
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
