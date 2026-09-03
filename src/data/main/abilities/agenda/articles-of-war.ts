import type { Ability } from '@/combat'
import { UNIT_ABILITIES } from '@/constants/units'

type Params = {
  isEnabled: boolean
}

export const articlesOfWar: Ability<Params> = {
  key: 'ARTICLES_OF_WAR',
  name: 'Articles of War',
  description:
    'All mechs lose their printed abilities except for Sustain Damage.',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  sync: true,
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        for (const ability of UNIT_ABILITIES) {
          if (ability === 'SUSTAIN_DAMAGE') continue
          ctx.api.own.setUnitAbilityLost(ability, ctx.this.key, 'MECH')
        }

        // Remove printed Ability objects from mech units (keep only Sustain Damage)
        const mechStats = ctx.api.own.getUnitStats('MECH')
        if (mechStats?.ABILITIES) {
          ctx.api.own.modifyUnitType('MECH', {
            ABILITIES: mechStats.ABILITIES.filter(
              a => a.key === 'SUSTAIN_DAMAGE',
            ),
          })
        }
      },
    },
  ],
}
