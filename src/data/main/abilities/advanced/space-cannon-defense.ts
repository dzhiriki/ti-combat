import {
  type AbilitiesOverride,
  type Ability,
  declareParam,
  parseVariantId,
} from '@/combat'
import type { UnitList, UnitType } from '@/types'

type Params = {
  customPriority: boolean
  unitPriority: UnitList
  disableSustainDamage: boolean
}

declare global {
  interface AbilityConfigMap {
    SPACE_CANNON_DEFENSE: Params
  }
}

const isMech = ([v]: [UnitType]) =>
  parseVariantId(v as UnitType).type === 'MECH'

/** Reorder a priority list so mechs sort first (Converge's defense clause:
 *  Space Cannon Defense hits must be assigned to mechs if able). Mirrors
 *  SCO's `fightersLast` — units at the front of the phase priority list
 *  take hits first. */
function mechsFirst(priority: UnitList): UnitList {
  return [...priority.filter(isMech), ...priority.filter(p => !isMech(p))]
}

export const spaceCannonDefense: Ability<Params> = {
  key: 'SPACE_CANNON_DEFENSE',
  name: 'Space Cannon Defense',
  description: 'Space Cannon Defense is resolved only when enabled',
  side: 'defender',
  params: {
    isEnabled: true,
    uses: Infinity,
    customPriority: false,
    unitPriority: declareParam<UnitList>({
      default: [],
      source: 'GROUND_FORCES',
      side: 'opponent',
    }),
    disableSustainDamage: false,
  },
  headerUI: 'isEnabled',
  uiConfig: [
    {
      key: 'disableSustainDamage',
      label: 'Disable Sustain Damage',
      type: 'checkbox',
    },
  ],
  invoke: [
    {
      timing: 'SPACE_CANNON_DEFENSE_STEP',
      call: (ctx, params) => {
        // Twilight's Fall "Converge": our Space Cannon Defense hits must be
        // assigned to mechs, if able. Patch the attacker's ground priority so
        // mechs sort first (same mechanism as Graviton Laser System in SCO).
        const convergeEnabled =
          ctx.api.own.getAbilityConfig('TF_CONVERGE')?.isEnabled === true
        const basePriority = params.customPriority
          ? params.unitPriority
          : (ctx.api.opponent.getAbilityConfig('UNIT_PRIORITY')
              .groundUnitPriority ?? [])
        const priority = convergeEnabled ? mechsFirst(basePriority) : undefined

        const override: AbilitiesOverride = {}
        if (priority)
          override.SPACE_CANNON_DEFENSE = {
            customPriority: true,
            unitPriority: priority,
          }
        if (params.disableSustainDamage) override.SUSTAIN_DAMAGE = false

        ctx.resolveStep('SPACE_CANNON_DEFENSE', {
          abilitiesOverride:
            Object.keys(override).length > 0 ? override : undefined,
        })
      },
    },
  ],
}
