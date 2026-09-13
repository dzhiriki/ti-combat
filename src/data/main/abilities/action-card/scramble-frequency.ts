import type { Ability } from '@/combat'
import {
  buildRerollStrategy,
  type RerollStrategy,
  rerollStrategyConfig,
  strategyToPredicate,
} from '@/combat/dice-math/reroll-strategy'

type Params = {
  opponentStrategyKind: RerollStrategy['kind']
  opponentStrategyThreshold: number
}

declare global {
  interface AbilityConfigMap {
    SCRAMBLE_FREQUENCY: Params
  }
}

export const scrambleFrequency: Ability<Params> = {
  key: 'SCRAMBLE_FREQUENCY',
  name: 'Scramble Frequency',
  description:
    'After another player makes a Bombardment, Space Cannon, or Anti-Fighter Barrage roll: That player rerolls all of their dice.',
  params: {
    isEnabled: false,
    uses: 1,
    opponentStrategyKind: 'IF_HITS_PERCENT_GE',
    opponentStrategyThreshold: 50,
  },
  headerUI: 'isEnabled',
  uiConfig: (_ctx, params) =>
    rerollStrategyConfig<Params>(
      'opponentStrategyKind',
      'opponentStrategyThreshold',
      params.opponentStrategyKind,
      'Opponent dice',
    ),
  invoke: [
    {
      timing: 'REROLL_UNIT_ABILITY_ROLL',
      declaration: true,
      call: (ctx, params) => {
        const strategy = buildRerollStrategy(
          params.opponentStrategyKind,
          params.opponentStrategyThreshold,
        )
        ctx.api.opponent.declareReroll({
          target: 'ALL',
          rerollIf: strategyToPredicate(strategy),
        })
      },
    },
  ],
}
