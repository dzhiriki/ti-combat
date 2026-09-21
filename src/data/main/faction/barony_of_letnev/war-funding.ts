import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
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
  opponentStrategyKind: RerollStrategy['kind']
  opponentStrategyThreshold: number
}

declare global {
  interface AbilityConfigMap {
    WAR_FUNDING: Params
  }
}

export const warFunding: Ability<Params> = {
  key: 'WAR_FUNDING',
  name: 'War Funding',
  description:
    "After you and your opponent roll dice during a space combat: You may reroll all of your opponent's dice. You may reroll any number of your dice. Then, return this card to the Letnev player.",
  icon: baronyOfLetnevIcon,
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
    ownStrategyKind: 'ALWAYS',
    ownStrategyThreshold: 0,
    opponentStrategyKind: 'IF_HITS_PERCENT_GE',
    opponentStrategyThreshold: 50,
  },
  headerUI: 'isEnabled',
  uiConfig: (_ctx, params) => [
    ...rerollStrategyConfig<Params>(
      'ownStrategyKind',
      'ownStrategyThreshold',
      params.ownStrategyKind,
      'Own dice',
    ),
    ...rerollStrategyConfig<Params>(
      'opponentStrategyKind',
      'opponentStrategyThreshold',
      params.opponentStrategyKind,
      'Opponent dice',
    ),
  ],
  invoke: [
    {
      timing: 'REROLL_DICE_ROLL',
      declaration: true,
      call: (ctx, params) => {
        const ownStrategy = buildRerollStrategy(
          params.ownStrategyKind,
          params.ownStrategyThreshold,
        )
        const opponentStrategy = buildRerollStrategy(
          params.opponentStrategyKind,
          params.opponentStrategyThreshold,
        )
        ctx.declareReroll({
          OWN: {
            target: 'MISSES',
            rerollIf: strategyToPredicate(ownStrategy),
          },
          OPPONENT: {
            target: 'ALL',
            rerollIf: strategyToPredicate(opponentStrategy),
          },
        })
      },
    },
  ],
}
