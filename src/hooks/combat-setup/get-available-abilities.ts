import { SHARED_UNIT_ABILITY_KEYS } from '@/data/abilities/general'
import factions from '@/data/faction'
import { TF_SHARED_REGISTERED } from '@/data/faction/twilights-fall-abilities'
import type {
  CombatSide,
  Faction,
  FactionKey,
  GameSystem,
  UnitBaseType,
} from '@/types'
import { getFactionSystem } from '@/utils/get-faction-system'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import type {
  Ability,
  AbilitySlot,
  RegisteredAbility,
} from '../../combat/abilities-engine/types'
import actionCard from '../../data/abilities/action-card'
import advanced from '../../data/abilities/advanced'
import agenda from '../../data/abilities/agenda'
import environment from '../../data/abilities/environment'
import general from '../../data/abilities/general'
import relic from '../../data/abilities/relic'
import technology from '../../data/abilities/technology'

function tag(
  abilities: readonly Ability[],
  slot: AbilitySlot,
): RegisteredAbility[] {
  return abilities.map(ability => ({ ability, slot }))
}

function hasExternalInvoke(ability: Ability): boolean {
  return ability.invoke.some(inv => inv.external === true)
}

const FACTION_KEY_TO_SLOT = {
  faction: 'FACTION_ABILITY',
  technology: 'FACTION_TECHNOLOGY',
  unit: 'FACTION_UNIT',
  promissory: 'PROMISSORY',
  agent: 'AGENT',
  commander: 'COMMANDER',
  hero: 'FACTION_HERO',
  breakthrough: 'FACTION_BREAKTHROUGH',
} as const satisfies Record<string, AbilitySlot>

function unitSlot(baseType: UnitBaseType): AbilitySlot {
  if (baseType === 'FLAGSHIP') return 'FACTION_FLAGSHIP'
  if (baseType === 'MECH') return 'FACTION_MECH'
  return 'FACTION_UNIT'
}

const allPromissoryAbilities = Object.values(factions).flatMap(
  faction => faction?.abilities?.promissory ?? [],
) as Ability[]

const allAgentAbilities = Object.values(factions).flatMap(
  faction => faction?.abilities?.agent ?? [],
) as Ability[]

const allCommanderAbilities = Object.values(factions).flatMap(
  faction => faction?.abilities?.commander ?? [],
) as Ability[]

// Keys already displayed via dedicated slots — agents/commanders/promissories
// have their own cross-faction pools, generic abilities (technology, action
// cards, etc.) live in baseRegistered. Such abilities must NOT also appear
// in the catch-all OTHER slot, even if their invokes are marked external.
const alreadyDisplayedKeys = new Set<string>([
  ...general.map(a => a.key),
  ...advanced.map(a => a.key),
  ...environment.map(a => a.key),
  ...agenda.map(a => a.key),
  ...technology.map(a => a.key),
  ...actionCard.map(a => a.key),
  ...relic.map(a => a.key),
  ...allPromissoryAbilities.map(a => a.key),
  ...allAgentAbilities.map(a => a.key),
  ...allCommanderAbilities.map(a => a.key),
])

const allExternalAbilities: RegisteredAbility[] = []
{
  const seen = new Set<string>()
  const addIfExternal = (ability: Ability, faction: Faction) => {
    if (!hasExternalInvoke(ability)) return
    if (seen.has(ability.key)) return
    if (alreadyDisplayedKeys.has(ability.key)) return
    if (!ability.headerUI && !ability.uiConfig) return
    seen.add(ability.key)
    allExternalAbilities.push({
      ability: { ...ability, icon: faction.icon },
      slot: 'OTHER',
    })
  }
  for (const faction of Object.values(factions)) {
    if (!faction) continue
    for (const unitDef of Object.values(faction.units)) {
      if (!unitDef) continue
      for (const ability of [
        ...(unitDef.BASE.ABILITIES ?? []),
        ...(unitDef.UPGRADED?.ABILITIES ?? []),
      ]) {
        addIfExternal(ability, faction)
      }
    }
    if (faction.abilities) {
      for (const list of Object.values(faction.abilities)) {
        if (list) {
          for (const ability of list) addIfExternal(ability as Ability, faction)
        }
      }
    }
  }
}

const allUnitAbilities: Ability[] = []
{
  const seen = new Set<string>()
  for (const faction of Object.values(factions)) {
    if (!faction) continue
    for (const unitDef of Object.values(faction.units)) {
      if (!unitDef) continue
      for (const ability of [
        ...(unitDef.BASE.ABILITIES ?? []),
        ...(unitDef.UPGRADED?.ABILITIES ?? []),
      ] as Ability[]) {
        if (seen.has(ability.key)) continue
        if (!ability.headerUI && !ability.uiConfig) continue
        seen.add(ability.key)
        allUnitAbilities.push(ability)
      }
    }
  }
}

const baseRegistered: RegisteredAbility[] = [
  ...tag(general, 'GENERAL'),
  ...tag(advanced, 'ADVANCED'),
  ...tag(environment, 'ENVIRONMENT'),
  ...tag(agenda, 'AGENDA'),
  ...tag(technology, 'TECHNOLOGY'),
  ...tag(actionCard, 'ACTION_CARD'),
  ...tag(relic, 'RELIC'),
  ...tag(allPromissoryAbilities, 'PROMISSORY'),
  ...tag(allAgentAbilities, 'AGENT'),
  ...tag(allCommanderAbilities, 'COMMANDER'),
  ...allExternalAbilities,
]

const allFactionAbilities: Ability[] = []
{
  const seen = new Set<string>()
  for (const faction of Object.values(factions)) {
    if (!faction?.abilities) continue
    for (const list of Object.values(faction.abilities)) {
      if (!list) continue
      for (const ability of list as Ability[]) {
        if (seen.has(ability.key)) continue
        seen.add(ability.key)
        allFactionAbilities.push(ability)
      }
    }
  }
}

const allAbilitiesForLookup: Ability[] = [
  ...baseRegistered.map(r => r.ability),
  ...allUnitAbilities,
  ...allFactionAbilities,
  // The Twilight's Fall shared pool — bespoke keys (TF_*) live nowhere else,
  // and without them URL/refresh validation drops any saved TF card config.
  ...TF_SHARED_REGISTERED.map(r => r.ability),
]

export function getAllAbilities(): Ability[] {
  return allAbilitiesForLookup
}

const NEUTRAL_HIDDEN_SLOTS: ReadonlySet<AbilitySlot> = new Set<AbilitySlot>([
  'AGENDA',
  'TECHNOLOGY',
  'ACTION_CARD',
  'COMMANDER',
  'RELIC',
  'PROMISSORY',
])

// Twilight's Fall has none of TI4's shared decks — no agendas, promissory
// notes, TI4 technologies, action cards, relics, agents, or commanders. Only
// general/advanced combat mechanics and terrain effects carry over; TF's own
// shared ability pool is layered in separately.
//
// NOTE: 'ADVANCED' must NOT be hidden — those are the phase drivers (AFB,
// Space Cannon, Bombardment, Retreat, Fleet Pool, Capacity, Ability Order),
// which are universal combat mechanics the engine needs to run every phase.
const TF_HIDDEN_SLOTS: ReadonlySet<AbilitySlot> = new Set<AbilitySlot>([
  'AGENDA',
  'TECHNOLOGY',
  'ACTION_CARD',
  'COMMANDER',
  'AGENT',
  'PROMISSORY',
  'OTHER',
])

// Individual cards that survive the slot filter but reference mechanics
// Twilight's Fall doesn't have (there is no Galvanize in TF).
const TF_HIDDEN_KEYS: ReadonlySet<string> = new Set(['PRE_GALVANIZED'])

function collectUnitAbilities(
  faction: Faction,
  side: CombatSide,
  upgradedTypes?: ReadonlySet<UnitBaseType>,
): RegisteredAbility[] {
  const seen = new Set<string>()
  const out: RegisteredAbility[] = []

  for (const [unitTypeStr, unitDef] of Object.entries(faction.units)) {
    if (!unitDef) continue
    const baseType = unitTypeStr as UnitBaseType
    const slot = unitSlot(baseType)

    for (const ability of [
      ...(unitDef.BASE.ABILITIES ?? []),
      ...(unitDef.UPGRADED?.ABILITIES ?? []),
    ]) {
      if (SHARED_UNIT_ABILITY_KEYS.has(ability.key)) continue
      if (seen.has(ability.key)) continue
      if (!ability.headerUI && !ability.uiConfig) continue
      if (ability.side && ability.side !== side) continue
      seen.add(ability.key)
      out.push({ ability, slot })
    }

    const effective = getEffectiveStats(
      unitDef.BASE,
      unitDef.UPGRADED,
      upgradedTypes?.has(baseType) ?? false,
    )
    const deploy = effective.UNIT_ABILITIES?.DEPLOY
    if (deploy && !seen.has(deploy.key)) {
      if (deploy.headerUI || deploy.uiConfig) {
        if (!deploy.side || deploy.side === side) {
          seen.add(deploy.key)
          out.push({ ability: deploy, slot })
        }
      }
    }
  }

  return out
}

const unitDefAbilityKeysCache = new Map<FactionKey, ReadonlySet<string>>()

/** Get keys of all abilities defined on faction units (regardless of unit state).
 *  Uses the merged faction unit config (faction overrides + base units), so
 *  shared unit abilities like SUSTAIN_DAMAGE / PLANETARY_SHIELD that come
 *  from base units are included even when the faction doesn't override the
 *  corresponding unit type. */
export function getUnitDefinitionAbilityKeys(
  factionKey: FactionKey,
): ReadonlySet<string> {
  const cached = unitDefAbilityKeysCache.get(factionKey)
  if (cached) return cached
  const keys = new Set<string>()
  const faction = factions[factionKey]
  if (!faction) return keys
  const mergedUnits = getFactionUnitConfig(factionKey)
  for (const unitDef of Object.values(mergedUnits)) {
    if (!unitDef?.BASE) continue
    for (const ability of [
      ...(unitDef.BASE.ABILITIES ?? []),
      ...(unitDef.UPGRADED?.ABILITIES ?? []),
    ]) {
      keys.add(ability.key)
    }
    for (const stats of [unitDef.BASE, unitDef.UPGRADED]) {
      const deploy = stats?.UNIT_ABILITIES?.DEPLOY
      if (deploy) keys.add(deploy.key)
    }
  }
  unitDefAbilityKeysCache.set(factionKey, keys)
  return keys
}

const factionOwnedKeysCache = new Map<FactionKey, ReadonlySet<string>>()

export function getFactionOwnedAbilityKeys(
  factionKey: FactionKey,
): ReadonlySet<string> {
  const cached = factionOwnedKeysCache.get(factionKey)
  if (cached) return cached
  const keys = new Set(getUnitDefinitionAbilityKeys(factionKey))
  const faction = factions[factionKey]
  if (faction?.abilities) {
    const a = faction.abilities
    for (const list of Object.values(a)) {
      if (list) {
        for (const ability of list) keys.add((ability as Ability).key)
      }
    }
  }
  factionOwnedKeysCache.set(factionKey, keys)
  return keys
}

export function getAvailableAbilities(
  side: CombatSide,
  factionKey: FactionKey,
  upgradedTypes?: ReadonlySet<UnitBaseType>,
  system?: GameSystem,
): RegisteredAbility[] {
  const isNeutral = factionKey === 'NEUTRAL'
  const isTwilightsFall = getFactionSystem(factionKey) === 'TWILIGHTS_FALL'
  // Neutral belongs to every system, so its own `system` field can't tell TF
  // apart — callers pass the session's active system. In a TF session the
  // neutral panel matches the TF layout: no OTHER catch-all, no Galvanize,
  // and the TI4 agent pool is replaced by the TF genome deck (genomes are
  // TF's agent-style exhaust effects).
  const isTfNeutral = isNeutral && system === 'TWILIGHTS_FALL'

  const faction = factions[factionKey]
  const ownedKeys = getFactionOwnedAbilityKeys(factionKey)

  const base: RegisteredAbility[] = baseRegistered.filter(reg => {
    const a = reg.ability
    if (a.side && a.side !== side) return false
    if (isTwilightsFall) {
      return !TF_HIDDEN_SLOTS.has(reg.slot) && !TF_HIDDEN_KEYS.has(a.key)
    }
    if (isNeutral) {
      if (NEUTRAL_HIDDEN_SLOTS.has(reg.slot)) return false
      if (isTfNeutral) {
        if (reg.slot === 'AGENT' || reg.slot === 'OTHER') return false
        if (TF_HIDDEN_KEYS.has(a.key)) return false
      }
      if (a.key === 'FLEET_POOL') return false
      return true
    }
    // OTHER is the catch-all for cross-faction external display — drop
    // entries the running faction already exposes via its own routes.
    if (reg.slot === 'OTHER' && ownedKeys.has(a.key)) return false
    return true
  })

  const factionAbilities: RegisteredAbility[] = []
  if (faction?.abilities) {
    for (const [key, list] of Object.entries(faction.abilities) as [
      keyof typeof FACTION_KEY_TO_SLOT,
      Ability[] | undefined,
    ][]) {
      if (!list) continue
      const slot = FACTION_KEY_TO_SLOT[key]
      // Promissories live only in the cross-faction PROMISSORY pool above.
      if (slot === 'PROMISSORY') continue
      // Own faction's agents/commanders ALSO appear in the FACTION subgroup
      // (in addition to the cross-faction AGENT/COMMANDER pools). Same Ability
      // reference → shared params/config; the panel renders both entries.
      let factionSlot: AbilitySlot = slot
      if (slot === 'AGENT') factionSlot = 'FACTION_AGENT'
      else if (slot === 'COMMANDER') factionSlot = 'FACTION_COMMANDER'
      for (const ability of list) {
        if (ability.side && ability.side !== side) continue
        factionAbilities.push({ ability, slot: factionSlot })
      }
    }
  }

  const unitAbilities = faction
    ? collectUnitAbilities(faction, side, upgradedTypes)
    : []

  // Twilight's Fall factions all draw from the same shared ability pool.
  // Neutral in a TF session gets only the genome deck — the TF analog of the
  // agent pool a TI4 neutral is offered.
  const tfShared: RegisteredAbility[] = isTwilightsFall
    ? TF_SHARED_REGISTERED.filter(
        reg => !reg.ability.side || reg.ability.side === side,
      )
    : isTfNeutral
      ? TF_SHARED_REGISTERED.filter(
          reg =>
            reg.slot === 'TF_GENOME' &&
            (!reg.ability.side || reg.ability.side === side),
        )
      : []

  return [...base, ...factionAbilities, ...tfShared, ...unitAbilities]
}
