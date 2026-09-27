import type { Ability } from '@/combat'
import type { UnitList } from '@/types'

type Params = {
  customPriority: boolean
  unitPriority: UnitList
}

declare global {
  interface AbilityConfigMap {
    ANTI_FIGHTER_BARRAGE: Params
  }
}

export const antiFighterBarrage: Ability<Params> = {
  key: 'ANTI_FIGHTER_BARRAGE',
  name: 'Anti-Fighter Barrage',
  description: 'AFB is resolved only when enabled',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
    // Waylay turns this off so hits follow the target's space priority.
    customPriority: true,
    unitPriority: [['FIGHTER']],
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      // Both sides barrage simultaneously in one combined dice-roll group.
      // Normally the attacker dispatches it; if the attacker opts out, the
      // defender does. Keep `firing` relative to whichever side dispatched so
      // resolveStep can map OWN / OPPONENT to the actual combat sides.
      timing: 'AFB_STEP',
      isCallable: (_params, ctx) => {
        if (ctx.side === 'attacker') {
          return true
        }

        return !ctx.api.opponent.getAbilityConfig('ANTI_FIGHTER_BARRAGE')
          .isEnabled
      },
      call: ctx => {
        const firing: ('OWN' | 'OPPONENT')[] = []
        if (ctx.api.own.getAbilityConfig('ANTI_FIGHTER_BARRAGE').isEnabled)
          firing.push('OWN')
        if (ctx.api.opponent.getAbilityConfig('ANTI_FIGHTER_BARRAGE').isEnabled)
          firing.push('OPPONENT')
        if (firing.length === 0) return

        ctx.resolveStep('AFB', {
          firing,
        })
      },
    },
  ],
}
