import type { Ability } from '@/combat'

declare global {
  interface AbilityConfigMap {
    ANTI_FIGHTER_BARRAGE: Record<string, never>
  }
}

export const antiFighterBarrage: Ability = {
  key: 'ANTI_FIGHTER_BARRAGE',
  name: 'Anti-Fighter Barrage',
  description: 'AFB is resolved only when enabled',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
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
