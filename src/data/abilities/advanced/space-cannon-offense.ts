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
      source: 'spaceCombatParticipating',
    }),
    disableSustainDamage: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'SPACE_CANNON_OFFENSE_STEP',
      call: (ctx, params) => {
        // Our space cannon hits land on the opponent, so the opponent's own SCO
        // unit priority governs how it sacrifices units. We pass that as a
        // resolution-scoped UNIT_PRIORITY override (read by getPhasePriorityList).
        // If we have Graviton Laser System, patch the target's priority so its
        // fighters sort last (hits hit non-fighter ships if able).
        const opp = ctx.api.opponent
        const sc = opp.getAbilityConfig('SPACE_CANNON_OFFENSE')
        // Graviton Laser System, Twilight's Fall's "Converge" action card, and
        // the Justiciar Rail PDS upgrade all force Space Cannon hits onto
        // non-fighter ships if able.
        const own = ctx.api.own
        const glsEnabled =
          own.getAbilityConfig('GRAVITON_LASER_SYSTEM')?.isEnabled === true ||
          own.getAbilityConfig('TF_CONVERGE')?.isEnabled === true ||
          own.getAbilityConfig(
            'TF_UPGRADE_JUSTICIAR_RAIL' as keyof AbilityConfigMap,
          )?.isEnabled === true

        let priority: UnitList | undefined = sc.customPriority
          ? sc.unitPriority
          : glsEnabled
            ? (opp.getAbilityConfig('UNIT_PRIORITY').spaceUnitPriority ?? [])
            : undefined

        if (glsEnabled && priority) priority = fightersLast(priority)

        const override: AbilitiesOverride = {}
        if (priority) override.UNIT_PRIORITY = { spaceUnitPriority: priority }
        if (params.disableSustainDamage) override.SUSTAIN_DAMAGE = false

        ctx.resolveStep('SPACE_CANNON_OFFENSE', {
          deferCompletionCheck: true,
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
