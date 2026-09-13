import l1z1xMindnetIcon from '@/assets/faction/l1z1x_mindnet.svg?raw'
import type { Ability } from '@/combat/abilities-engine/types'

export const twoRam: Ability = {
  key: 'TWO_RAM',
  name: '2RAM',
  description:
    'Units that have Planetary Shield do not prevent you from using Bombardment.',
  icon: l1z1xMindnetIcon,
  context: 'GROUND',
  side: 'attacker',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', ctx.this.key)
      },
    },
  ],
}
