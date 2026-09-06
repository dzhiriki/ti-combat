import {
  Cross1Icon,
  GearIcon,
  MagnifyingGlassIcon,
  ResetIcon,
} from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  AbilitiesPanel,
  type AbilityFilterMode,
} from '@/components/abilities-panel'
import { BattleCard } from '@/components/battle-card'
import { ImportDialog } from '@/components/import-dialog'
import { useToast } from '@/components/toast'
import { ButtonIcon } from '@/components/ui/button-icon'
import { GlassCard } from '@/components/ui/glass-card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { useCombatSetup } from '@/hooks/use-combat-setup'
import type { Precision } from '@/hooks/use-settings'
import { useSimulation } from '@/hooks/use-simulation'
import { useUrlSync } from '@/hooks/use-url-sync'
import type { CombatSide, UnitBaseType } from '@/types'
import { getUnitConfig } from '@/utils/get-unit-config'

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
}

export function CombatSimulator({
  className,
  precision,
}: CombatSimulatorProps) {
  const {
    system,
    attackerFaction,
    defenderFaction,
    attackerSelections,
    defenderSelections,
    combatMode,
    abilities,
    stateData,
    getReadContext,
    getAvailableAbilities,
    isUpgraded,
    simulationInput,
    serializedConfig,
    loadConfig,
    allAbilities,
    setSystem,
    setFaction,
    setUnitCount,
    setUpgraded,
    setAbilityParam,
    setCombatMode,
    resetUnits,
    resetAbilities,
    swap,
  } = useCombatSetup()

  const { toast } = useToast()
  useUrlSync(serializedConfig, loadConfig, allAbilities, toast)

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

  const attackerConfig = useMemo(
    () => getUnitConfig(attackerFaction),
    [attackerFaction],
  )
  const defenderConfig = useMemo(
    () => getUnitConfig(defenderFaction),
    [defenderFaction],
  )

  const attackerAbilities = useMemo(
    () => getAvailableAbilities('attacker'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attackerFaction],
  )
  const defenderAbilities = useMemo(
    () => getAvailableAbilities('defender'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defenderFaction],
  )

  const attackerReadContext = useMemo(
    () => getReadContext('attacker'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateData],
  )
  const defenderReadContext = useMemo(
    () => getReadContext('defender'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateData])

  const participatingTypes = useMemo(() => {
    const key =
      combatMode === 'GROUND'
        ? 'groundCombatParticipating'
        : 'spaceCombatParticipating'
    const read = (side: 'attacker' | 'defender'): string[] => {
      const list = abilities[side]['SETTINGS']?.[key]
      return Array.isArray(list) ? (list as string[]) : []
    }
    return { attacker: read('attacker'), defender: read('defender') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateData])

  const combatResult = useMemo(() => {
    if (!outcomes) return null
    let attackerWin = 0
    let draw = 0
    let defenderWin = 0
    for (const o of outcomes) {
      switch (o.winner) {
        case 'attacker':
          attackerWin += o.probability
          break
        case 'defender':
          defenderWin += o.probability
          break
        case 'draw':
          draw += o.probability
          break
      }
    }
    return { attackerWin, draw, defenderWin }
  }, [outcomes])

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
          attackerConfig={attackerConfig}
          defenderConfig={defenderConfig}
          combatResult={combatResult}
          outcomes={outcomes}
          unitPriority={unitPriority}
          participatingTypes={participatingTypes}
          isComputing={isComputing}
          combatMode={combatMode}
          onCombatModeChange={setCombatMode}
          onFactionChange={setFaction}
          onSwap={swap}
          onUnitCountChange={setUnitCount}
          onUpgradeToggle={handleUpgradeToggle}
          onResetUnits={resetUnits}
          topActions={
            <ImportDialog allAbilities={allAbilities} onImport={loadConfig} />
          }
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
