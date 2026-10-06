import {
  Cross1Icon,
  GearIcon,
  MagnifyingGlassIcon,
  ResetIcon,
} from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'

import { CombatSideState } from '@/combat/combat-side-state/combat-side-state'
import { getCombatMeta } from '@/combat/combat-state/phase-utils'
import {
  AbilitiesPanel,
  type AbilityFilterMode,
} from '@/components/abilities-panel'
import { BattleCard } from '@/components/battle-card'
import { useToast } from '@/components/toast'
import { ButtonIcon } from '@/components/ui/button-icon'
import { GlassCard } from '@/components/ui/glass-card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { UnitEditorMode } from '@/hooks/combat-setup/combat-setup'
import { useCombatSetup } from '@/hooks/use-combat-setup'
import type { Precision } from '@/hooks/use-settings'
import { useSimulation } from '@/hooks/use-simulation'
import { useUrlSync } from '@/hooks/use-url-sync'
import type { CombatSide, UnitBaseType } from '@/types'
import { getCombatResult } from '@/utils/get-combat-result'
import { getGameData } from '@/utils/get-game-data'
import { getPlanetReports } from '@/utils/get-planet-reports'

import { ButtonIconPlain } from '../ui/button-icon-plain'
import { Divider } from '../ui/divider'

import styles from './combat-simulator.module.css'

const FILTER_MODE_VALUES: readonly AbilityFilterMode[] = [
  'all',
  'same',
  'enabled',
]

const FILTER_OPTIONS: { value: AbilityFilterMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'same', label: 'Same mode' },
  { value: 'enabled', label: 'Enabled' },
]

function filterModeStorageKey(side: CombatSide): string {
  return `abilities-filter-mode-${side}`
}

function loadFilterMode(side: CombatSide): AbilityFilterMode {
  try {
    const raw = localStorage.getItem(filterModeStorageKey(side))
    if (raw && (FILTER_MODE_VALUES as readonly string[]).includes(raw)) {
      return raw as AbilityFilterMode
    }
  } catch {
    // ignore storage access errors
  }
  return 'same'
}

interface CombatSimulatorProps {
  className?: string
  precision: Precision
  preferredEditorMode: UnitEditorMode
  onEditorModePreferenceChange: (mode: UnitEditorMode) => void
}

export function CombatSimulator({
  className,
  precision,
  preferredEditorMode,
  onEditorModePreferenceChange,
}: CombatSimulatorProps) {
  const {
    system,
    attackerFaction,
    defenderFaction,
    attackerSelections,
    defenderSelections,
    editorMode,
    surfaces,
    selectedPlanetId,
    surfaceSelections,
    combatMode,
    abilities,
    attackerConfig,
    defenderConfig,
    stateData,
    getReadContext,
    getAvailableAbilities,
    isUpgraded,
    simulationInput,
    serializedConfig,
    loadConfig,
    setSystem,
    setFaction,
    setUnitCount,
    setUpgraded,
    setAbilityParam,
    setCombatMode,
    setEditorMode,
    selectPlanet,
    addPlanet,
    removePlanet,
    reorderPlanets,
    setSurfaceUnitCount,
    resetUnits,
    resetAbilities,
    swap,
  } = useCombatSetup(preferredEditorMode)

  const { toast } = useToast()
  const loadUrlConfig = (config: Parameters<typeof loadConfig>[0]) => {
    const loadedEditorMode = loadConfig(config)
    onEditorModePreferenceChange(loadedEditorMode)
  }
  useUrlSync(serializedConfig, loadUrlConfig, toast)

  useEffect(() => {
    if (editorMode !== preferredEditorMode) {
      setEditorMode(preferredEditorMode)
    }
  }, [editorMode, preferredEditorMode, setEditorMode])

  const [attackerSheetOpen, setAttackerSheetOpen] = useState(false)
  const [defenderSheetOpen, setDefenderSheetOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState<Record<CombatSide, boolean>>({
    attacker: false,
    defender: false,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [attackerFilterMode, setAttackerFilterMode] =
    useState<AbilityFilterMode>(() => loadFilterMode('attacker'))
  const [defenderFilterMode, setDefenderFilterMode] =
    useState<AbilityFilterMode>(() => loadFilterMode('defender'))

  useEffect(() => {
    localStorage.setItem(filterModeStorageKey('attacker'), attackerFilterMode)
  }, [attackerFilterMode])
  useEffect(() => {
    localStorage.setItem(filterModeStorageKey('defender'), defenderFilterMode)
  }, [defenderFilterMode])

  const attackerSearchRef = useRef<HTMLInputElement>(null)
  const defenderSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen.attacker) attackerSearchRef.current?.focus()
  }, [searchOpen.attacker])
  useEffect(() => {
    if (searchOpen.defender) defenderSearchRef.current?.focus()
  }, [searchOpen.defender])

  const openSearch = (side: CombatSide) =>
    setSearchOpen(prev => ({ ...prev, [side]: true }))
  const closeSearch = (side: CombatSide) =>
    setSearchOpen(prev => {
      const next = { ...prev, [side]: false }
      if (!next.attacker && !next.defender) setSearchQuery('')
      return next
    })

  // Abilities move between slots as planets are added.
  const surfaceCount = surfaces.length
  const attackerAbilities = useMemo(
    () => getAvailableAbilities('attacker'),
    // oxlint-disable-next-line react/exhaustive-deps
    [system, attackerFaction, surfaceCount],
  )
  const defenderAbilities = useMemo(
    () => getAvailableAbilities('defender'),
    // oxlint-disable-next-line react/exhaustive-deps
    [system, defenderFaction, surfaceCount],
  )

  const attackerReadContext = useMemo(
    () => getReadContext('attacker'),
    // oxlint-disable-next-line react/exhaustive-deps
    [stateData],
  )
  const defenderReadContext = useMemo(
    () => getReadContext('defender'),
    // oxlint-disable-next-line react/exhaustive-deps
    [stateData],
  )

  const inputWithPrecision = useMemo(
    () => (simulationInput === null ? null : { ...simulationInput, precision }),
    [simulationInput, precision],
  )

  const { outcomes, isComputing } = useSimulation(inputWithPrecision)

  const unitPriority = useMemo(() => {
    const key =
      combatMode === 'GROUND' ? 'groundUnitPriority' : 'spaceUnitPriority'
    const a = abilities.attacker['UNIT_PRIORITY']
    const d = abilities.defender['UNIT_PRIORITY']
    const flatten = (list: unknown): string[] =>
      Array.isArray(list) ? list.map(entry => entry[0]) : []
    return {
      attacker: flatten(a?.[key]),
      defender: flatten(d?.[key]),
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, [stateData])

  const participatingTypes = useMemo(() => {
    const read = (side: 'attacker' | 'defender'): string[] =>
      CombatSideState.getCategoryOptionTypes(
        stateData[side],
        combatMode === 'GROUND' ? 'GROUND_FORCES' : 'SHIPS',
        getCombatMeta(combatMode),
      )
    return { attacker: read('attacker'), defender: read('defender') }
    // oxlint-disable-next-line react/exhaustive-deps
  }, [stateData])

  const combatResult = useMemo(
    () => (outcomes ? getCombatResult(outcomes) : null),
    [outcomes],
  )
  const planetReports = useMemo(
    () => (outcomes ? getPlanetReports(outcomes, surfaces) : []),
    [outcomes, surfaces],
  )

  const handleUpgradeToggle = (side: CombatSide, unit: UnitBaseType) => {
    setUpgraded(side, unit, !isUpgraded(side, unit))
  }

  const renderAbilitiesHeader = (side: CombatSide, label: string) => (
    <div className={styles.header}>
      <div className={styles.headerRow}>
        {searchOpen[side] ? (
          <>
            <span className={styles.searchLeading}>
              <MagnifyingGlassIcon />
            </span>
            <input
              ref={side === 'attacker' ? attackerSearchRef : defenderSearchRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search abilities..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') closeSearch(side)
              }}
            />
            <div className={styles.titleActions}>
              <ButtonIconPlain
                type="button"
                onClick={() => closeSearch(side)}
                title="Close search"
              >
                <Cross1Icon />
              </ButtonIconPlain>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.title}>{label}</h2>
            <div className={styles.titleActions}>
              <ButtonIconPlain
                type="button"
                onClick={() => openSearch(side)}
                title="Search abilities"
              >
                <MagnifyingGlassIcon />
              </ButtonIconPlain>
              <ButtonIconPlain
                type="button"
                onClick={() => resetAbilities(side)}
                title={`Reset ${side} abilities to defaults`}
              >
                <ResetIcon />
              </ButtonIconPlain>
            </div>
          </>
        )}
      </div>
      <Divider />
    </div>
  )

  const attackerAbilitiesElement = (
    <div className={clsx(styles.abilities, 'theme-attacker')}>
      <div className={styles.scrollArea}>
        {renderAbilitiesHeader('attacker', 'Attacker Abilities')}
        <AbilitiesPanel
          abilities={attackerAbilities}
          slots={getGameData(system).slots}
          factionKey={attackerFaction}
          readContext={attackerReadContext}
          combatMode={combatMode}
          params={abilities.attacker}
          onParamsChange={(abilityName, params) =>
            setAbilityParam('attacker', abilityName, params)
          }
          searchQuery={searchQuery}
          filterMode={attackerFilterMode}
        />
      </div>
      <ToggleGroup
        className={styles.filterToggle}
        options={FILTER_OPTIONS}
        value={attackerFilterMode}
        onChange={setAttackerFilterMode}
      />
    </div>
  )

  const defenderAbilitiesElement = (
    <div className={clsx(styles.abilities, 'theme-defender')}>
      <div className={styles.scrollArea}>
        {renderAbilitiesHeader('defender', 'Defender Abilities')}
        <AbilitiesPanel
          abilities={defenderAbilities}
          slots={getGameData(system).slots}
          factionKey={defenderFaction}
          readContext={defenderReadContext}
          combatMode={combatMode}
          params={abilities.defender}
          onParamsChange={(abilityName, params) =>
            setAbilityParam('defender', abilityName, params)
          }
          searchQuery={searchQuery}
          filterMode={defenderFilterMode}
        />
      </div>
      <ToggleGroup
        className={styles.filterToggle}
        options={FILTER_OPTIONS}
        value={defenderFilterMode}
        onChange={setDefenderFilterMode}
      />
    </div>
  )

  return (
    <main className={clsx(styles.layout, className)}>
      {/* Left panel: Attacker abilities */}
      <GlassCard as="aside" className={clsx(styles.sidePanel)}>
        {attackerAbilitiesElement}
      </GlassCard>

      {/* Center column: Battle card */}
      <div className={styles.centerColumn}>
        <BattleCard
          system={system}
          onSystemChange={setSystem}
          attackerFaction={attackerFaction}
          defenderFaction={defenderFaction}
          attackerSelections={attackerSelections}
          defenderSelections={defenderSelections}
          editorMode={editorMode}
          surfaces={surfaces}
          selectedPlanetId={selectedPlanetId}
          surfaceSelections={surfaceSelections}
          attackerConfig={attackerConfig}
          defenderConfig={defenderConfig}
          combatResult={combatResult}
          outcomes={outcomes}
          planetReports={planetReports}
          unitPriority={unitPriority}
          participatingTypes={participatingTypes}
          isComputing={isComputing}
          combatMode={combatMode}
          onCombatModeChange={setCombatMode}
          onPlanetChange={selectPlanet}
          onAddPlanet={addPlanet}
          onRemovePlanet={removePlanet}
          onReorderPlanets={reorderPlanets}
          onFactionChange={setFaction}
          onSwap={swap}
          onUnitCountChange={setUnitCount}
          onSurfaceUnitCountChange={setSurfaceUnitCount}
          onUpgradeToggle={handleUpgradeToggle}
          onResetUnits={resetUnits}
          attackerActions={
            <ButtonIcon
              className={clsx(styles.gearButton, 'theme-attacker')}
              onClick={() => setAttackerSheetOpen(true)}
              title="Attacker abilities"
            >
              <GearIcon />
            </ButtonIcon>
          }
          defenderActions={
            <ButtonIcon
              className={clsx(styles.gearButton, 'theme-defender')}
              onClick={() => setDefenderSheetOpen(true)}
              title="Defender abilities"
            >
              <GearIcon />
            </ButtonIcon>
          }
        />
      </div>

      {/* Right panel: Defender abilities */}
      <GlassCard as="aside" className={clsx(styles.sidePanel)}>
        {defenderAbilitiesElement}
      </GlassCard>

      {/* Attacker abilities sheet (mobile) */}
      <Sheet open={attackerSheetOpen} onOpenChange={setAttackerSheetOpen}>
        <SheetContent side="left" className={styles.abilitiesSheet}>
          {attackerAbilitiesElement}
        </SheetContent>
      </Sheet>

      {/* Defender abilities sheet (mobile) */}
      <Sheet open={defenderSheetOpen} onOpenChange={setDefenderSheetOpen}>
        <SheetContent side="right" className={styles.abilitiesSheet}>
          {defenderAbilitiesElement}
        </SheetContent>
      </Sheet>
    </main>
  )
}
