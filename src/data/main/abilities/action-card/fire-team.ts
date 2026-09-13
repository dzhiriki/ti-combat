import type { Ability } from '@/combat'
import {
  buildRerollStrategy,
  type RerollStrategy,
  rerollStrategyConfig,
  strategyToPredicate,
} from '@/combat/dice-math/reroll-strategy'

type Params = {
  ownStrategyKind: RerollStrategy['kind']
  ownStrategyThreshold: number
}

declare global {
  interface AbilityConfigMap {
    FIRE_TEAM: Params
  }
}

export const fireTeam: Ability<Params> = {
  key: 'FIRE_TEAM',
  name: 'Fire Team',
  description:
    'After your ground forces make combat rolls during a round of ground combat: Reroll any number of your dice.',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: 1,
    ownStrategyKind: 'ALWAYS',
    ownStrategyThreshold: 0,
  },
  headerUI: 'isEnabled',
  uiConfig: (_ctx, params) =>
    rerollStrategyConfig<Params>(
      'ownStrategyKind',
      'ownStrategyThreshold',
      params.ownStrategyKind,
      'Own dice',
    ),
  invoke: [
    {
      timing: 'REROLL_DICE_ROLL',
      declaration: true,
      call: (ctx, params) => {
        const strategy = buildRerollStrategy(
          params.ownStrategyKind,
          params.ownStrategyThreshold,
        )
        ctx.api.own.declareReroll({
          target: 'MISSES',
          rerollIf: strategyToPredicate(strategy),
        })
      },
    },
  ],
}
