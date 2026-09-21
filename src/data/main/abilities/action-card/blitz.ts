import type { Ability } from '@/combat'

export const blitz: Ability = {
  key: 'BLITZ',
  name: 'Blitz',
  description:
    'At the start of an invasion: Each of your non-fighter ships in the active system that do not have Bombardment gain Bombardment 6 until the end of the invasion.',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  side: 'attacker',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        const { nonFighterShips } = ctx.api.own.getAbilityConfig('SETTINGS')
        for (const unitType of nonFighterShips) {
          const stats = ctx.api.own.getUnitStats(unitType)!
          const hasBombardment = stats.UNIT_ABILITIES?.BOMBARDMENT

          if (!hasBombardment) {
            ctx.api.own.modifyUnitType(unitType, {
              UNIT_ABILITIES: {
                BOMBARDMENT: [6, 1],
              },
            })
          }
        }
      },
    },
  ],
}
