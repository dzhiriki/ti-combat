import {
  AbilitiesEngine,
  type Ability,
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
  UnitBaseType,
  UnitIdList,
  UnitSelection,
} from '@/types'
import { getFaction } from '@/utils/get-faction'
import { DEFAULT_FACTION_BY_SYSTEM } from '@/utils/get-faction-system'
import { DEFAULT_GAME_SYSTEM, getGameData } from '@/utils/get-game-data'
import {
  buildUnitStatsMap,
  getSimulationUnits,
} from '@/utils/get-simulation-units'

import {
  initializeAbilityDefaults,
  reconcileAbilitiesConfig,
  type SideLookups,
  type SyncSnapshots,
} from './reconcile'
import {
  serializeAbilities,
  type SerializedConfig,
  serializeUnits,
} from './serialization'
import type { SimulationInput } from './types'

// The flat `_sideAbilities` list feeds engine reconciliation and must hold
// each ability once.
function flattenUnique(regs: readonly CollectedAbility[]): Ability[] {
  const seen = new Set<string>()
  const out: Ability[] = []
  for (const r of regs) {
    if (seen.has(r.ability.key)) continue
    seen.add(r.ability.key)
    out.push(r.ability)
  }
  return out
}

function createDefaultUnitSelections(): Record<UnitBaseType, UnitSelection> {
  return UNIT_TYPES.reduce(
    (acc, unitType) => {
      acc[unitType] = { count: 0, upgraded: false }
      return acc
    },
    {} as Record<UnitBaseType, UnitSelection>,
  )
}

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
  private _combatMode: CombatMode
  private _abilities: Record<CombatSide, SideAbilitiesConfig>
  private _sideAbilities: Record<CombatSide, Ability[]>
  private _sideRegistered!: Record<CombatSide, CollectedAbility[]>
  private _lookups!: SideLookups
  private _unitAbilityKeys: Record<CombatSide, ReadonlySet<string>>
  private _factionOwnedKeys: Record<CombatSide, ReadonlySet<string>>
  private _stateData: CombatStateData
  private _engine: AbilitiesEngine
  private _syncSnapshots: SyncSnapshots = new Map()

  constructor() {
    this._system = DEFAULT_GAME_SYSTEM
    const defaultFaction = DEFAULT_FACTION_BY_SYSTEM[this._system]
    const defaultUnitStats = buildUnitStatsMap(this._system, defaultFaction)

    this._attackerFaction = defaultFaction
    this._defenderFaction = defaultFaction
    this._attackerSelections = createDefaultUnitSelections()
    this._defenderSelections = createDefaultUnitSelections()
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
    this._sideAbilities = {
      attacker: flattenUnique(attackerRegistered),
      defender: flattenUnique(defenderRegistered),
    }
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
        unitType: {},
        unitState: {},
        unitStats: defaultUnitStats,
        abilities: this._abilities.defender,
        liveAbilities: {},
      },
      combatMode: 'SPACE',
    }

    initializeAbilityDefaults(this._abilities, this._sideAbilities)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
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
    return this._attackerSelections
  }

  get defenderSelections(): Record<UnitBaseType, UnitSelection> {
    return this._defenderSelections
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

    const faction = DEFAULT_FACTION_BY_SYSTEM[system]
    this._attackerSelections = createDefaultUnitSelections()
    this._defenderSelections = createDefaultUnitSelections()

    // Drop all ability config so nothing carries across systems; setFaction
    // then repopulates each side with the new system's defaults.
    this._abilities = { attacker: {}, defender: {} }
    this._stateData = {
      ...this._stateData,
      attacker: { ...this._stateData.attacker, abilities: {} },
      defender: { ...this._stateData.defender, abilities: {} },
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

    // Reload abilities for the changed side
    const gameData = getGameData(this._system)
    const reg = gameData.getAvailableAbilities(
      side,
      faction,
      this.getUpgradedTypes(side),
    )
    this._sideRegistered[side] = reg
    this._lookups = createLookups(this._sideRegistered)
    this._sideAbilities[side] = flattenUnique(reg)
    this._unitAbilityKeys[side] = gameData.getUnitDefinitionAbilityKeys(faction)
    this._factionOwnedKeys[side] = gameData.getFactionOwnedAbilityKeys(faction)

    // Rebuild side config: keep existing params for surviving abilities,
    // initialize defaults for new ones
    const oldSideConfig = this._abilities[side]
    const newSideConfig: Record<string, Record<string, unknown>> = {}

    for (const ability of this._sideAbilities[side]) {
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
    const selections = this.selectionsForSide(side)
    this.rebuildUnits(side, faction, selections)

    // Reconcile
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
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
    this.updateSelection(side, unitType, { upgraded })
  }

  isUpgraded(side: CombatSide, unitType: UnitBaseType): boolean {
    return this.selectionsForSide(side)[unitType].upgraded
  }

  setAbilityParam(
    side: CombatSide,
    abilityKey: string,
    params: Record<string, unknown>,
  ): void {
    this.setParam(side, abilityKey, params)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
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
    }
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
      this._stateData,
      this._lookups,
    )
    this.rebuildEngine()
  }

  resetUnits(side: CombatSide): void {
    const newSelections = createDefaultUnitSelections()
    if (side === 'attacker') {
      this._attackerSelections = newSelections
    } else {
      this._defenderSelections = newSelections
    }

    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    this.rebuildUnits(side, faction, newSelections)

    // Upgrades may have changed — recalculate available abilities
    const regReset = getGameData(this._system).getAvailableAbilities(
      side,
      faction,
      this.getUpgradedTypes(side),
    )
    this._sideRegistered[side] = regReset
    this._lookups = createLookups(this._sideRegistered)
    this._sideAbilities[side] = flattenUnique(regReset)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
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
    initializeAbilityDefaults(this._abilities, this._sideAbilities)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
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
    this._sideAbilities = {
      attacker: flattenUnique(attackerRegistered),
      defender: flattenUnique(defenderRegistered),
    }
    this._unitAbilityKeys = {
      attacker: gameData.getUnitDefinitionAbilityKeys(this._attackerFaction),
      defender: gameData.getUnitDefinitionAbilityKeys(this._defenderFaction),
    }
    this._factionOwnedKeys = {
      attacker: gameData.getFactionOwnedAbilityKeys(this._attackerFaction),
      defender: gameData.getFactionOwnedAbilityKeys(this._defenderFaction),
    }

    // Rebuild units for both sides
    this.rebuildUnits(
      'attacker',
      this._attackerFaction,
      this._attackerSelections,
    )
    this.rebuildUnits(
      'defender',
      this._defenderFaction,
      this._defenderSelections,
    )

    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
      this._stateData,
      this._lookups,
    )
    this.rebuildEngine()
  }

  toSimulationInput(): SimulationInput | null {
    const hasUnits =
      Object.values(this._attackerSelections).some(s => s.count > 0) ||
      Object.values(this._defenderSelections).some(s => s.count > 0)
    if (!hasUnits) return null
    return {
      system: this._system,
      attackerFaction: this._attackerFaction,
      defenderFaction: this._defenderFaction,
      attackerSelections: this._attackerSelections,
      defenderSelections: this._defenderSelections,
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
    initializeAbilityDefaults(freshAbilities, this._sideAbilities)
    reconcileAbilitiesConfig(
      freshAbilities,
      this._sideAbilities,
      this._combatMode,
      undefined,
      this._stateData,
      this._lookups,
    )

    return {
      v: 1,
      g: this._system,
      af: this._attackerFaction,
      df: this._defenderFaction,
      m: this._combatMode === 'SPACE' ? 'S' : 'G',
      au: serializeUnits(this._attackerSelections),
      du: serializeUnits(this._defenderSelections),
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
    this._sideAbilities = {
      attacker: flattenUnique(attackerReg),
      defender: flattenUnique(defenderReg),
    }
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
    initializeAbilityDefaults(this._abilities, this._sideAbilities)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
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

    // Rebuild units for both sides
    this.rebuildUnits('attacker', af, this._attackerSelections)
    this.rebuildUnits('defender', df, this._defenderSelections)

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
    }

    // Final reconcile and engine rebuild
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
      this._stateData,
      this._lookups,
    )
    this.rebuildEngine()
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private getUpgradedTypes(side: CombatSide): Set<UnitBaseType> {
    const sel = this.selectionsForSide(side)
    const set = new Set<UnitBaseType>()
    for (const [k, v] of Object.entries(sel)) {
      if (v.upgraded) set.add(k as UnitBaseType)
    }
    return set
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

    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    this.rebuildUnits(side, faction, newSelections)

    if (upgradeChanged) {
      const regUpd = getGameData(this._system).getAvailableAbilities(
        side,
        faction,
        this.getUpgradedTypes(side),
      )
      this._sideRegistered[side] = regUpd
      this._lookups = createLookups(this._sideRegistered)
      this._sideAbilities[side] = flattenUnique(regUpd)
    }
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
      this._stateData,
      this._lookups,
    )
    this.rebuildEngine()
  }

  private rebuildUnits(
    side: CombatSide,
    faction: string,
    selections: Record<UnitBaseType, UnitSelection>,
  ): void {
    const upgradedSet = new Set(
      (Object.keys(selections) as UnitBaseType[]).filter(
        t => selections[t].upgraded,
      ),
    )
    const gen: { _nextCode?: number } = {
      _nextCode: this._stateData._nextCode,
    }
    const { units, unitType, unitState, unitStats } = getSimulationUnits(
      this._system,
      faction,
      selections,
      gen,
    )
    this._stateData = {
      ...this._stateData,
      [side]: {
        ...this._stateData[side],
        faction,
        participatingUnits: units,
        nonParticipatingUnits: '' as UnitIdList,
        unitType,
        unitState,
        unitStats: {
          ...buildUnitStatsMap(this._system, faction, upgradedSet),
          ...unitStats,
        },
      },
      _nextCode: gen._nextCode,
    }
  }

  private setParam(
    side: CombatSide,
    abilityKey: string,
    params: Record<string, unknown>,
  ): void {
    const ability = this._sideAbilities[side].find(a => a.key === abilityKey)

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
      for (const other of this._sideAbilities[side]) {
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
