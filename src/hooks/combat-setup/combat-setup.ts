import {
  AbilitiesEngine,
  type AbilityReadContext,
  type CombatMode,
  CombatState,
  type CombatStateData,
  createLookups,
  extractDefaults,
  getOpponentSide,
  type SideAbilitiesConfig,
} from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import type {
  CollectedAbility,
  CombatSide,
  GameSystem,
  SurfaceDefinition,
  SurfaceId,
  SurfaceUnitCounts,
  SurfaceUnitSelections,
  UnitBaseType,
  UnitIdList,
  UnitSelection,
} from '@/types'
import {
  createDefaultSurfaces,
  DEFAULT_PLANET_ID,
  SPACE_SURFACE_ID,
} from '@/types'
import { getFaction } from '@/utils/get-faction'
import { DEFAULT_GAME_SYSTEM, getGameData } from '@/utils/get-game-data'
import {
  buildUnitStatsMap,
  getSimulationUnitsOnSurfaces,
} from '@/utils/get-simulation-units'
import {
  getUnitConfig as buildUnitConfig,
  type UnitConfig,
} from '@/utils/get-unit-config'
import {
  collapseSurfaceCounts,
  createEmptySurfaceCounts,
  createEmptyUnitSelections,
  expandSimplifiedCounts,
  materializeSurfaceSelections,
  normalizeSurfaceCounts,
} from '@/utils/surface-placements'

import {
  applyAbilityPlacementOverrides,
  getAbilityPlacementOverrides,
} from './ability-placement'
import {
  initializeAbilityDefaults,
  reconcileAbilitiesConfig,
  type SideLookups,
} from './reconcile'
import {
  serializeAbilities,
  type SerializedConfig,
  serializeSurfaceCounts,
} from './serialization'
import type { SimulationInput } from './types'

export type UnitEditorMode = 'SIMPLIFIED' | 'FULL'

/**
 * Internal backing class for UI state management.
 * Manages unit selections, factions, abilities config, and reconciliation.
 * Not exported publicly — the hook is the API.
 */
export class CombatSetup {
  private _system: GameSystem
  private _attackerFaction: string
  private _defenderFaction: string
  private _editorMode: UnitEditorMode
  private _surfaces: SurfaceDefinition[]
  private _selectedPlanetId: SurfaceId
  private _surfaceCounts: Record<CombatSide, SurfaceUnitCounts>
  private _upgradedTypes: Record<CombatSide, Set<UnitBaseType>>
  private _surfaceSelectionCache: Partial<
    Record<
      CombatSide,
      {
        counts: SurfaceUnitCounts
        upgrades: ReadonlySet<UnitBaseType>
        value: SurfaceUnitSelections
      }
    >
  > = {}
  private _combatMode: CombatMode
  private _abilities: Record<CombatSide, SideAbilitiesConfig>
  private _sideRegistered!: Record<CombatSide, CollectedAbility[]>
  private _lookups!: SideLookups
  private _unitAbilityKeys: Record<CombatSide, ReadonlySet<string>>
  private _factionOwnedKeys: Record<CombatSide, ReadonlySet<string>>
  private _stateData: CombatStateData
  private _engine: AbilitiesEngine

  constructor(editorMode: UnitEditorMode = 'SIMPLIFIED') {
    this._system = DEFAULT_GAME_SYSTEM
    const defaultFaction = getGameData(this._system).defaultFaction
    const defaultUnitStats = buildUnitStatsMap(this._system, defaultFaction)

    this._attackerFaction = defaultFaction
    this._defenderFaction = defaultFaction

    this._editorMode = editorMode
    this._surfaces = createDefaultSurfaces()
    this._selectedPlanetId = DEFAULT_PLANET_ID
    this._surfaceCounts = {
      attacker: createEmptySurfaceCounts(this._surfaces),
      defender: createEmptySurfaceCounts(this._surfaces),
    }
    this._upgradedTypes = { attacker: new Set(), defender: new Set() }
    this._combatMode = 'SPACE'
    this._abilities = { attacker: {}, defender: {} }

    const gameData = getGameData(this._system)
    const attackerRegistered = gameData.getAvailableAbilities(
      'attacker',
      defaultFaction,
      this.getUpgradedTypes('attacker'),
    )
    const defenderRegistered = gameData.getAvailableAbilities(
      'defender',
      defaultFaction,
      this.getUpgradedTypes('defender'),
    )
    this._sideRegistered = {
      attacker: attackerRegistered,
      defender: defenderRegistered,
    }
    this._lookups = createLookups(this._sideRegistered)
    this._unitAbilityKeys = {
      attacker: gameData.getUnitDefinitionAbilityKeys(defaultFaction),
      defender: gameData.getUnitDefinitionAbilityKeys(defaultFaction),
    }
    this._factionOwnedKeys = {
      attacker: gameData.getFactionOwnedAbilityKeys(defaultFaction),
      defender: gameData.getFactionOwnedAbilityKeys(defaultFaction),
    }

    this._stateData = {
      attacker: {
        faction: defaultFaction,
        participatingUnits: '' as UnitIdList,
        nonParticipatingUnits: '' as UnitIdList,

        unitSurface: {},
        unitType: {},
        unitState: {},
        unitStats: defaultUnitStats,
        abilities: this._abilities.attacker,
        liveAbilities: {},
      },
      defender: {
        faction: defaultFaction,
        participatingUnits: '' as UnitIdList,
        nonParticipatingUnits: '' as UnitIdList,

        unitSurface: {},
        unitType: {},
        unitState: {},
        unitStats: defaultUnitStats,
        abilities: this._abilities.defender,
        liveAbilities: {},
      },
      combatMode: 'SPACE',
      surfaces: this._surfaces,
      activeSurfaceId: SPACE_SURFACE_ID,
    }

    initializeAbilityDefaults(this._abilities, this._sideRegistered)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._stateData,
      this._lookups,
      undefined,
      true,
    )

    const wrapState = CombatState.fromDataStandalone(
      this._stateData,
      this._sideRegistered,
      this._unitAbilityKeys,
      this._factionOwnedKeys,
    )
    this._engine = AbilitiesEngine.wrap(
      wrapState,
      this._sideRegistered,
      this._unitAbilityKeys,
      this._factionOwnedKeys,
    )
  }

  // ── Read accessors ──────────────────────────────────────────────────

  get system(): GameSystem {
    return this._system
  }

  get attackerFaction(): string {
    return this._attackerFaction
  }

  get defenderFaction(): string {
    return this._defenderFaction
  }

  get attackerSelections(): Record<UnitBaseType, UnitSelection> {
    return this.flatSelections('attacker')
  }

  get defenderSelections(): Record<UnitBaseType, UnitSelection> {
    return this.flatSelections('defender')
  }

  get editorMode(): UnitEditorMode {
    return this._editorMode
  }

  get surfaces(): readonly SurfaceDefinition[] {
    return this._surfaces
  }

  get selectedPlanetId(): SurfaceId {
    return this._selectedPlanetId
  }

  get surfaceSelections(): Record<CombatSide, SurfaceUnitSelections> {
    return {
      attacker: this.surfaceSelectionsForSide('attacker'),
      defender: this.surfaceSelectionsForSide('defender'),
    }
  }

  get combatMode(): CombatMode {
    return this._combatMode
  }

  get abilities(): Record<CombatSide, SideAbilitiesConfig> {
    return this._abilities
  }

  get stateData(): CombatStateData {
    return this._stateData
  }

  getAvailableAbilities(side: CombatSide): CollectedAbility[] {
    return this._sideRegistered[side]
  }

  getReadContext(side: CombatSide): AbilityReadContext {
    return this._engine.context(side) as unknown as AbilityReadContext
  }

  getUnitConfig(side: CombatSide): Record<UnitBaseType, UnitConfig> {
    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    const result = buildUnitConfig(this._system, faction)
    const overrides = getAbilityPlacementOverrides(
      this._sideRegistered[side],
      this._abilities[side],
    )

    for (const [unitType, allowedSurfaces] of Object.entries(overrides)) {
      const type = unitType as UnitBaseType
      result[type] = { ...result[type], allowedSurfaces }
    }
    return result
  }

  // ── Mutations ──────────────────────────────────────────────────────

  /**
   * Switch game systems (TI4 ⇄ Twilight's Fall). Both sides always share a
   * system, so this resets both factions to the target system's default,
   * clears unit selections and abilities, and rebuilds from scratch.
   */
  setSystem(system: GameSystem): void {
    if (this._system === system) return
    this._system = system

    const faction = getGameData(system).defaultFaction

    this._surfaces = createDefaultSurfaces()
    this._selectedPlanetId = DEFAULT_PLANET_ID
    this._surfaceCounts = {
      attacker: createEmptySurfaceCounts(this._surfaces),
      defender: createEmptySurfaceCounts(this._surfaces),
    }
    this._upgradedTypes = { attacker: new Set(), defender: new Set() }

    // Drop all ability config so nothing carries across systems; setFaction
    // then repopulates each side with the new system's defaults.
    this._abilities = { attacker: {}, defender: {} }
    this._stateData = {
      ...this._stateData,
      attacker: {
        ...this._stateData.attacker,

        unitSurface: {},
        abilities: {},
      },
      defender: {
        ...this._stateData.defender,

        unitSurface: {},
        abilities: {},
      },
      surfaces: this._surfaces,
      activeSurfaceId:
        this._combatMode === 'SPACE'
          ? SPACE_SURFACE_ID
          : this._selectedPlanetId,
    }

    this.setFaction('attacker', faction)
    this.setFaction('defender', faction)
  }

  setFaction(side: CombatSide, faction: string): void {
    // Reject cross-system selections before changing any setup state.
    getFaction(this._system, faction)
    if (side === 'attacker') {
      this._attackerFaction = faction
    } else {
      this._defenderFaction = faction
    }

    const nextStats = buildUnitStatsMap(
      this._system,
      faction,
      this.getUpgradedTypes(side),
    )
    if (this._editorMode === 'SIMPLIFIED') this.reflowSimplified(side)
    this._surfaceCounts[side] = normalizeSurfaceCounts(
      this._surfaceCounts[side],
      this._surfaces,
      this._selectedPlanetId,
      side,
      nextStats,
    )

    // Reload abilities for the changed side
    const gameData = getGameData(this._system)
    const reg = gameData.getAvailableAbilities(
      side,
      faction,
      this.getUpgradedTypes(side),
    )
    this._sideRegistered[side] = reg
    this._lookups = createLookups(this._sideRegistered)
    this._unitAbilityKeys[side] = gameData.getUnitDefinitionAbilityKeys(faction)
    this._factionOwnedKeys[side] = gameData.getFactionOwnedAbilityKeys(faction)

    // Rebuild side config: keep existing params for surviving abilities,
    // initialize defaults for new ones
    const oldSideConfig = this._abilities[side]
    const newSideConfig: Record<string, Record<string, unknown>> = {}

    for (const ability of this._sideRegistered[side]) {
      const defaults = extractDefaults(ability)
      if (oldSideConfig[ability.key]) {
        newSideConfig[ability.key] = { ...oldSideConfig[ability.key] }
      } else if (defaults) {
        newSideConfig[ability.key] = { ...defaults }
      }
    }

    this._abilities[side] = newSideConfig
    this._stateData = {
      ...this._stateData,
      [side]: { ...this._stateData[side], abilities: newSideConfig },
    }

    // Rebuild unit data
    this.rebuildUnits(side, faction)

    // Reconcile
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._stateData,
      this._lookups,
      undefined,
      true,
    )
    this.rebuildEngine()
  }

  setUnitCount(side: CombatSide, unitType: UnitBaseType, count: number): void {
    const limit = UNIT_LIMITS[unitType]
    if (count > limit) {
      console.warn(`Unit limit exceeded: ${unitType} has a maximum of ${limit}`)
      count = limit
    }
    this.updateSelection(side, unitType, { count })
  }

  setUpgraded(
    side: CombatSide,
    unitType: UnitBaseType,
    upgraded: boolean,
  ): void {
    if (this._upgradedTypes[side].has(unitType) === upgraded) return
    const next = new Set(this._upgradedTypes[side])
    if (upgraded) next.add(unitType)
    else next.delete(unitType)
    this._upgradedTypes[side] = next
    if (this._editorMode === 'SIMPLIFIED') this.reflowSimplified(side)
    else this.normalizeSideCounts(side)
    this.refreshSideAfterUnitChange(side, true)
  }

  isUpgraded(side: CombatSide, unitType: UnitBaseType): boolean {
    return this._upgradedTypes[side].has(unitType)
  }

  setAbilityParam(
    side: CombatSide,
    abilityKey: string,
    params: Record<string, unknown>,
  ): void {
    const changesPlacement = this._sideRegistered[side].some(
      ability => ability.key === abilityKey && ability.unitPlacements?.length,
    )
    this.setParam(side, abilityKey, params)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._stateData,
      this._lookups,
      undefined,
      true,
    )
    if (changesPlacement) {
      if (this._editorMode === 'SIMPLIFIED') this.reflowSimplified(side)
      else this.normalizeSideCounts(side)
      const faction =
        side === 'attacker' ? this._attackerFaction : this._defenderFaction
      this.rebuildUnits(side, faction)
    }
    // Force new stateData reference so React memoization triggers
    this._stateData = { ...this._stateData }
    this.rebuildEngine()
  }

  setCombatMode(mode: CombatMode): void {
    this._combatMode = mode
    this._stateData = {
      ...this._stateData,
      combatMode: mode,
      activeSurfaceId:
        mode === 'SPACE' ? SPACE_SURFACE_ID : this._selectedPlanetId,
    }
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._stateData,
      this._lookups,
      undefined,
      true,
    )
    if (this._editorMode === 'SIMPLIFIED') {
      this.reflowSimplified('attacker')
      this.reflowSimplified('defender')
      this.rebuildAllUnits()
    } else {
      this.rebuildEngine()
    }
  }

  setEditorMode(mode: UnitEditorMode): void {
    if (mode === this._editorMode) return
    if (mode === 'SIMPLIFIED') {
      const totals = {
        attacker: this.flatSelections('attacker', true),
        defender: this.flatSelections('defender', true),
      }
      this._surfaces = createDefaultSurfaces()
      this._selectedPlanetId = DEFAULT_PLANET_ID
      this._surfaceCounts = {
        attacker: createEmptySurfaceCounts(this._surfaces),
        defender: createEmptySurfaceCounts(this._surfaces),
      }
      this._editorMode = mode
      this.reflowSimplified('attacker', totals.attacker)
      this.reflowSimplified('defender', totals.defender)
    } else {
      this._editorMode = mode
    }
    this.rebuildAllUnits()
  }

  selectPlanet(surfaceId: SurfaceId): void {
    if (this._editorMode !== 'FULL') return
    if (surfaceId === this._selectedPlanetId) return
    if (!this._surfaces.some(s => s.id === surfaceId && s.type === 'PLANET'))
      return
    this._selectedPlanetId = surfaceId
    this._stateData = {
      ...this._stateData,
      activeSurfaceId:
        this._combatMode === 'SPACE' ? SPACE_SURFACE_ID : surfaceId,
    }
    this.rebuildAllUnits()
  }

  addPlanet(): void {
    if (this._editorMode !== 'FULL') return
    const numbers = this._surfaces
      .filter(s => s.type === 'PLANET')
      .map(s => Number(s.id.replace('planet-', '')))
      .filter(Number.isFinite)
    const number = Math.max(0, ...numbers) + 1
    const id = `planet-${number}` as SurfaceId
    this._surfaces = [
      ...this._surfaces,
      { id, type: 'PLANET', name: `Planet ${number}` },
    ]
    for (const side of ['attacker', 'defender'] as const) {
      this._surfaceCounts[side] = {
        ...this._surfaceCounts[side],
        [id]: createEmptySurfaceCounts([this._surfaces.at(-1)!])[id],
      }
    }
    this._stateData = { ...this._stateData, surfaces: this._surfaces }
    this.selectPlanet(id)
  }

  removePlanet(surfaceId: SurfaceId): void {
    if (this._editorMode !== 'FULL') return
    const planets = this._surfaces.filter(s => s.type === 'PLANET')
    if (planets.length <= 1) return
    const hasUnits = (['attacker', 'defender'] as const).some(side =>
      Object.values(this._surfaceCounts[side][surfaceId] ?? {}).some(
        count => count > 0,
      ),
    )
    if (hasUnits) return
    this._surfaces = this._surfaces.filter(s => s.id !== surfaceId)
    for (const side of ['attacker', 'defender'] as const) {
      const next = { ...this._surfaceCounts[side] }
      delete next[surfaceId]
      this._surfaceCounts[side] = next
    }
    if (this._selectedPlanetId === surfaceId) {
      this._selectedPlanetId = this._surfaces.find(s => s.type === 'PLANET')!.id
    }
    this._stateData = {
      ...this._stateData,
      surfaces: this._surfaces,
      activeSurfaceId:
        this._combatMode === 'SPACE'
          ? SPACE_SURFACE_ID
          : this._selectedPlanetId,
    }
    this.rebuildAllUnits()
  }

  setSurfaceUnitCount(
    side: CombatSide,
    surfaceId: SurfaceId,
    unitType: UnitBaseType,
    count: number,
  ): void {
    if (this._editorMode !== 'FULL') return
    const surface = this._surfaceCounts[side][surfaceId]
    if (!surface) return
    let otherCount = 0
    for (const candidate of this._surfaces) {
      if (candidate.id === surfaceId) continue
      otherCount += this._surfaceCounts[side][candidate.id][unitType]
    }
    const nextCount = Math.min(
      Math.max(0, count),
      Math.max(0, UNIT_LIMITS[unitType] - otherCount),
    )
    this._surfaceCounts[side] = {
      ...this._surfaceCounts[side],
      [surfaceId]: {
        ...surface,
        [unitType]: nextCount,
      },
    }
    this.normalizeSideCounts(side)
    this.refreshSideAfterUnitChange(side, false)
  }

  resetUnits(side: CombatSide): void {
    this._surfaceCounts[side] = createEmptySurfaceCounts(this._surfaces)
    this._upgradedTypes[side] = new Set()

    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    this.rebuildUnits(side, faction)

    // Upgrades may have changed — recalculate available abilities
    const regReset = getGameData(this._system).getAvailableAbilities(
      side,
      faction,
      this.getUpgradedTypes(side),
    )
    this._sideRegistered[side] = regReset
    this._lookups = createLookups(this._sideRegistered)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._stateData,
      this._lookups,
      undefined,
      true,
    )
    this.rebuildEngine()
  }

  resetAbilities(side: CombatSide): void {
    this._abilities[side] = {}
    this._stateData = {
      ...this._stateData,
      [side]: { ...this._stateData[side], abilities: this._abilities[side] },
    }
    initializeAbilityDefaults(this._abilities, this._sideRegistered)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._stateData,
      this._lookups,
      undefined,
      true,
    )
    if (this._editorMode === 'SIMPLIFIED') {
      this.reflowSimplified(side)
    } else {
      this.normalizeSideCounts(side)
    }
    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    this.rebuildUnits(side, faction)
    // Force new stateData reference so React memoization triggers
    this._stateData = { ...this._stateData }
    this.rebuildEngine()
  }

  swap(): void {
    // Swap factions
    ;[this._attackerFaction, this._defenderFaction] = [
      this._defenderFaction,
      this._attackerFaction,
    ]

    // Swap placements and global upgrades
    ;[this._surfaceCounts.attacker, this._surfaceCounts.defender] = [
      this._surfaceCounts.defender,
      this._surfaceCounts.attacker,
    ]
    ;[this._upgradedTypes.attacker, this._upgradedTypes.defender] = [
      this._upgradedTypes.defender,
      this._upgradedTypes.attacker,
    ]

    // Swap abilities config
    this._abilities = {
      attacker: this._abilities.defender,
      defender: this._abilities.attacker,
    }

    // Rebuild stateData (each side's abilities travels with it)
    this._stateData = {
      ...this._stateData,
      attacker: this._stateData.defender,
      defender: this._stateData.attacker,
    }

    // Recompute available abilities for the swapped sides — `side`-restricted
    // abilities (e.g. attacker-only commanders) need re-filtering against the
    // new side. Swapping the cached lists alone leaks old entries through.
    const gameData = getGameData(this._system)
    const attackerRegistered = gameData.getAvailableAbilities(
      'attacker',
      this._attackerFaction,
      this.getUpgradedTypes('attacker'),
    )
    const defenderRegistered = gameData.getAvailableAbilities(
      'defender',
      this._defenderFaction,
      this.getUpgradedTypes('defender'),
    )
    this._sideRegistered = {
      attacker: attackerRegistered,
      defender: defenderRegistered,
    }
    this._lookups = createLookups(this._sideRegistered)
    this._unitAbilityKeys = {
      attacker: gameData.getUnitDefinitionAbilityKeys(this._attackerFaction),
      defender: gameData.getUnitDefinitionAbilityKeys(this._defenderFaction),
    }
    this._factionOwnedKeys = {
      attacker: gameData.getFactionOwnedAbilityKeys(this._attackerFaction),
      defender: gameData.getFactionOwnedAbilityKeys(this._defenderFaction),
    }

    // Rebuild units for both sides
    this.rebuildUnits('attacker', this._attackerFaction)
    this.rebuildUnits('defender', this._defenderFaction)

    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._stateData,
      this._lookups,
      undefined,
      true,
    )
    this.rebuildEngine()
  }

  toSimulationInput(): SimulationInput | null {
    const hasUnits = Object.values(this._surfaceCounts).some(counts =>
      Object.values(counts).some(byType =>
        Object.values(byType).some(count => count > 0),
      ),
    )
    if (!hasUnits) return null
    return {
      system: this._system,
      attackerFaction: this._attackerFaction,
      defenderFaction: this._defenderFaction,
      surfaces: this._surfaces,
      activeSurfaceId:
        this._combatMode === 'SPACE'
          ? SPACE_SURFACE_ID
          : this._selectedPlanetId,
      attackerPlacements: {
        counts: this._surfaceCounts.attacker,
        upgradedTypes: [...this._upgradedTypes.attacker],
      },
      defenderPlacements: {
        counts: this._surfaceCounts.defender,
        upgradedTypes: [...this._upgradedTypes.defender],
      },
      combatMode: this._combatMode,
      abilities: this._abilities,
    }
  }

  toSerializedConfig(): SerializedConfig {
    // Compute reconciled defaults to diff against — this captures
    // auto-populated values (declared params with source) so we only
    // store what the user actually changed
    const freshAbilities: Record<CombatSide, SideAbilitiesConfig> = {
      attacker: {},
      defender: {},
    }
    // Reconciliation writes derived option metadata onto the supplied side
    // state. Defaults must use the live unit data for limits, but serialization
    // must not replace the UI's metadata with categories from disabled defaults.
    const serializationState = {
      surfaces: this._surfaces,
      activeSurfaceId: this._stateData.activeSurfaceId,
      combatMode: this._combatMode,
      attacker: { ...this._stateData.attacker },
      defender: { ...this._stateData.defender },
    }
    initializeAbilityDefaults(freshAbilities, this._sideRegistered)
    reconcileAbilitiesConfig(
      freshAbilities,
      this._sideRegistered,
      this._combatMode,
      serializationState,
      this._lookups,
      undefined,
      true,
    )

    return {
      v: 2,
      g: this._system,
      af: this._attackerFaction,
      df: this._defenderFaction,
      m: this._combatMode === 'SPACE' ? 'S' : 'G',
      e: this._editorMode === 'SIMPLIFIED' ? 'S' : 'F',
      p: this._surfaces
        .filter(surface => surface.type === 'PLANET')
        .map(surface => surface.id),
      sp: this._selectedPlanetId,
      asu: serializeSurfaceCounts(this._surfaceCounts.attacker),
      dsu: serializeSurfaceCounts(this._surfaceCounts.defender),
      aup: [...this._upgradedTypes.attacker],
      dup: [...this._upgradedTypes.defender],
      aa: serializeAbilities(this._abilities.attacker, freshAbilities.attacker),
      da: serializeAbilities(this._abilities.defender, freshAbilities.defender),
    }
  }

  loadConfig(config: SerializedConfig): void {
    const af = config.af
    const df = config.df

    // URL validation normalizes legacy links before they reach this method.
    // Reject inconsistent direct callers before mutating the current setup.
    getFaction(config.g, af)
    getFaction(config.g, df)
    this._system = config.g
    this._attackerFaction = af
    this._defenderFaction = df
    this._combatMode = config.m === 'S' ? 'SPACE' : 'GROUND'
    const planetIds =
      config.v === 2 && config.p.length ? config.p : [DEFAULT_PLANET_ID]
    this._surfaces = [
      { id: SPACE_SURFACE_ID, type: 'SPACE', name: 'Space' },
      ...planetIds.map((id, index) => ({
        id: id as SurfaceId,
        type: 'PLANET' as const,
        name: `Planet ${index + 1}`,
      })),
    ]
    this._selectedPlanetId =
      config.v === 2 && planetIds.includes(config.sp)
        ? (config.sp as SurfaceId)
        : (planetIds[0] as SurfaceId)
    this._editorMode =
      config.v === 2 && config.e === 'F' ? 'FULL' : 'SIMPLIFIED'

    this._surfaceCounts = {
      attacker: createEmptySurfaceCounts(this._surfaces),
      defender: createEmptySurfaceCounts(this._surfaces),
    }
    this._upgradedTypes = { attacker: new Set(), defender: new Set() }
    let simplifiedTotals:
      | Record<CombatSide, Record<UnitBaseType, UnitSelection>>
      | undefined
    if (config.v === 1) {
      simplifiedTotals = {
        attacker: createEmptyUnitSelections(),
        defender: createEmptyUnitSelections(),
      }
      for (const side of ['attacker', 'defender'] as const) {
        const source = side === 'attacker' ? config.au : config.du
        const upgrades = new Set<UnitBaseType>()
        for (const [type, [count, upgraded]] of Object.entries(source)) {
          if (!Object.hasOwn(simplifiedTotals[side], type)) continue
          const unitType = type as UnitBaseType
          simplifiedTotals[side][unitType] = { count, upgraded: upgraded === 1 }
          if (upgraded) upgrades.add(unitType)
        }
        this._upgradedTypes[side] = upgrades
      }
      if (
        typeof config.aa.TF_STARLANCER_XI?.mechsOnGround === 'number' ||
        typeof config.da.TF_STARLANCER_XI?.mechsOnGround === 'number'
      )
        this._editorMode = 'FULL'
    } else {
      for (const side of ['attacker', 'defender'] as const) {
        const source = side === 'attacker' ? config.asu : config.dsu
        for (const surface of this._surfaces) {
          for (const [type, count] of Object.entries(
            source[surface.id] ?? {},
          )) {
            if (Object.hasOwn(this._surfaceCounts[side][surface.id], type)) {
              this._surfaceCounts[side][surface.id][type as UnitBaseType] =
                count
            }
          }
        }
        this._upgradedTypes[side] = new Set(
          side === 'attacker' ? config.aup : config.dup,
        )
      }
      if (this._editorMode === 'SIMPLIFIED') {
        const totals = {
          attacker: this.flatSelections('attacker', true),
          defender: this.flatSelections('defender', true),
        }
        this._surfaces = createDefaultSurfaces()
        this._selectedPlanetId = DEFAULT_PLANET_ID
        this._surfaceCounts = {
          attacker: createEmptySurfaceCounts(this._surfaces),
          defender: createEmptySurfaceCounts(this._surfaces),
        }
        // Reflow after abilities are registered below.
        simplifiedTotals = totals
      }
    }

    // Rebuild abilities for new factions
    const gameData = getGameData(this._system)
    const attackerReg = gameData.getAvailableAbilities(
      'attacker',
      af,
      this.getUpgradedTypes('attacker'),
    )
    const defenderReg = gameData.getAvailableAbilities(
      'defender',
      df,
      this.getUpgradedTypes('defender'),
    )
    this._sideRegistered = {
      attacker: attackerReg,
      defender: defenderReg,
    }
    this._lookups = createLookups(this._sideRegistered)
    this._unitAbilityKeys = {
      attacker: gameData.getUnitDefinitionAbilityKeys(af),
      defender: gameData.getUnitDefinitionAbilityKeys(df),
    }
    this._factionOwnedKeys = {
      attacker: gameData.getFactionOwnedAbilityKeys(af),
      defender: gameData.getFactionOwnedAbilityKeys(df),
    }

    // Apply saved differences to static defaults. The final reconciliation
    // runs after placements and state data are rebuilt.
    this._abilities = { attacker: {}, defender: {} }
    initializeAbilityDefaults(this._abilities, this._sideRegistered)
    for (const [key, params] of Object.entries(config.aa)) {
      if (this._abilities.attacker[key]) {
        this._abilities.attacker[key] = {
          ...this._abilities.attacker[key],
          ...params,
        }
      }
    }
    for (const [key, params] of Object.entries(config.da)) {
      if (this._abilities.defender[key]) {
        this._abilities.defender[key] = {
          ...this._abilities.defender[key],
          ...params,
        }
      }
    }

    if (simplifiedTotals) {
      this.reflowSimplified('attacker', simplifiedTotals.attacker)
      this.reflowSimplified('defender', simplifiedTotals.defender)
    }
    if (config.v === 1) {
      this.migrateLegacyStarlancerPlacement('attacker', config.aa)
      this.migrateLegacyStarlancerPlacement('defender', config.da)
    }
    this.normalizeSideCounts('attacker')
    this.normalizeSideCounts('defender')

    // Rebuild units for both sides
    this.rebuildUnits('attacker', af)
    this.rebuildUnits('defender', df)

    // Rebuild stateData references
    this._stateData = {
      ...this._stateData,
      attacker: {
        ...this._stateData.attacker,
        abilities: this._abilities.attacker,
      },
      defender: {
        ...this._stateData.defender,
        abilities: this._abilities.defender,
      },
      combatMode: this._combatMode,
      surfaces: this._surfaces,
      activeSurfaceId:
        this._combatMode === 'SPACE'
          ? SPACE_SURFACE_ID
          : this._selectedPlanetId,
    }

    // Final reconcile and engine rebuild
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._stateData,
      this._lookups,
      undefined,
      true,
    )
    this.rebuildEngine()
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private flatSelections(
    side: CombatSide,
    allSurfaces = false,
  ): Record<UnitBaseType, UnitSelection> {
    const ids =
      allSurfaces || this._editorMode === 'SIMPLIFIED'
        ? this._surfaces.map(surface => surface.id)
        : [SPACE_SURFACE_ID, this._selectedPlanetId]
    return collapseSurfaceCounts(
      this._surfaceCounts[side],
      this._upgradedTypes[side],
      ids,
    )
  }

  private surfaceSelectionsForSide(side: CombatSide): SurfaceUnitSelections {
    const counts = this._surfaceCounts[side]
    const upgrades = this._upgradedTypes[side]
    const cached = this._surfaceSelectionCache[side]
    if (cached?.counts === counts && cached.upgrades === upgrades)
      return cached.value
    const value = materializeSurfaceSelections(counts, upgrades)
    this._surfaceSelectionCache[side] = { counts, upgrades, value }
    return value
  }

  private getUpgradedTypes(side: CombatSide): Set<UnitBaseType> {
    return this._upgradedTypes[side]
  }

  private reflowSimplified(
    side: CombatSide,
    totals = this.flatSelections(side, true),
  ): void {
    this._surfaceCounts[side] = expandSimplifiedCounts(
      this._surfaceCounts[side],
      totals,
      this._surfaces,
      SPACE_SURFACE_ID,
      this._selectedPlanetId,
      side,
      this.getPlacementUnitStats(side),
      this._combatMode,
    )
  }

  private normalizeSideCounts(side: CombatSide): void {
    this._surfaceCounts[side] = normalizeSurfaceCounts(
      this._surfaceCounts[side],
      this._surfaces,
      this._selectedPlanetId,
      side,
      this.getPlacementUnitStats(side),
    )
  }

  private getPlacementUnitStats(
    side: CombatSide,
    nativeStats?: ReturnType<typeof buildUnitStatsMap>,
  ) {
    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    return applyAbilityPlacementOverrides(
      nativeStats ??
        buildUnitStatsMap(this._system, faction, this.getUpgradedTypes(side)),
      this._sideRegistered[side],
      this._abilities[side],
    )
  }

  private migrateLegacyStarlancerPlacement(
    side: CombatSide,
    abilities: Record<string, Record<string, unknown>>,
  ): boolean {
    const raw = abilities['TF_STARLANCER_XI']?.mechsOnGround
    if (typeof raw !== 'number' || raw < 0) return false
    const placements = this._surfaceCounts[side]
    const total = this._surfaces.reduce(
      (sum, surface) => sum + placements[surface.id].MECH,
      0,
    )
    const ground = Math.min(total, Math.max(0, Math.floor(raw)))
    const next = Object.fromEntries(
      Object.entries(placements).map(([id, counts]) => [
        id,
        { ...counts, MECH: 0 },
      ]),
    ) as SurfaceUnitCounts
    next[SPACE_SURFACE_ID].MECH = total - ground
    next[this._selectedPlanetId].MECH = ground
    this._surfaceCounts[side] = next
    return true
  }

  private updateSelection(
    side: CombatSide,
    unitType: UnitBaseType,
    update: Partial<UnitSelection>,
  ): void {
    const totals = this.flatSelections(side, true)
    const oldUpgrade = this._upgradedTypes[side].has(unitType)
    totals[unitType] = { ...totals[unitType], ...update }
    if (update.upgraded !== undefined && update.upgraded !== oldUpgrade) {
      const next = new Set(this._upgradedTypes[side])
      if (update.upgraded) next.add(unitType)
      else next.delete(unitType)
      this._upgradedTypes[side] = next
    }
    this.reflowSimplified(side, totals)
    this.refreshSideAfterUnitChange(
      side,
      update.upgraded !== undefined && update.upgraded !== oldUpgrade,
    )
  }

  private rebuildUnits(side: CombatSide, faction: string): void {
    const gen: { _nextCode?: number } = {
      _nextCode: this._stateData._nextCode,
    }
    const nativeStats = buildUnitStatsMap(
      this._system,
      faction,
      this._upgradedTypes[side],
    )
    const { units, unitType, unitState, unitStats, unitSurface } =
      getSimulationUnitsOnSurfaces(
        this._system,
        faction,
        {
          counts: this._surfaceCounts[side],
          upgradedTypes: [...this._upgradedTypes[side]],
        },
        this._surfaces,
        gen,
        this.getPlacementUnitStats(side, nativeStats),
        nativeStats,
      )
    this._stateData = {
      ...this._stateData,
      [side]: {
        ...this._stateData[side],
        faction,
        participatingUnits: units,
        nonParticipatingUnits: '' as UnitIdList,
        unitSurface,
        unitType,
        unitState,
        unitStats: { ...nativeStats, ...unitStats },
      },
      _nextCode: gen._nextCode,
      surfaces: this._surfaces,
      activeSurfaceId:
        this._combatMode === 'SPACE'
          ? SPACE_SURFACE_ID
          : this._selectedPlanetId,
    }
  }

  private refreshSideAfterUnitChange(
    side: CombatSide,
    upgradeChanged: boolean,
  ): void {
    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    this.rebuildUnits(side, faction)
    if (upgradeChanged) {
      this._sideRegistered[side] = getGameData(
        this._system,
      ).getAvailableAbilities(side, faction, this.getUpgradedTypes(side))
      this._lookups = createLookups(this._sideRegistered)
    }
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._stateData,
      this._lookups,
      undefined,
      true,
    )
    this.rebuildEngine()
  }

  private rebuildAllUnits(): void {
    this.rebuildUnits('attacker', this._attackerFaction)
    this.rebuildUnits('defender', this._defenderFaction)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._stateData,
      this._lookups,
      undefined,
      true,
    )
    this.rebuildEngine()
  }

  private setParam(
    side: CombatSide,
    abilityKey: string,
    params: Record<string, unknown>,
  ): void {
    const ability = this._sideRegistered[side].find(a => a.key === abilityKey)

    let finalParams = params
    if (ability?.onParamSet) {
      const oldParams = this._abilities[side][abilityKey]
      if (oldParams) {
        const ctx = { abilities: this._lookups[side], this: ability }
        for (const key of Object.keys(params)) {
          if (params[key] !== oldParams[key]) {
            finalParams =
              ability.onParamSet(finalParams, key, params[key], ctx) ??
              finalParams
          }
        }
      }
    }

    const newSideConfig = {
      ...this._abilities[side],
      [abilityKey]: finalParams,
    }

    // Mutual exclusion: disable other abilities in the same exclusive group
    if (ability?.exclusiveGroup && finalParams.isEnabled) {
      for (const other of this._sideRegistered[side]) {
        if (other.key === abilityKey) continue
        if (other.exclusiveGroup !== ability.exclusiveGroup) continue
        const otherParams = newSideConfig[other.key]
        if (otherParams) {
          newSideConfig[other.key] = {
            ...otherParams,
            isEnabled: false,
          }
        }
      }
    }

    this._abilities[side] = newSideConfig
    this._stateData = {
      ...this._stateData,
      [side]: { ...this._stateData[side], abilities: newSideConfig },
    }

    if (ability?.sync) {
      const otherSide = getOpponentSide(side)
      this._abilities[otherSide] = {
        ...this._abilities[otherSide],
        [abilityKey]: finalParams,
      }
      this._stateData = {
        ...this._stateData,
        [otherSide]: {
          ...this._stateData[otherSide],
          abilities: this._abilities[otherSide],
        },
      }
    }
  }

  private rebuildEngine(): void {
    const wrapState = CombatState.fromData(this._stateData, this._engine)
    this._engine = AbilitiesEngine.wrap(
      wrapState,
      this._sideRegistered,
      this._unitAbilityKeys,
      this._factionOwnedKeys,
    )
  }
}
