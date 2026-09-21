import universitiesOfJolNarIcon from '@/assets/faction/universities_of_jol_nar.svg?raw'
import type { Ability } from '@/combat'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

const statsInvoke = createStatsInvoke('WAR_SUN', {
  COST: 10,
  COMBAT: [4, 3],
  MOVE: 3,
  CAPACITY: 6,
  UNIT_ABILITIES: { SUSTAIN_DAMAGE: true, BOMBARDMENT: [4, 3] },
  ABILITIES: [sustainDamage],
})

export const universityWarSun: Ability = {
  key: 'TF_UPGRADE_UNIVERSITY_WAR_SUN',
  icon: universitiesOfJolNarIcon,
  name: 'University War Sun',
  description: "Other players' units in this system lose Planetary Shield.",
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_WAR_SUN',
  invoke: [
    {
      ...statsInvoke,
      timing: 'PREPARE',
      call: (ctx, params) => {
        statsInvoke.call(ctx, params)
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', ctx.this.key)
      },
    },
  ],
}
