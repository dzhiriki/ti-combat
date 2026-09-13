import type { Ability } from '@/combat'
import {
  buildRerollStrategy,
  type RerollStrategy,
  rerollStrategyConfig,
  strategyToPredicate,
} from '@/combat/dice-math/reroll-strategy'

type Params = {
  _useThisRound: boolean
  ownStrategyKind: RerollStrategy['kind']
  ownStrategyThreshold: number
}

declare global {
  interface AbilityConfigMap {
    MUNITIONS_RESERVES: Params
  }
}

export const munitionsReserves: Ability<Params> = {
  key: 'MUNITIONS_RESERVES',
  name: 'Munitions Reserves',
  description:
    'At the start of each round of space combat, you may spend 2 trade goods; you may reroll any number of your dice during that combat round.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: 0,
    _useThisRound: false,
    ownStrategyKind: 'ALWAYS',
    ownStrategyThreshold: 0,
  },
  headerUI: 'uses',
  uiConfig: (_ctx, params) =>
    rerollStrategyConfig<Params>(
      'ownStrategyKind',
      'ownStrategyThreshold',
      params.ownStrategyKind,
      'Own dice',
    ),
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ _useThisRound: true })
      },
    },
    {
      timing: 'REROLL_DICE_ROLL',
      system: true,
      isCallable: params =>
        params._useThisRound && params.ownStrategyKind !== 'NEVER',
      call: (ctx, params) => {
        const strategy = buildRerollStrategy(
          params.ownStrategyKind,
          params.ownStrategyThreshold,
        )
        ctx.api.own.declareReroll({
          target: 'MISSES',
          rerollIf: strategyToPredicate(strategy),
          consumeUseIf: () => false,
        })
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      system: true,
      isCallable: params => params._useThisRound,
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ _useThisRound: false })
      },
    },
  ],
}
