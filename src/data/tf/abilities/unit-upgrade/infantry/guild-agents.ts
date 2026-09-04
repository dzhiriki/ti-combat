import yssarilTribesIcon from '@/assets/faction/yssaril_tribes.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const guildAgents: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_GUILD_AGENTS',
  icon: yssarilTribesIcon,
  name: 'Guild Agents',
  unitType: 'INFANTRY',
  cost: 0.5,
  combat: [7, 1],
})
