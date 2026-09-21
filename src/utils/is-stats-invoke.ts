import type { AbilityInvoke } from '@/combat'

import type { StatsInvoke } from './create-stats-invoke'

export function isStatsInvoke(invoke: AbilityInvoke): invoke is StatsInvoke {
  return 'kind' in invoke && invoke.kind === 'stats'
}
