import titansOfUlIcon from '@/assets/faction/titans_of_ul.svg?raw'
import type { Ability } from '@/combat'

export const tellurian: Ability = {
  key: 'TELLURIAN',
  name: 'Tellurian',
  description:
    'When a hit is produced against a unit: You may exhaust this card to cancel that hit.',
  icon: titansOfUlIcon,
  headerUI: 'isEnabled',
  params: {
    isEnabled: false,
    uses: 1,
  },
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      external: true,
      isCallable: (_params, ctx) => ctx.api.own.getPendingHits() > 0,
      call: ctx => {
        ctx.api.own.reduceHits(1)
      },
    },
  ],
}
