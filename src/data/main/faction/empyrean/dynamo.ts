import type { Ability } from '@/combat/abilities-engine/types'

type Params = {
  isEnabled: boolean
  uses: number
}

export const dynamo: Ability<Params> = {
  key: 'DYNAMO',
  name: 'Dynamo',
  description:
    "After any player's unit in this system or an adjacent system uses Sustain Damage, you may spend 2 influence to repair that unit.",
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      external: true,
      isCallable: (_, ctx, unitId) =>
        ctx.api.own.hasUnit(unitId) &&
        ctx.api.own.getUnitState(unitId)?.isDamaged === true,
      call: (ctx, _params, unitId) => {
        ctx.api.own.modifyUnitState(unitId, { isDamaged: false })
      },
    },
    {
      timing: 'DESTROY',
      isCallable: (_params, ctx, ids) =>
        ctx.unitSource !== undefined && ids.includes(ctx.unitSource),
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ uses: 0 })
      },
    },
  ],
}
