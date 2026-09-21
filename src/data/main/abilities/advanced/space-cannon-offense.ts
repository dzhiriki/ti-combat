import { z } from 'zod/mini'

import {
  type AbilitiesOverride,
  type Ability,
  declareParam,
  parseVariantId,
} from '@/combat'
import type { UnitList, UnitType } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  customPriority: boolean
  unitPriority: UnitList
  disableSustainDamage: boolean
}

declare global {
  interface AbilityConfigMap {
    SPACE_CANNON_OFFENSE: Params
  }
}

const isFighter = ([v]: [UnitType]) =>
  parseVariantId(v as UnitType).type === 'FIGHTER'

/** Reorder a priority list so fighters sort last (Graviton Laser System:
 *  hits must hit non-fighter ships if able). */
function fightersLast(priority: UnitList): UnitList {
  return [...priority.filter(p => !isFighter(p)), ...priority.filter(isFighter)]
}

export const spaceCannonOffense: Ability<Params> = {
  key: 'SPACE_CANNON_OFFENSE',
  name: 'Space Cannon Offense',
  description: 'Space Cannon Offense is resolved only when enabled',
  context: 'SPACE',
  paramsSchema: z.object({
    customPriority: z.boolean(),
    unitPriority: UnitListSchema,
    disableSustainDamage: z.boolean(),
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    customPriority: false,
    unitPriority: declareParam<UnitList>({
      default: [],
      source: 'SHIPS',
      side: 'opponent',
    }),
    disableSustainDamage: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'SPACE_CANNON_OFFENSE_STEP',
      call: (ctx, params) => {
        // This side owns the priority for hits it produces. By default it
        // inherits the target's normal UNIT_PRIORITY; a custom list or an
        // "if able" effect overrides it only for this resolution.
        const opp = ctx.api.opponent
        // Graviton Laser System and Twilight's Fall's "Converge" action card
        // force ALL of a side's Space Cannon hits onto non-fighter ships if
        // able. (The Justiciar Rail PDS restricts only its own hits — that's a
        // per-source hit-pool transform on the card itself, not a step-wide
        // hook; see src/data/tf/abilities/unit-upgrade/pds/justiciar-rail.ts.)
        const own = ctx.api.own
        const glsEnabled =
          own.getAbilityConfig('GRAVITON_LASER_SYSTEM')?.isEnabled === true ||
          own.getAbilityConfig('TF_CONVERGE')?.isEnabled === true

        let priority: UnitList | undefined = params.customPriority
          ? params.unitPriority
          : glsEnabled
            ? (opp.getAbilityConfig('UNIT_PRIORITY').spaceUnitPriority ?? [])
            : undefined

        if (glsEnabled && priority) priority = fightersLast(priority)

        const override: AbilitiesOverride = {}
        if (priority)
          override.SPACE_CANNON_OFFENSE = {
            customPriority: true,
            unitPriority: priority,
          }
        if (params.disableSustainDamage) override.SUSTAIN_DAMAGE = false

        ctx.resolveStep('SPACE_CANNON_OFFENSE', {
          deferPhaseEndCheck: true,
          abilitiesOverride:
            Object.keys(override).length > 0 ? override : undefined,
        })
      },
    },
  ],
  uiConfig: (ctx, params) => {
    if (ctx.state.combatMode !== 'SPACE') return []
    return [
      {
        key: 'disableSustainDamage',
        label: 'Disable Sustain Damage',
        type: 'checkbox',
      },
      {
        key: 'customPriority',
        label: 'Custom unit priority',
        type: 'checkbox',
      },
      {
        key: 'unitPriority',
        type: 'unit-list',
        mode: 'order',
        items: ctx.api.own.getUnitVariantsOptions('unitPriority'),
        visible: params.customPriority,
      },
    ]
  },
}
