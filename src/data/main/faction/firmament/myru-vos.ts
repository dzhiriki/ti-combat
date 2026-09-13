import firmamentIcon from '@/assets/faction/firmament.svg?raw'
import type { Ability } from '@/combat/abilities-engine/types'

export const myruVos: Ability = {
  key: 'MYRU_VOS',
  name: 'Myru Vos',
  description:
    'When a player moves ships: You may exhaust this card; if you do, Space Cannon cannot be used against those ships.',
  icon: firmamentIcon,
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      external: true,
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          ctx.this.key,
        )
      },
    },
  ],
}
