import { type AbilitiesOverride, type Ability, parseVariantId } from '@/combat'
import type { UnitList, UnitType } from '@/types'

type Params = { disableSustainDamage: boolean }

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
        const priority = convergeEnabled
          ? mechsFirst(
              ctx.api.opponent.getAbilityConfig('UNIT_PRIORITY')
                .groundUnitPriority ?? [],
            )
          : undefined

        const override: AbilitiesOverride = {}
        if (priority) override.UNIT_PRIORITY = { groundUnitPriority: priority }
        if (params.disableSustainDamage) override.SUSTAIN_DAMAGE = false

        ctx.resolveStep('SPACE_CANNON_DEFENSE', {
          abilitiesOverride:
            Object.keys(override).length > 0 ? override : undefined,
        })
      },
    },
  ],
}
