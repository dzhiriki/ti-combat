import { hasStaticInvokes } from '@/combat'
import { FACTION_KEY_TO_SLOT, unitSlot } from '@/constants/ability-slots'
import * as main from '@/data/main'
import * as tf from '@/data/tf'
import type {
  CombatSide,
  Faction,
  FactionKey,
  GameSystem,
  UnitBaseType,
} from '@/types'
import { getFaction } from '@/utils/get-faction'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { getGameData } from '@/utils/get-game-data'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import type {
  Ability,
  AbilitySlot,
  RegisteredAbility,
} from '../../combat/abilities-engine/types'

function tag(
  abilities: readonly Ability[],
  slot: AbilitySlot,
): RegisteredAbility[] {
  return abilities.map(ability => ({ ability, slot }))
}

function hasExternalInvoke(ability: Ability): boolean {
  return (
    hasStaticInvokes(ability) &&
    ability.invoke.some(inv => inv.external === true)
  )
}

// Every faction in every system (Neutral is in both rosters — dedup by
// reference).
const allFactions: Faction[] = [
  ...new Set([...Object.values(main.factions), ...Object.values(tf.factions)]),
]

// ── TI4 cross-faction pools ────────────────────────────────────────────
// Promissory notes, agents, and commanders are TI4 decks any TI4 faction may
// hold. Twilight's Fall has none of them (its shared decks are already part
// of `tf.abilities`), so these pools are built from the TI4 roster only.
const ti4Factions = Object.values(main.factions)

const allPromissoryAbilities = ti4Factions.flatMap(
  faction => faction.abilities?.promissory ?? [],
) as Ability[]

const allAgentAbilities = ti4Factions.flatMap(
  faction => faction.abilities?.agent ?? [],
) as Ability[]

const allCommanderAbilities = ti4Factions.flatMap(
  faction => faction.abilities?.commander ?? [],
) as Ability[]

// Keys already displayed via dedicated slots — agents/commanders/promissories
// have their own cross-faction pools, generic abilities (technology, action
// cards, etc.) live in the system's shared pool. Such abilities must NOT also
// appear in the catch-all OTHER slot, even if their invokes are marked
// external.
const alreadyDisplayedKeys = new Set<string>([
  ...main.abilities.map(r => r.ability.key),
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
  for (const faction of ti4Factions) {
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

// The full shared pool per system: the system's own generic abilities plus,
// for TI4, the cross-faction decks and the OTHER catch-all for externally
// displayed faction abilities.
const registeredBySystem: Record<GameSystem, readonly RegisteredAbility[]> = {
  TI4: [
    ...main.abilities,
    ...tag(allPromissoryAbilities, 'PROMISSORY'),
    ...tag(allAgentAbilities, 'AGENT'),
    ...tag(allCommanderAbilities, 'COMMANDER'),
    ...allExternalAbilities,
  ],
  TWILIGHTS_FALL: tf.abilities,
}

const allUnitAbilities: Ability[] = []
{
  const seen = new Set<string>()
  for (const faction of allFactions) {
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

const allFactionAbilities: Ability[] = []
{
  const seen = new Set<string>()
  for (const faction of allFactions) {
    if (!faction.abilities) continue
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

// Lookup pool for URL/refresh validation. TI4 first: many TF deck cards are
// rebranded TI4 abilities under the same key, and the lookup keeps the first
// entry per key. TF's bespoke keys (TF_*) live nowhere else.
const allAbilitiesForLookup: Ability[] = [
  ...registeredBySystem.TI4.map(r => r.ability),
  ...allUnitAbilities,
  ...allFactionAbilities,
  ...tf.abilities.map(r => r.ability),
]

export function getAllAbilities(): Ability[] {
  return allAbilitiesForLookup
}

// Neutral is a stat-only opponent: it holds no faction-locked decks in either
// system (agendas, TI4 technologies, action cards, commanders, relics,
// promissory notes; TF abilities, paradigms, action cards, unit upgrades) and
// has no fleet pool to enforce. It keeps the phase drivers, terrain effects,
// and the agent-style pool of its system (TI4 agents / TF genomes).
const NEUTRAL_HIDDEN_SLOTS: ReadonlySet<AbilitySlot> = new Set<AbilitySlot>([
  'AGENDA',
  'TECHNOLOGY',
  'ACTION_CARD',
  'COMMANDER',
  'RELIC',
  'PROMISSORY',
  'TF_ABILITY',
  'TF_PARADIGM',
  'TF_ACTION_CARD',
  'TF_UNIT_UPGRADE',
])

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
      if (main.SHARED_UNIT_ABILITY_KEYS.has(ability.key)) continue
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
  const faction = getFaction(factionKey)
  if (faction.abilities) {
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
  system: GameSystem,
  side: CombatSide,
  factionKey: FactionKey,
  upgradedTypes?: ReadonlySet<UnitBaseType>,
): RegisteredAbility[] {
  const isNeutral = factionKey === 'NEUTRAL'
  const faction = getGameData(system).factions[factionKey] as
    | Faction
    | undefined
  const ownedKeys = getFactionOwnedAbilityKeys(factionKey)

  const base: RegisteredAbility[] = registeredBySystem[system].filter(reg => {
    const a = reg.ability
    if (a.side && a.side !== side) return false
    if (isNeutral) {
      if (NEUTRAL_HIDDEN_SLOTS.has(reg.slot)) return false
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

  return [...base, ...factionAbilities, ...unitAbilities]
}
