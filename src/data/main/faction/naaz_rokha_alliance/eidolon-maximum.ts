import type { Ability } from '@/combat'

export const eidolonMaximum: Ability = {
  key: 'EIDOLON_MAXIMUM',
  name: 'Eidolon Maximum',
  description:
    'This unit is both a ship and a ground force. It cannot be assigned hits from unit abilities. Repair it at the start of every combat round.',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  declareParamChange: () => [{ key: 'SHIPS', value: 'MECH' }],
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        // Disable base Eidolon ability (prevent Z-Grav transform)
        ctx.api.own.updateAbilityConfig('EIDOLON', { isEnabled: false })

        const stats = ctx.api.own.getUnitStats('MECH')!
        // Modify all mechs to Eidolon Maximum form: combat [4, 4]
        ctx.api.own.modifyUnitType('MECH', {
          CATEGORIES: ['GROUND_FORCES', 'SHIPS'],
          UNIT_ABILITY_HIT_IMMUNE: true,
          COMBAT: [4, 4, stats.COMBAT![2] ?? 0],
        })
      },
    },
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        // Repair damaged mechs at start of each round
        for (const id of ctx.api.own.participating.getUnits('MECH', {
          includeVariants: true,
        })) {
          if (ctx.api.own.getUnitState(id)?.isDamaged) {
            ctx.api.own.modifyUnitState(id, { isDamaged: false })
          }
        }
      },
    },
  ],
}
