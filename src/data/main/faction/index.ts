import type { Faction } from '@/types'

import { nekro_virus } from './nekro_virus'
import { otherFactions } from './other-factions'
import { yssaril_tribes } from './yssaril_tribes'

export default {
  ...otherFactions,
  NEKRO_VIRUS: nekro_virus,
  YSSARIL_TRIBES: yssaril_tribes,
} satisfies Record<string, Faction>
