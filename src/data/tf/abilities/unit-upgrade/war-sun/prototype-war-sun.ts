import embersOfMuaatIcon from '@/assets/faction/embers_of_muaat.svg?raw'
import type { Ability } from '@/combat'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

const statsInvoke = createStatsInvoke('WAR_SUN', {
  COST: 12,
  COMBAT: [3, 3],
  MOVE: 2,
  CAPACITY: 6,
  UNIT_ABILITIES: { SUSTAIN_DAMAGE: true, BOMBARDMENT: [3, 3] },
  ABILITIES: [sustainDamage],
})

export const prototypeWarSun: Ability = {
  key: 'TF_UPGRADE_PROTOTYPE_WAR_SUN',
  icon: embersOfMuaatIcon,
  name: 'Prototype War Sun',
  description: "Other players' units in this system lose Planetary Shield.",
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_WAR_SUN',
  invoke: [
    {
      ...statsInvoke,
      timing: 'PREPARE',
      // Attaching an ability during PREPARE is too late for its own PREPARE.
      // Strip Planetary Shield directly in this card's stat application.
      call: (ctx, params) => {
        statsInvoke.call(ctx, params)
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', ctx.this.key)
      },
    },
  ],
}
