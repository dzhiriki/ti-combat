import { LoopIcon, TrashIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

import type { CombatMode, CombatOutcome, CombatResult } from '@/combat'
import { ButtonIcon } from '@/components/ui/button-icon'
import { ButtonIconPlain } from '@/components/ui/button-icon-plain'
import { GlassCard } from '@/components/ui/glass-card'
import { ToggleGroup } from '@/components/ui/toggle-group'
import {
  GROUND_FORCES,
  SHIPS,
  STRUCTURES,
  UNIT_LIMITS,
  UNIT_PRICE,
} from '@/constants/units'
import type { UnitEditorMode } from '@/hooks/combat-setup/combat-setup'
import type {
  CombatSide,
  GameSystem,
  SurfaceDefinition,
  SurfaceId,
  SurfaceUnitSelections,
  UnitBaseType,
  UnitSelection,
} from '@/types'
import { GAME_SYSTEMS, getGameData } from '@/utils/get-game-data'
import type { PlanetReport } from '@/utils/get-planet-reports'
import type { UnitConfig } from '@/utils/get-unit-config'

import { Divider } from '../ui/divider'
import { CombatResultBar } from './components/combat-result-bar'
import { FactionSelect } from './components/faction-select'
import { PlanetTabs } from './components/planet-tabs'
import { type SideUnitControls, UnitRowDual } from './components/unit-row-dual'

import styles from './battle-card.module.css'

const UNITS = [
  {
    label: 'Ships',
    items: SHIPS,
  },
  {
    label: 'Ground Forces',
    items: GROUND_FORCES,
  },
  {
    label: 'Structures',
    items: STRUCTURES,
  },
]

const COMBAT_MODE_OPTIONS = [
  { value: 'SPACE' as const, label: 'Space Combat' },
  { value: 'GROUND' as const, label: 'Ground Combat' },
]

const SYSTEM_OPTIONS = GAME_SYSTEMS.map(system => ({
  value: system,
  label: getGameData(system).label,
}))

interface BattleCardProps {
  system: GameSystem
  onSystemChange: (system: GameSystem) => void
  attackerFaction: string
  defenderFaction: string
  attackerSelections: Record<UnitBaseType, UnitSelection>
  defenderSelections: Record<UnitBaseType, UnitSelection>
  editorMode: UnitEditorMode
  surfaces: readonly SurfaceDefinition[]
  selectedPlanetId: SurfaceId
  surfaceSelections: Record<CombatSide, SurfaceUnitSelections>
  attackerConfig: Record<UnitBaseType, UnitConfig>
  defenderConfig: Record<UnitBaseType, UnitConfig>
  combatResult: CombatResult | null
  outcomes: CombatOutcome[] | null
  /** One report per planet of a multi-planet invasion, else empty. */
  planetReports: PlanetReport[]
  unitPriority: { attacker: string[]; defender: string[] }
  participatingTypes: { attacker: string[]; defender: string[] }
  isComputing?: boolean
  combatMode: CombatMode
  onCombatModeChange: (mode: CombatMode) => void
  onPlanetChange: (surfaceId: SurfaceId) => void
  onAddPlanet: () => void
  onRemovePlanet: (surfaceId: SurfaceId) => void
  onReorderPlanets: (planetIds: SurfaceId[]) => void
  onFactionChange: (side: CombatSide, faction: string) => void
  onSwap: () => void
  onUnitCountChange: (
    side: CombatSide,
    unit: UnitBaseType,
    count: number,
  ) => void
  onSurfaceUnitCountChange: (
    side: CombatSide,
    surfaceId: SurfaceId,
    unit: UnitBaseType,
    count: number,
  ) => void
  onUpgradeToggle: (side: CombatSide, unit: UnitBaseType) => void
  onResetUnits: (side: CombatSide) => void
  attackerActions?: ReactNode
  defenderActions?: ReactNode
  className?: string
}

function getTotalPrice(selections: Record<UnitBaseType, UnitSelection>) {
  return Object.keys(selections).reduce(
    (acc, unitType) => acc + selections[unitType].count * UNIT_PRICE[unitType],
    0,
  )
}

function getTotalAmount(selections: Record<UnitBaseType, UnitSelection>) {
  return Object.values(selections).reduce((acc, item) => acc + item.count, 0)
}

export function BattleCard({
  system,
  onSystemChange,
  attackerFaction,
  defenderFaction,
  attackerSelections,
  defenderSelections,
  editorMode,
  surfaces,
  selectedPlanetId,
  surfaceSelections,
  attackerConfig,
  defenderConfig,
  combatResult,
  outcomes,
  planetReports,
  unitPriority,
  participatingTypes,
  isComputing,
  combatMode,
  onCombatModeChange,
  onPlanetChange,
  onAddPlanet,
  onRemovePlanet,
  onReorderPlanets,
  onFactionChange,
  onSwap,
  onUnitCountChange,
  onSurfaceUnitCountChange,
  onUpgradeToggle,
  onResetUnits,
  attackerActions,
  defenderActions,
  className,
}: BattleCardProps) {
  const space = surfaces.find(surface => surface.type === 'SPACE')!
  const planet = surfaces.find(surface => surface.id === selectedPlanetId)!
  const planets = surfaces.filter(surface => surface.type === 'PLANET')
  const multiPlanet = planetReports.length > 0

  const countOnOtherSurfaces = (
    side: CombatSide,
    surfaceId: SurfaceId,
    unitType: UnitBaseType,
  ) =>
    surfaces.reduce(
      (total, surface) =>
        surface.id === surfaceId
          ? total
          : total +
            (surfaceSelections[side][surface.id]?.[unitType]?.count ?? 0),
      0,
    )

  const renderUnitGroups = (
    attacker: Record<UnitBaseType, UnitSelection>,
    defender: Record<UnitBaseType, UnitSelection>,
    surface?: SurfaceDefinition,
  ) =>
    UNITS.map(({ label, items }) => {
      const visibleItems = surface
        ? items.filter(
            unitKey =>
              attackerConfig[unitKey].allowedSurfaces.includes(surface.type) ||
              defenderConfig[unitKey].allowedSurfaces.includes(surface.type),
          )
        : items
      if (visibleItems.length === 0) return null
      return (
        <section className={styles.unitGroup} key={label}>
          <header className={styles.unitGroupHeader}>
            <Divider className="theme-attacker" />
            <span className={styles.unitGroupTitle}>{label}</span>
            <Divider className="theme-defender" />
          </header>
          {visibleItems.map(unitKey => {
            const controls = (side: CombatSide): SideUnitControls => {
              const config = (
                side === 'attacker' ? attackerConfig : defenderConfig
              )[unitKey]
              return {
                ...(side === 'attacker' ? attacker : defender)[unitKey],
                hasUpgrade: config.hasUpgrade,
                limit: surface
                  ? UNIT_LIMITS[unitKey] -
                    countOnOtherSurfaces(side, surface.id, unitKey)
                  : UNIT_LIMITS[unitKey],
                disabled:
                  !!surface && !config.allowedSurfaces.includes(surface.type),
                onCountChange: count =>
                  surface
                    ? onSurfaceUnitCountChange(side, surface.id, unitKey, count)
                    : onUnitCountChange(side, unitKey, count),
                onUpgradeToggle: () => onUpgradeToggle(side, unitKey),
              }
            }
            return (
              <UnitRowDual
                key={unitKey}
                name={attackerConfig[unitKey].name}
                attacker={controls('attacker')}
                defender={controls('defender')}
              />
            )
          })}
        </section>
      )
    })

  return (
    <GlassCard as="section" className={clsx(styles.battleCard, className)}>
      <div className={styles.systemToggle}>
        <ToggleGroup<GameSystem>
          options={SYSTEM_OPTIONS}
          value={system}
          onChange={onSystemChange}
        />
      </div>

      <header className={styles.header}>
        {attackerActions && (
          <div className={styles.factionAction}>{attackerActions}</div>
        )}
        <div className={clsx(styles.factionSelector)}>
          <FactionSelect
            value={attackerFaction}
            system={system}
            onValueChange={faction => onFactionChange('attacker', faction)}
            className="theme-attacker"
          />
        </div>
        <ButtonIconPlain onClick={onSwap} title="Swap attacker and defender">
          <LoopIcon />
        </ButtonIconPlain>
        <div className={clsx(styles.factionSelector)}>
          <FactionSelect
            value={defenderFaction}
            system={system}
            onValueChange={faction => onFactionChange('defender', faction)}
            className="theme-defender"
            align="end"
          />
        </div>
        {defenderActions && (
          <div className={styles.factionAction}>{defenderActions}</div>
        )}
      </header>

      <div className={styles.unitRows}>
        {editorMode === 'SIMPLIFIED' ? (
          renderUnitGroups(attackerSelections, defenderSelections)
        ) : (
          <>
            <section className={styles.surfaceSection}>
              <h3 className={styles.surfaceTitle}>Space</h3>
              {renderUnitGroups(
                surfaceSelections.attacker[space.id],
                surfaceSelections.defender[space.id],
                space,
              )}
            </section>
            <section className={styles.surfaceSection}>
              <div className={styles.surfaceTitle}>
                <PlanetTabs
                  planets={planets}
                  selectedPlanetId={selectedPlanetId}
                  onSelect={onPlanetChange}
                  onAdd={onAddPlanet}
                  onRemove={onRemovePlanet}
                  onReorder={onReorderPlanets}
                />
              </div>
              {renderUnitGroups(
                surfaceSelections.attacker[planet.id],
                surfaceSelections.defender[planet.id],
                planet,
              )}
            </section>
          </>
        )}
      </div>

      <div className={styles.amounts}>
        <Divider className="theme-attacker" />
        <ButtonIcon
          className="theme-attacker"
          onClick={() => onResetUnits('attacker')}
          title="Reset attacker units"
        >
          <TrashIcon />
        </ButtonIcon>
        <p className={styles.amount}>{getTotalAmount(attackerSelections)}</p>
        <p className={styles.price}>${getTotalPrice(attackerSelections)}</p>
        <Divider className="theme-attacker" />
        <Divider className="theme-defender" />
        <p className={styles.price}>${getTotalPrice(defenderSelections)}</p>
        <p className={styles.amount}>{getTotalAmount(defenderSelections)}</p>
        <ButtonIcon
          className="theme-defender"
          onClick={() => onResetUnits('defender')}
          title="Reset defender units"
        >
          <TrashIcon />
        </ButtonIcon>
        <Divider className="theme-defender" />
      </div>

      <div className={styles.combatMode}>
        <Divider className="theme-attacker" />
        <ToggleGroup<CombatMode>
          options={COMBAT_MODE_OPTIONS}
          value={combatMode}
          onChange={onCombatModeChange}
        />
        <Divider className="theme-defender" />
      </div>

      <div className={styles.results}>
        <CombatResultBar
          title={multiPlanet ? 'All planets' : undefined}
          drawLabel={multiPlanet ? 'Mixed' : undefined}
          result={combatResult}
          outcomes={multiPlanet ? undefined : outcomes}
          unitPriority={unitPriority}
          participatingTypes={participatingTypes}
          surfaces={editorMode === 'FULL' ? surfaces : undefined}
          isComputing={isComputing}
        />
        {planetReports.map(report => (
          <CombatResultBar
            key={report.surface.id}
            title={report.surface.name}
            result={report.result}
            outcomes={report.outcomes}
            unitPriority={unitPriority}
            participatingTypes={participatingTypes}
            surfaces={[report.surface]}
            isComputing={isComputing}
          />
        ))}
      </div>
    </GlassCard>
  )
}
