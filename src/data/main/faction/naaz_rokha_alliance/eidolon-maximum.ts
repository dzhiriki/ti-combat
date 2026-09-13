import type { Ability } from '@/combat'
import type { UnitBaseType } from '@/types'

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
  declareParamChange: () => [{ key: 'ships', value: 'MECH' }],
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        // Disable base Eidolon ability (prevent Z-Grav transform)
        ctx.api.own.updateAbilityConfig('EIDOLON', { isEnabled: false })

        ctx.api.own.updateAbilityConfig('SETTINGS', {
          // Add MECH to ships for space combat participation
          ships: (current: UnitBaseType[]) =>
            current.includes('MECH') ? current : [...current, 'MECH'],
          // Remove MECH from groundForces so derived valid targets
          // (bombardment, SCD) exclude it — unit ability hit immunity
          groundForces: (current: UnitBaseType[]) =>
            current.filter(u => u !== 'MECH'),
        })

        const stats = ctx.api.own.getUnitStats('MECH')!
        // Modify all mechs to Eidolon Maximum form: combat [4, 4]
        ctx.api.own.modifyUnitType('MECH', {
          COMBAT: [4, 4, stats.COMBAT![2] ?? 0],
        })
      },
    },
    {
      // Eidolon Maximum is immune to SCO/AFB — if an ability (e.g. Waylay)
      // expands targets to include MECH, remove it. Uses isCallable to
      // defer until after the expanding ability fires (alternating resolution).
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['AFB', 'SPACE_CANNON_OFFENSE'],
      isCallable: (_params, ctx) => {
        const settings = ctx.api.own.getAbilityConfig('SETTINGS')
        const afb = settings?.validTargetsAntiFighterBarrage ?? []
        const sco = settings?.validTargetsSpaceCannonOffense ?? []
        return afb.includes('MECH') || sco.includes('MECH')
      },
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          validTargetsAntiFighterBarrage: (current: UnitBaseType[]) =>
            current.filter(u => u !== 'MECH'),
          validTargetsSpaceCannonOffense: (current: UnitBaseType[]) =>
            current.filter(u => u !== 'MECH'),
        })
      },
    },
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        // Restore MECH to groundForces for ground combat participation
        // (bombardment/SCD are done by this point)
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitBaseType[]) =>
            current.includes('MECH') ? current : [...current, 'MECH'],
        })

        // Repair damaged mechs at start of each round
        for (const id of ctx.api.own.getUnits('MECH', {
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
