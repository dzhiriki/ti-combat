import nekroVirusIcon from '@/assets/faction/nekro_virus.svg?raw'
import {
  type Ability,
  createRuntimeAbilityList,
  hasStaticInvokes,
  resolveInvokes,
} from '@/combat'
import type {
  AbilityCallContext,
  ParamChange,
  SettingsParams,
} from '@/combat/abilities-engine/types'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type {
  Faction,
  FactionDefinition,
  GameData,
  UnitBaseType,
  UnitDefinition,
} from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import { createGenericUnitUpgrades } from './generic-unit-upgrades'
import { mordred } from './mordred'
import { createTechnologicalSingularity } from './technological-singularity'
import { theAlastor } from './the-alastor'

// ---------------------------------------------------------------------------
// createFactionUnitAbility helpers
// ---------------------------------------------------------------------------

// createFactionUnitAbility runs while collecting Nekro's copies, forwarding
// unit abilities' declareParamChange before any side context exists — pass
// an empty lookup.
const EMPTY_LIST = createRuntimeAbilityList([])
const EMPTY_LOOKUPS = { own: EMPTY_LIST, opponent: EMPTY_LIST }

const EXCLUDED_UNIT_TYPES = new Set(['FLAGSHIP', 'MECH', 'SPACE_DOCK'])

const STANDARD_ABILITY_KEYS = new Set([
  'SUSTAIN_DAMAGE',
  'PLANETARY_SHIELD',
  'DISABLE_PLANETARY_SHIELD',
])

function createFactionUnitAbility(
  factionKey: string,
  faction: Faction,
  unitType: UnitBaseType,
  unitDef: UnitDefinition,
): Ability {
  const key = `NEKRO_UNIT_${factionKey}_${unitType}`
  const stats = getEffectiveStats(unitDef.BASE, unitDef.UPGRADED, true)
  const displayName = stats.NAME ?? unitDef.BASE.NAME ?? unitType

  const mainAbility = (stats.ABILITIES ?? []).find(
    a => !STANDARD_ABILITY_KEYS.has(a.key),
  )

  const effectiveStats = mainAbility
    ? {
        ...stats,
        ABILITIES: stats.ABILITIES!.map(a =>
          a === mainAbility ? { ...a, key } : a,
        ),
      }
    : stats

  // Extract child's custom params (exclude base params)
  const childCustomParams: Record<string, unknown> = {}
  if (mainAbility) {
    for (const [k, v] of Object.entries(mainAbility.params)) {
      if (k !== 'isEnabled' && k !== 'uses') childCustomParams[k] = v
    }
  }

  // Collect declareParamChange from unit abilities (e.g. Hel-Titan adds PDS to groundForces)
  const paramChanges = (stats.ABILITIES ?? [])
    .filter(a => a.declareParamChange)
    .flatMap(a =>
      a.declareParamChange!(a.params, {} as SettingsParams, {
        abilities: EMPTY_LOOKUPS,
        this: a,
      }),
    )

  return {
    key,
    name: displayName,
    icon: faction.icon,
    exclusiveGroup: unitType,
    description: mainAbility?.description,
    params: {
      isEnabled: false,
      // Mirror the child's `uses` default — a copy that reuses the child's
      // uiConfig also inherits its Uses input, and a non-finite default
      // renders as a blank field (the Exotrireme glitch).
      uses:
        typeof mainAbility?.params.uses === 'number'
          ? mainAbility.params.uses
          : Infinity,
      ...childCustomParams,
    },
    headerUI: 'isEnabled',
    ...(mainAbility?.uiConfig && { uiConfig: mainAbility.uiConfig }),
    ...(paramChanges.length > 0 && {
      declareParamChange: (): ParamChange[] => paramChanges,
    }),
    invoke: [
      {
        timing: 'PREPARE',
        call: (ctx: AbilityCallContext) => {
          // Save original stats before overwriting
          const original = { ...ctx.api.own.getUnitStats(unitType)! }
          ctx.api.own.updateAbilityConfig(key, {
            reset: () => (ctx: AbilityCallContext) => {
              ctx.api.own.modifyUnitType(unitType, original)
            },
          })
          ctx.api.own.modifyUnitType(unitType, effectiveStats)
          // Run child ability's config-level PREPARE invokes
          if (mainAbility) {
            const invokes = resolveInvokes(
              mainAbility,
              (ctx.api.own.getAbilityConfig(key as keyof AbilityConfigMap) ??
                {}) as Record<string, unknown>,
              ctx,
            )
            for (const inv of invokes) {
              if (inv.timing !== 'PREPARE') continue
              ;(inv.call as (c: AbilityCallContext) => void)(ctx)
            }
          }
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Collect and memoize copies made from the game data's faction roster
// ---------------------------------------------------------------------------

interface NekroCopies {
  flagship: Ability[]
  technology: Ability[]
  unit: Ability[]
  singularity: Ability
}

const copiesByGameData = new WeakMap<GameData, NekroCopies>()

function collect(gameData: GameData): NekroCopies {
  const cached = copiesByGameData.get(gameData)
  if (cached) return cached

  const others = gameData.factions
  // Flagship text that only restates a GENERAL toggle (Sustain Damage) is
  // already configurable there — don't copy it.
  const generalKeys = new Set(
    gameData.getAbilities('GENERAL').map(ability => ability.key),
  )

  const flagship = Object.values(others).flatMap(faction =>
    (faction.units.FLAGSHIP?.BASE?.ABILITIES ?? [])
      .filter(a => !generalKeys.has(a.key))
      .map(ability => ({
        ...ability,
        key: `NEKRO_FLAGSHIP_${ability.key}`,
        name: ability.name,
        icon: faction.icon,
        readOnly: false,
        // Clone the invoke entries so each copy has its own references — the
        // engine dedups "already invoked" by invoke identity, and originals
        // with external invokes can share a side with this copy via the
        // OTHER slot (same fix as the technology copies below).
        invoke: hasStaticInvokes(ability)
          ? ability.invoke.map(inv => ({ ...inv }))
          : ability.invoke,
        params: {
          ...ability.params,
          isEnabled: ability.headerUI === 'isEnabled' ? false : true,
        },
      })),
  )

  const technology = Object.values(others).flatMap(faction =>
    (faction.abilities?.technology ?? []).map(ability => {
      const external =
        hasStaticInvokes(ability) &&
        ability.invoke.some(inv => inv.external === true)
      return {
        ...ability,
        // External techs keep both the original and Nekro's copy visible.
        // Rename the copy so the two entries don't dedup, and shallow-clone
        // the invoke entries so each copy has its own references — the
        // engine tracks "already invoked" by invoke object identity.
        key: external ? `NEKRO_${ability.key}` : ability.key,
        invoke:
          external && hasStaticInvokes(ability)
            ? ability.invoke.map(inv => ({ ...inv }))
            : ability.invoke,
        name: ability.name,
        icon: faction.icon,
      }
    }),
  )

  const unit = Object.entries(others)
    .filter(([factionKey]) => factionKey !== 'NEUTRAL')
    .flatMap(([factionKey, faction]) =>
      (Object.entries(faction.units) as [UnitBaseType, UnitDefinition][])
        .filter(([unitType]) => !EXCLUDED_UNIT_TYPES.has(unitType))
        .map(([unitType, unitDef]) =>
          createFactionUnitAbility(factionKey, faction, unitType, unitDef),
        ),
    )

  // Conflict map for generic unit upgrades: each unit type maps to the
  // list of faction-unit ability keys that target the same unit type. If
  // any such ability is enabled at fire time, the generic upgrade is
  // skipped (e.g. Letani II already overrode INFANTRY).
  const genericUpgradeConflicts: Partial<Record<UnitBaseType, string[]>> = {}
  for (const a of unit) {
    const ut = a.exclusiveGroup as UnitBaseType | undefined
    if (!ut) continue
    ;(genericUpgradeConflicts[ut] ??= []).push(a.key)
  }
  const genericUnitUpgrades = createGenericUnitUpgrades(
    gameData.baseUnits,
    genericUpgradeConflicts,
  )

  const taggedGenericTechs = gameData
    .getAbilities('TECHNOLOGY')
    .map(a => ({ ability: a, subcategory: 'TECHNOLOGY' as const }))
  const taggedUnitUpgrades = genericUnitUpgrades.map(a => ({
    ability: a,
    subcategory: 'UNIT_UPGRADE' as const,
  }))
  const taggedTechnologies = technology.map(a => ({
    ability: a,
    subcategory: 'FACTION_TECHNOLOGY' as const,
  }))
  const taggedUnits = unit.map(a => ({
    ability: a,
    subcategory: 'FACTION_UNIT' as const,
  }))
  const taggedFlagships = flagship.map(a => ({
    ability: a,
    subcategory: 'FLAGSHIP' as const,
  }))

  const singularity = createTechnologicalSingularity(
    [
      ...taggedGenericTechs,
      ...taggedUnitUpgrades,
      ...taggedTechnologies,
      ...taggedUnits,
      ...taggedFlagships,
    ],
    [...taggedTechnologies, ...taggedUnits],
    mordred,
  )

  const copies = { flagship, technology, unit, singularity }
  copiesByGameData.set(gameData, copies)
  return copies
}

// ---------------------------------------------------------------------------
// Export faction
// ---------------------------------------------------------------------------

export const nekro_virus: FactionDefinition = {
  name: 'Nekro Virus',
  icon: nekroVirusIcon,
  abilities: gameData => {
    const { singularity, technology, unit } = collect(gameData)
    // A copied unit ability joins the slot of the unit type it upgrades, so
    // it renders next to Nekro's own units: `exclusiveGroup` is that type.
    const unitGroups: Record<string, Ability[]> = {}
    for (const ability of unit) {
      const group = String(ability.exclusiveGroup).toLowerCase()
      ;(unitGroups[group] ??= []).push(ability)
    }
    return { ability: [singularity], technology, ...unitGroups }
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'The Alastor',
        DESCRIPTION:
          'At the start of a space combat, choose any number of your ground forces in this system to participate in that combat as if they were ships.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [9, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: gameData => [
          theAlastor,
          sustainDamage,
          ...collect(gameData).flagship,
        ],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Mordred',
        DESCRIPTION:
          'During combat against an opponent who has an "X" or "Y" token on 1 or more of their technologies, apply +2 to the result of each of this unit\'s combat rolls.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [mordred, sustainDamage],
      },
    },
  },
}
