import nekroVirusIcon from '@/assets/faction/nekro_virus.svg?raw'
import type { Ability } from '@/combat'
import type {
  AbilityCallContext,
  ParamChange,
  SettingsParams,
} from '@/combat/abilities-engine/types'
import { SHARED_UNIT_ABILITY_KEYS } from '@/data/main/abilities/general'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import technology from '@/data/main/abilities/technology'
import type { Faction, UnitBaseType, UnitDefinition } from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import { otherFactions } from '../other-factions'
import { createGenericUnitUpgrades } from './generic-unit-upgrades'
import { mordred } from './mordred'
import { createTechnologicalSingularity } from './technological-singularity'
import { theAlastor } from './the-alastor'

// ---------------------------------------------------------------------------
// Collect flagship abilities from other factions
// ---------------------------------------------------------------------------

const flagshipAbilities = Object.values(otherFactions).flatMap(faction =>
  (faction.units.FLAGSHIP?.BASE?.ABILITIES ?? [])
    .filter(a => !SHARED_UNIT_ABILITY_KEYS.has(a.key))
    .map(ability => ({
      ...ability,
      key: `NEKRO_FLAGSHIP_${ability.key}`,
      name: ability.name,
      icon: faction.icon,
      readOnly: false,
      // Clone the invoke entries so each copy has its own references — the
      // engine dedups "already invoked" by invoke identity, and originals
      // with external invokes can share a side with this copy via the OTHER
      // slot (same fix as the technology copies below).
      invoke: ability.invoke.map(inv => ({ ...inv })),
      params: {
        ...ability.params,
        isEnabled: ability.headerUI === 'isEnabled' ? false : true,
      },
    })),
)

// ---------------------------------------------------------------------------
// Collect technology abilities from other factions
// ---------------------------------------------------------------------------

const technologyAbilities = Object.values(otherFactions).flatMap(faction =>
  (faction.abilities?.technology ?? []).map(ability => {
    const external = ability.invoke.some(inv => inv.external === true)
    return {
      ...ability,
      // External techs keep both the original and Nekro's copy visible.
      // Rename the copy so the two entries don't dedup, and shallow-clone
      // the invoke entries so each copy has its own references — the engine
      // tracks "already invoked" by invoke object identity.
      key: external ? `NEKRO_${ability.key}` : ability.key,
      invoke: external
        ? ability.invoke.map(inv => ({ ...inv }))
        : ability.invoke,
      name: ability.name,
      icon: faction.icon,
    }
  }),
)

// ---------------------------------------------------------------------------
// Collect unit abilities from other factions
// ---------------------------------------------------------------------------

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
    .flatMap(a => a.declareParamChange!(a.params, {} as SettingsParams))

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
            for (const inv of mainAbility.invoke) {
              if (inv.timing !== 'PREPARE') continue
              ;(inv.call as (c: AbilityCallContext) => void)(ctx)
            }
          }
        },
      },
    ],
  }
}

const unitAbilities = Object.entries(otherFactions)
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
for (const a of unitAbilities) {
  const ut = a.exclusiveGroup as UnitBaseType | undefined
  if (!ut) continue
  ;(genericUpgradeConflicts[ut] ??= []).push(a.key)
}
const genericUnitUpgrades = createGenericUnitUpgrades(genericUpgradeConflicts)

const taggedGenericTechs = technology.map(a => ({
  ability: a,
  subcategory: 'TECHNOLOGY' as const,
}))
const taggedUnitUpgrades = genericUnitUpgrades.map(a => ({
  ability: a,
  subcategory: 'UNIT_UPGRADE' as const,
}))
const taggedTechnologies = technologyAbilities.map(a => ({
  ability: a,
  subcategory: 'FACTION_TECHNOLOGY' as const,
}))
const taggedUnits = unitAbilities.map(a => ({
  ability: a,
  subcategory: 'FACTION_UNIT' as const,
}))
const taggedFlagships = flagshipAbilities.map(a => ({
  ability: a,
  subcategory: 'FLAGSHIP' as const,
}))

const technologicalSingularity = createTechnologicalSingularity(
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

// ---------------------------------------------------------------------------
// Export faction
// ---------------------------------------------------------------------------

export const nekro_virus: Faction = {
  name: 'Nekro Virus',
  icon: nekroVirusIcon,
  abilities: {
    faction: [technologicalSingularity],
    technology: technologyAbilities,
    unit: unitAbilities,
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
        ABILITIES: [theAlastor, sustainDamage, ...flagshipAbilities],
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
