import type { AbilityInvoke } from '@/combat'

import type { StatsTransformInvoke } from './create-stats-transform-invoke'

export function isStatsTransformInvoke(
  invoke: AbilityInvoke,
): invoke is StatsTransformInvoke {
  return 'kind' in invoke && invoke.kind === 'stats-transform'
}
