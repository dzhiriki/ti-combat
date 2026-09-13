import yssarilTribesIcon from '@/assets/faction/yssaril_tribes.svg?raw'
import type { Ability } from '@/combat'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const guildAgents: Ability = {
  key: 'TF_UPGRADE_GUILD_AGENTS',
  icon: yssarilTribesIcon,
  name: 'Guild Agents',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_INFANTRY',
  invoke: [
    createStatsInvoke('INFANTRY', {
      COST: 0.5,
      COMBAT: [7, 1],
      UNIT_ABILITIES: {},
    }),
  ],
}
