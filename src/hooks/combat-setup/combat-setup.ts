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
import { UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
import type {
  CollectedAbility,
  CombatSide,
  GameSystem,
  SurfaceDefinition,
  SurfaceId,
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
  collapseAllSurfaces,
  collapseVisibleSurfaces,
  createEmptySurfaceSelections,
  createEmptyUnitSelections,
  expandSimplifiedSelections,
  normalizeSurfaceSelections,
} from '@/utils/surface-placements'

import {
  initializeAbilityDefaults,
  reconcileAbilitiesConfig,
  type SideLookups,
  type SyncSnapshots,
} from './reconcile'
import {
  deserializeSurfaceUnits,
  serializeAbilities,
  type SerializedConfig,
  serializeSurfaceUnits,
  serializeUnits,
} from './serialization'
import type { SimulationInput } from './types'

function createDefaultUnitSelections(): Record<UnitBaseType, UnitSelection> {
  return createEmptyUnitSelections()
}

function createEmptySurfaceUnits(
  surfaces: readonly SurfaceDefinition[],
): Record<string, UnitIdList> {
  return Object.fromEntries(
    surfaces.map(surface => [surface.id, '' as UnitIdList]),
  )
}

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
  private _attackerSelections: Record<UnitBaseType, UnitSelection>
  private _defenderSelections: Record<UnitBaseType, UnitSelection>
  private _editorMode: UnitEditorMode
  private _surfaces: SurfaceDefinition[]
  private _selectedPlanetId: SurfaceId
  private _surfaceSelections: Record<CombatSide, SurfaceUnitSelections>
  private _combatMode: CombatMode
  private _abilities: Record<CombatSide, SideAbilitiesConfig>
  private _sideRegistered!: Record<CombatSide, CollectedAbility[]>
  private _lookups!: SideLookups
  private _unitAbilityKeys: Record<CombatSide, ReadonlySet<string>>
  private _factionOwnedKeys: Record<CombatSide, ReadonlySet<string>>
  private _stateData: CombatStateData
  private _engine: AbilitiesEngine
  private _syncSnapshots: SyncSnapshots = new Map()

  constructor(editorMode: UnitEditorMode = 'SIMPLIFIED') {
    this._system = DEFAULT_GAME_SYSTEM
    const defaultFaction = getGameData(this._system).defaultFaction
    const defaultUnitStats = buildUnitStatsMap(this._system, defaultFaction)

    this._attackerFaction = defaultFaction
    this._defenderFaction = defaultFaction
    this._attackerSelections = createDefaultUnitSelections()
    this._defenderSelections = createDefaultUnitSelections()
    this._editorMode = editorMode
    this._surfaces = createDefaultSurfaces()
    this._selectedPlanetId = DEFAULT_PLANET_ID
    this._surfaceSelections = {
      attacker: createEmptySurfaceSelections(this._surfaces),
      defender: createEmptySurfaceSelections(this._surfaces),
    }
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
        surfaceUnits: createEmptySurfaceUnits(this._surfaces),
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
        surfaceUnits: createEmptySurfaceUnits(this._surfaces),
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
      this._syncSnapshots,
      this._stateData,
      this._lookups,
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
    return this._editorMode === 'SIMPLIFIED'
      ? this._attackerSelections
      : collapseVisibleSurfaces(
          this._surfaceSelections.attacker,
          SPACE_SURFACE_ID,
          this._selectedPlanetId,
        )
  }

  get defenderSelections(): Record<UnitBaseType, UnitSelection> {
    return this._editorMode === 'SIMPLIFIED'
      ? this._defenderSelections
      : collapseVisibleSurfaces(
          this._surfaceSelections.defender,
          SPACE_SURFACE_ID,
          this._selectedPlanetId,
        )
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
    return this._surfaceSelections
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
    this._attackerSelections = createDefaultUnitSelections()
    this._defenderSelections = createDefaultUnitSelections()
    this._surfaces = createDefaultSurfaces()
    this._selectedPlanetId = DEFAULT_PLANET_ID
    this._surfaceSelections = {
      attacker: createEmptySurfaceSelections(this._surfaces),
      defender: createEmptySurfaceSelections(this._surfaces),
    }

    // Drop all ability config so nothing carries across systems; setFaction
    // then repopulates each side with the new system's defaults.
    this._abilities = { attacker: {}, defender: {} }
    this._stateData = {
      ...this._stateData,
      attacker: {
        ...this._stateData.attacker,
        surfaceUnits: createEmptySurfaceUnits(this._surfaces),
        unitSurface: {},
        abilities: {},
      },
      defender: {
        ...this._stateData.defender,
        surfaceUnits: createEmptySurfaceUnits(this._surfaces),
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
    this._surfaceSelections[side] = normalizeSurfaceSelections(
      this.effectivePlacements(side),
      this._surfaces,
      this._selectedPlanetId,
      side,
      nextStats,
    )
    if (this._editorMode === 'SIMPLIFIED') {
      const collapsed = collapseVisibleSurfaces(
        this._surfaceSelections[side],
        SPACE_SURFACE_ID,
        this._selectedPlanetId,
      )
      if (side === 'attacker') this._attackerSelections = collapsed
      else this._defenderSelections = collapsed
    }

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
      this._syncSnapshots,
      this._stateData,
      this._lookups,
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
    if (this._editorMode === 'FULL') {
      const placements = this._surfaceSelections[side]
      for (const surface of this._surfaces) {
        placements[surface.id][unitType] = {
          ...placements[surface.id][unitType],
          upgraded,
        }
      }
      const faction =
        side === 'attacker' ? this._attackerFaction : this._defenderFaction
      this._surfaceSelections[side] = normalizeSurfaceSelections(
        placements,
        this._surfaces,
        this._selectedPlanetId,
        side,
        buildUnitStatsMap(this._system, faction, this.getUpgradedTypes(side)),
      )
      this.refreshSideAfterUnitChange(side, true)
      return
    }
    this.updateSelection(side, unitType, { upgraded })
  }

  isUpgraded(side: CombatSide, unitType: UnitBaseType): boolean {
    if (this._editorMode === 'SIMPLIFIED') {
      return this.selectionsForSide(side)[unitType].upgraded
    }
    return this._surfaces.some(
      surface => this._surfaceSelections[side][surface.id][unitType].upgraded,
    )
  }

  setAbilityParam(
    side: CombatSide,
    abilityKey: string,
    params: Record<string, unknown>,
  ): void {
    this.setParam(side, abilityKey, params)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._syncSnapshots,
      this._stateData,
      this._lookups,
    )
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
      this._syncSnapshots,
      this._stateData,
      this._lookups,
    )
    this.rebuildEngine()
  }

  setEditorMode(mode: UnitEditorMode): void {
    if (mode === this._editorMode) return
    if (this._editorMode === 'SIMPLIFIED') {
      this.commitSimplifiedSelections('attacker')
      this.commitSimplifiedSelections('defender')
    } else {
      this._attackerSelections = collapseAllSurfaces(
        this._surfaceSelections.attacker,
      )
      this._defenderSelections = collapseAllSurfaces(
        this._surfaceSelections.defender,
      )
      this._surfaces = createDefaultSurfaces()
      this._selectedPlanetId = DEFAULT_PLANET_ID
      this._surfaceSelections = {
        attacker: createEmptySurfaceSelections(this._surfaces),
        defender: createEmptySurfaceSelections(this._surfaces),
      }
    }
    this._editorMode = mode
    if (mode === 'SIMPLIFIED') {
      this.commitSimplifiedSelections('attacker')
      this.commitSimplifiedSelections('defender')
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
      this._surfaceSelections[side] = {
        ...this._surfaceSelections[side],
        [id]: createDefaultUnitSelections(),
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
      Object.values(this._surfaceSelections[side][surfaceId] ?? {}).some(
        selection => selection.count > 0,
      ),
    )
    if (hasUnits) return
    this._surfaces = this._surfaces.filter(s => s.id !== surfaceId)
    for (const side of ['attacker', 'defender'] as const) {
      const next = { ...this._surfaceSelections[side] }
      delete next[surfaceId]
      this._surfaceSelections[side] = next
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
    const surface = this._surfaceSelections[side][surfaceId]
    if (!surface) return
    let otherCount = 0
    for (const candidate of this._surfaces) {
      if (candidate.id === surfaceId) continue
      otherCount += this._surfaceSelections[side][candidate.id][unitType].count
    }
    const nextCount = Math.min(
      Math.max(0, count),
      Math.max(0, UNIT_LIMITS[unitType] - otherCount),
    )
    this._surfaceSelections[side] = {
      ...this._surfaceSelections[side],
      [surfaceId]: {
        ...surface,
        [unitType]: { ...surface[unitType], count: nextCount },
      },
    }
    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    this._surfaceSelections[side] = normalizeSurfaceSelections(
      this._surfaceSelections[side],
      this._surfaces,
      this._selectedPlanetId,
      side,
      buildUnitStatsMap(this._system, faction, this.getUpgradedTypes(side)),
    )
    this.refreshSideAfterUnitChange(side, false)
  }

  resetUnits(side: CombatSide): void {
    const newSelections = createDefaultUnitSelections()
    if (side === 'attacker') {
      this._attackerSelections = newSelections
    } else {
      this._defenderSelections = newSelections
    }
    this._surfaceSelections[side] = createEmptySurfaceSelections(this._surfaces)

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
      this._syncSnapshots,
      this._stateData,
      this._lookups,
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
      this._syncSnapshots,
      this._stateData,
      this._lookups,
    )
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

    // Swap selections
    ;[this._attackerSelections, this._defenderSelections] = [
      this._defenderSelections,
      this._attackerSelections,
    ]
    ;[this._surfaceSelections.attacker, this._surfaceSelections.defender] = [
      this._surfaceSelections.defender,
      this._surfaceSelections.attacker,
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
      this._syncSnapshots,
      this._stateData,
      this._lookups,
    )
    this.rebuildEngine()
  }

  toSimulationInput(): SimulationInput | null {
    const attackerPlacements = this.effectivePlacements('attacker')
    const defenderPlacements = this.effectivePlacements('defender')
    const hasUnits = [attackerPlacements, defenderPlacements].some(placements =>
      Object.values(placements).some(selections =>
        Object.values(selections).some(selection => selection.count > 0),
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
      attackerPlacements,
      defenderPlacements,
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
    initializeAbilityDefaults(freshAbilities, this._sideRegistered)
    reconcileAbilitiesConfig(
      freshAbilities,
      this._sideRegistered,
      this._combatMode,
      undefined,
      this._stateData,
      this._lookups,
    )

    const attackerVisible =
      this._editorMode === 'SIMPLIFIED'
        ? this._attackerSelections
        : collapseVisibleSurfaces(
            this._surfaceSelections.attacker,
            SPACE_SURFACE_ID,
            this._selectedPlanetId,
          )
    const defenderVisible =
      this._editorMode === 'SIMPLIFIED'
        ? this._defenderSelections
        : collapseVisibleSurfaces(
            this._surfaceSelections.defender,
            SPACE_SURFACE_ID,
            this._selectedPlanetId,
          )

    return {
      v: 2,
      g: this._system,
      af: this._attackerFaction,
      df: this._defenderFaction,
      m: this._combatMode === 'SPACE' ? 'S' : 'G',
      au: serializeUnits(attackerVisible),
      du: serializeUnits(defenderVisible),
      e: this._editorMode === 'SIMPLIFIED' ? 'S' : 'F',
      p: this._surfaces
        .filter(surface => surface.type === 'PLANET')
        .map(surface => surface.id),
      sp: this._selectedPlanetId,
      asu: serializeSurfaceUnits(this.effectivePlacements('attacker')),
      dsu: serializeSurfaceUnits(this.effectivePlacements('defender')),
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
    const planetIds = config.p?.length ? config.p : [DEFAULT_PLANET_ID]
    this._surfaces = [
      { id: SPACE_SURFACE_ID, type: 'SPACE', name: 'Space' },
      ...planetIds.map((id, index) => ({
        id: id as SurfaceId,
        type: 'PLANET' as const,
        name: `Planet ${index + 1}`,
      })),
    ]
    this._selectedPlanetId = planetIds.includes(config.sp ?? '')
      ? (config.sp as SurfaceId)
      : (planetIds[0] as SurfaceId)
    this._editorMode = config.e === 'F' ? 'FULL' : 'SIMPLIFIED'

    // Set unit selections
    this._attackerSelections = createDefaultUnitSelections()
    this._defenderSelections = createDefaultUnitSelections()
    for (const [type, [count, upgraded]] of Object.entries(config.au)) {
      const ut = type as UnitBaseType
      if (this._attackerSelections[ut]) {
        this._attackerSelections[ut] = { count, upgraded: upgraded === 1 }
      }
    }
    for (const [type, [count, upgraded]] of Object.entries(config.du)) {
      const ut = type as UnitBaseType
      if (this._defenderSelections[ut]) {
        this._defenderSelections[ut] = { count, upgraded: upgraded === 1 }
      }
    }
    const surfaceIds = this._surfaces.map(surface => surface.id)
    this._surfaceSelections = {
      attacker: deserializeSurfaceUnits(config.asu, surfaceIds),
      defender: deserializeSurfaceUnits(config.dsu, surfaceIds),
    }
    if (!config.asu) this.commitSimplifiedSelections('attacker')
    if (!config.dsu) this.commitSimplifiedSelections('defender')
    if (config.v === 1) {
      const migratedAttacker = this.migrateLegacyStarlancerPlacement(
        'attacker',
        config.aa,
      )
      const migratedDefender = this.migrateLegacyStarlancerPlacement(
        'defender',
        config.da,
      )
      if (migratedAttacker || migratedDefender) this._editorMode = 'FULL'
    }
    if (this._editorMode === 'SIMPLIFIED') {
      if (config.asu) {
        this._attackerSelections = collapseAllSurfaces(
          this._surfaceSelections.attacker,
        )
      }
      if (config.dsu) {
        this._defenderSelections = collapseAllSurfaces(
          this._surfaceSelections.defender,
        )
      }
      this._surfaces = createDefaultSurfaces()
      this._selectedPlanetId = DEFAULT_PLANET_ID
      this._surfaceSelections = {
        attacker: createEmptySurfaceSelections(this._surfaces),
        defender: createEmptySurfaceSelections(this._surfaces),
      }
      this.commitSimplifiedSelections('attacker')
      this.commitSimplifiedSelections('defender')
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

    // Initialize ability defaults, reconcile, then apply URL overrides
    this._abilities = { attacker: {}, defender: {} }
    initializeAbilityDefaults(this._abilities, this._sideRegistered)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideRegistered,
      this._combatMode,
      this._syncSnapshots,
      this._stateData,
      this._lookups,
    )

    // Apply URL ability params on top of reconciled defaults
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

    for (const side of ['attacker', 'defender'] as const) {
      const faction = side === 'attacker' ? af : df
      this._surfaceSelections[side] = normalizeSurfaceSelections(
        this._surfaceSelections[side],
        this._surfaces,
        this._selectedPlanetId,
        side,
        buildUnitStatsMap(this._system, faction, this.getUpgradedTypes(side)),
      )
    }

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
      this._syncSnapshots,
      this._stateData,
      this._lookups,
    )
    this.rebuildEngine()
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private getUpgradedTypes(side: CombatSide): Set<UnitBaseType> {
    const set = new Set<UnitBaseType>()
    if (this._editorMode === 'SIMPLIFIED') {
      for (const [k, v] of Object.entries(this.selectionsForSide(side))) {
        if (v.upgraded) set.add(k as UnitBaseType)
      }
      return set
    }
    for (const surface of this._surfaces) {
      for (const [k, v] of Object.entries(
        this._surfaceSelections[side][surface.id],
      )) {
        if (v.upgraded) set.add(k as UnitBaseType)
      }
    }
    return set
  }

  private effectivePlacements(side: CombatSide): SurfaceUnitSelections {
    if (this._editorMode === 'FULL') return this._surfaceSelections[side]
    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    return expandSimplifiedSelections(
      this._surfaceSelections[side],
      this.selectionsForSide(side),
      this._surfaces,
      SPACE_SURFACE_ID,
      this._selectedPlanetId,
      side,
      buildUnitStatsMap(this._system, faction, this.getUpgradedTypes(side)),
    )
  }

  private commitSimplifiedSelections(side: CombatSide): void {
    this._surfaceSelections[side] = this.effectivePlacements(side)
  }

  private migrateLegacyStarlancerPlacement(
    side: CombatSide,
    abilities: Record<string, Record<string, unknown>>,
  ): boolean {
    const raw = abilities['TF_STARLANCER_XI']?.mechsOnGround
    if (typeof raw !== 'number' || raw < 0) return false
    const placements = this._surfaceSelections[side]
    const total = this._surfaces.reduce(
      (sum, surface) => sum + placements[surface.id].MECH.count,
      0,
    )
    const ground = Math.min(total, Math.max(0, Math.floor(raw)))
    for (const surface of this._surfaces) placements[surface.id].MECH.count = 0
    placements[SPACE_SURFACE_ID].MECH.count = total - ground
    placements[this._selectedPlanetId].MECH.count = ground
    return true
  }

  private selectionsForSide(
    side: CombatSide,
  ): Record<UnitBaseType, UnitSelection> {
    return side === 'attacker'
      ? this._attackerSelections
      : this._defenderSelections
  }

  private updateSelection(
    side: CombatSide,
    unitType: UnitBaseType,
    update: Partial<UnitSelection>,
  ): void {
    const selections = this.selectionsForSide(side)
    const upgradeChanged =
      'upgraded' in update && update.upgraded !== selections[unitType].upgraded
    const newSelections = {
      ...selections,
      [unitType]: { ...selections[unitType], ...update },
    }
    if (side === 'attacker') {
      this._attackerSelections = newSelections
    } else {
      this._defenderSelections = newSelections
    }
    this.commitSimplifiedSelections(side)
    this.refreshSideAfterUnitChange(side, upgradeChanged)
  }

  private rebuildUnits(side: CombatSide, faction: string): void {
    const placements = this.effectivePlacements(side)
    const upgradedSet = new Set(
      UNIT_TYPES.filter(t =>
        this._surfaces.some(
          surface => placements[surface.id]?.[t]?.upgraded === true,
        ),
      ),
    )
    const gen: { _nextCode?: number } = {
      _nextCode: this._stateData._nextCode,
    }
    const { units, unitType, unitState, unitStats, surfaceUnits, unitSurface } =
      getSimulationUnitsOnSurfaces(
        this._system,
        faction,
        placements,
        this._surfaces,
        gen,
      )
    this._stateData = {
      ...this._stateData,
      [side]: {
        ...this._stateData[side],
        faction,
        participatingUnits: units,
        nonParticipatingUnits: '' as UnitIdList,
        surfaceUnits,
        unitSurface,
        unitType,
        unitState,
        unitStats: {
          ...buildUnitStatsMap(this._system, faction, upgradedSet),
          ...unitStats,
        },
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
      this._syncSnapshots,
      this._stateData,
      this._lookups,
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
      this._syncSnapshots,
      this._stateData,
      this._lookups,
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
