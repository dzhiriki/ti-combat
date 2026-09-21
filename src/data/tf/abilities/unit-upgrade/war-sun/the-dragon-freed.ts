import obsidianIcon from '@/assets/faction/obsidian.svg?raw'
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

export const theDragonFreed: Ability = {
  key: 'TF_UPGRADE_THE_DRAGON_FREED',
  icon: obsidianIcon,
  name: 'The Dragon, Freed',
  description:
    'When this unit uses Bombardment, it uses it against every planet in its system and adjacent systems, ignoring Planetary Shield.',
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
