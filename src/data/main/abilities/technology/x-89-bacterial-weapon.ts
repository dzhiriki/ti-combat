import type { Ability } from '@/combat'

export const x89BacterialWeapon: Ability = {
  key: 'X_89_BACTERIAL_WEAPON',
  name: 'X-89 Bacterial Weapon',
  description:
    "Double the hits produced by your units' Bombardment and ground combat rolls. Exhaust each planet you use Bombardment against.",
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_UNIT_ABILITY_ROLL',
      context: 'BOMBARDMENT',
      isCallable: (_params, ctx) => {
        return ctx.api.opponent.getPendingHits({ base: true }) >= 1
      },
      call: ctx => {
        const base = ctx.api.opponent.getPendingHits({ base: true })
        ctx.api.opponent.addHits(base)
      },
    },
    {
      timing: 'AFTER_DICE_ROLL',
      context: 'GROUND_COMBAT',
      isCallable: (_params, ctx) => {
        return ctx.api.opponent.getPendingHits({ base: true }) >= 1
      },
      call: ctx => {
        const base = ctx.api.opponent.getPendingHits({ base: true })
        ctx.api.opponent.addHits(base)
      },
    },
  ],
}
