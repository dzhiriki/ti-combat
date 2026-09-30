import type { Ability } from '@/combat/abilities-engine/types'

export const arcSecundus: Ability = {
  key: 'ARC_SECUNDUS',
  name: 'Arc Secundus',
  description:
    "Other players' units in this system lose Planetary Shield. At the start of each space combat round, repair this ship.",
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', ctx.this.key)
      },
    },
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (_params, ctx) => ctx.api.own.isParticipating(ctx.getUnit()),
      call: ctx => {
        const unitId = ctx.getUnit()
        ctx.api.own.modifyUnitState(unitId, {
          isDamaged: false,
        })
      },
    },
  ],
}
