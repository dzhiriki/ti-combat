import { z } from 'zod/mini'

import type { Ability, AbilityReadContext } from '@/combat'
import { SHIPS } from '@/constants/units'
import type { UnitBaseType, UnitList } from '@/types'

type Params = {
  anomalies: number
  mechsOnGround: number
  strategy: 'WIN_IN_SPACE' | 'PRESERVE_SUSTAIN' | 'PRESERVE_NO_SUSTAIN'
  _initialMechs: number
}

declare global {
  interface AbilityConfigMap {
    TF_STARLANCER_XI: Params
  }
}

function ownShipsFielded(ctx: AbilityReadContext): boolean {
  return SHIPS.some(
    t => ctx.api.own.getUnits(t, { includeVariants: true }).length > 0,
  )
}

function mechsParticipating(ctx: AbilityReadContext): boolean {
  const participating = ctx.api.own.getAbilityConfig('SETTINGS')
    .spaceCombatParticipating as UnitBaseType[]
  return participating.includes('MECH')
}

/** How many of the LIVING mechs are still in the space area. `mechsOnGround`
 *  says how many stay on the planet; the rest are in space. The mechs are
 *  fungible units, so which pool a casualty came from is the player's call —
 *  that attribution IS the strategy: WIN_IN_SPACE gives up ground mechs
 *  first (space presence lasts as long as possible), the preserve options
 *  give up space mechs first (the ground pool is kept intact for later). */
function spaceMechsRemaining(ctx: AbilityReadContext, params: Params): number {
  const alive = ctx.api.own.countUnits('MECH', { includeVariants: true })
  const initial = params._initialMechs > 0 ? params._initialMechs : alive
  const ground = Math.min(params.mechsOnGround, initial)
  const space = initial - ground
  const dead = Math.max(0, initial - alive)
  if (params.strategy === 'WIN_IN_SPACE') {
    const groundDead = Math.min(dead, ground)
    return Math.max(0, space - (dead - groundDead))
  }
  return Math.max(0, space - dead)
}

// Il Na Viroset mech. "This unit participates in space combat as if it were a
// ship. For each anomaly this unit is in or adjacent to, apply +1 to this
// unit's rolls." The mechs fight in space combat wherever they are — from a
// planet's surface or as transported cargo — but they only join while an own
// ship is actually in the system: with no ships fielded there is no space
// combat for them to be part of.
//
// The combat continues while the side holds the space area: ships OR mechs
// that are physically in it. `mechsOnGround` says how many mechs stay on the
// planet (the rest are in space; the default of 0 commits everything to the
// space fight, matching the default strategy). Only once nothing but ground
// mechs remain does the fighting stop, with those mechs alive on the ground.
// The `strategy` select decides how mech casualties are attributed and
// whether the mechs spend their Sustain Damage:
//
// - WIN_IN_SPACE (default) — ground mechs are given up first, so the space
//   presence (and the combat) lasts as long as possible.
// - PRESERVE_SUSTAIN — space mechs are given up first; the ground pool
//   survives the fleet's death, still using its sustains along the way.
// - PRESERVE_NO_SUSTAIN — as above, and the mechs never sustain in space
//   combat, entering the ground fight undamaged.
//
// The anomaly count is a manual input (adjacency is out of scope for a
// single-system calculator).
export const starlancerXI: Ability<Params> = {
  key: 'TF_STARLANCER_XI',
  name: 'Starlancer XI',
  description:
    'This unit participates in space combat as if it were a ship. For each anomaly this unit is in or adjacent to, apply +1 to this unit’s rolls.',
  context: 'SPACE',
  paramsSchema: z.object({
    anomalies: z.number(),
    mechsOnGround: z.number(),
    strategy: z.string(),
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    anomalies: 0,
    mechsOnGround: 0,
    strategy: 'WIN_IN_SPACE',
    _initialMechs: 0,
  },
  // The mech's printed text — always on while mechs are fielded.
  readOnly: true,
  headerUI: 'isEnabled',
  // Surface MECH in the space Unit Priority panel (Hel-Titan pattern): the
  // reconcile-time participation change makes MECH a draggable entry in
  // `UNIT_PRIORITY.spaceUnitPriority`, defaulting to its worth slot (after
  // fighters/destroyers, before cruisers). Drag it to the FRONT to sacrifice
  // mechs in space first, or to the END to save them for the ground fight.
  // `resetSettingsToBase` drops this before the engine run; the PREPARE
  // invoke below restores participation at runtime. The dependent lists
  // (`SUSTAIN_DAMAGE.spacePriority`, `UNIT_PRIORITY.spaceUnitPriority`)
  // already picked MECH up at reconcile and keep it — only the SETTINGS
  // group itself needs the runtime restore.
  declareParamChange: () => [
    { key: 'spaceCombatParticipating', value: 'MECH' },
  ],
  uiConfig: ctx => [
    {
      key: 'strategy',
      label: 'Strategy',
      type: 'select',
      items: [
        { label: 'Win in space', value: 'WIN_IN_SPACE' },
        { label: 'Save ground (sustain)', value: 'PRESERVE_SUSTAIN' },
        { label: 'Save ground (no sustain)', value: 'PRESERVE_NO_SUSTAIN' },
      ],
    },
    {
      key: 'mechsOnGround',
      label: 'Mechs on ground',
      type: 'number',
      min: 0,
      max: ctx.api.own.countUnits('MECH', { includeVariants: true }),
    },
    {
      key: 'anomalies',
      label: 'Anomalies in or adjacent (+1 each)',
      type: 'number',
      min: 0,
      max: 6,
    },
  ],
  invoke: [
    {
      timing: 'PREPARE',
      // The mechs need an own ship in the system to fight alongside: with no
      // ships fielded they stay on the ground and space combat proceeds (or
      // completes) without them.
      isCallable: (_params, ctx) => ownShipsFielded(ctx),
      call: (ctx, params) => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          spaceCombatParticipating: (current: UnitBaseType[]) =>
            current.includes('MECH') ? current : [...current, 'MECH'],
        })
        // Snapshot the fielded mech count so casualty attribution can tell
        // the space pool from the ground pool later.
        ctx.api.own.updateAbilityConfig({
          _initialMechs: ctx.api.own.countUnits('MECH', {
            includeVariants: true,
          }),
        })
        if (params.strategy === 'PRESERVE_NO_SUSTAIN') {
          ctx.api.own.updateAbilityConfig('SUSTAIN_DAMAGE', {
            spacePriority: (current: UnitList<boolean>) =>
              current.map(([key, value]) =>
                key === 'MECH' || key.startsWith('MECH:')
                  ? ([key, false] as [typeof key, boolean])
                  : ([key, value] as [typeof key, boolean]),
              ),
          })
        }
      },
    },
    {
      // The combat continues while the side holds the space area — ships or
      // space-area mechs. Once only ground mechs remain they drop out (they
      // are not in the space area and cannot keep the fight going), the wipe
      // check ends the combat, and they survive on the ground.
      timing: 'AFTER_DESTROY',
      isCallable: (params, ctx) =>
        mechsParticipating(ctx) &&
        !ownShipsFielded(ctx) &&
        spaceMechsRemaining(ctx, params) === 0,
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          spaceCombatParticipating: (current: UnitBaseType[]) =>
            current.filter(t => t !== 'MECH'),
        })
      },
    },
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      isCallable: params => params.anomalies > 0,
      call: (ctx, params) => {
        ctx.api.own.applyBonusToResult(params.anomalies, 'MECH')
      },
    },
  ],
}
