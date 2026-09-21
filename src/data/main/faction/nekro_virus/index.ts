import nekroVirusIcon from '@/assets/faction/nekro_virus.svg?raw'
import {
  type Ability,
  cloneAbility,
  createRuntimeAbilityList,
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
  LazyContext,
  UnitBaseType,
  UnitDefinition,
} from '@/types'
import { getEffectiveStats } from '@/utils/get-simulation-units'

import { mordred } from './mordred'
import { technologicalSingularity } from './technological-singularity'
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
          a === mainAbility ? cloneAbility(a, { key }) : a,
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
// Collect and memoize faction technologies and faction-unit stat copies
// ---------------------------------------------------------------------------

function copyFlagshipAbilities(context: LazyContext): Ability[] {
  return context.getAbilities('FACTION_FLAGSHIP').map(ability =>
    cloneAbility(ability, {
      key: `NEKRO_FLAGSHIP_${ability.key}`,
      readOnly: false,
      params: {
        ...ability.params,
        isEnabled: ability.headerUI === 'isEnabled' ? false : true,
      },
    }),
  )
}

function createCopies(context: LazyContext) {
  const others = Object.fromEntries(
    context
      .getFactionKeys()
      .filter(key => key !== 'NEKRO_VIRUS')
      .map(key => [key, context.getFaction(key)]),
  )
  const technology = context.getAbilities('FACTION_TECHNOLOGY').map(ability => {
    return cloneAbility(ability, {
      key: `NEKRO_${ability.key}`,
    })
  })

  const unit = Object.entries(others)
    .filter(([factionKey]) => factionKey !== 'NEUTRAL')
    .flatMap(([factionKey, faction]) =>
      (Object.entries(faction.units) as [UnitBaseType, UnitDefinition][])
        .filter(([unitType]) => !EXCLUDED_UNIT_TYPES.has(unitType))
        .map(([unitType, unitDef]) =>
          createFactionUnitAbility(factionKey, faction, unitType, unitDef),
        ),
    )

  return { technology, unit }
}

// ---------------------------------------------------------------------------
// Export faction
// ---------------------------------------------------------------------------

export const nekro_virus: FactionDefinition = {
  name: 'Nekro Virus',
  icon: nekroVirusIcon,
  abilities: context => {
    const { technology, unit } = createCopies(context)
    // A copied unit ability joins the slot of the unit type it upgrades, so
    // it renders next to Nekro's own units: `exclusiveGroup` is that type.
    const unitGroups: Record<string, Ability[]> = {}
    for (const ability of unit) {
      const group = String(ability.exclusiveGroup).toLowerCase()
      ;(unitGroups[group] ??= []).push(ability)
    }
    return { ability: [technologicalSingularity], technology, ...unitGroups }
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
        ABILITIES: context => {
          return [theAlastor, sustainDamage, ...copyFlagshipAbilities(context)]
        },
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
