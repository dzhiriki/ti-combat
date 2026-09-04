import argentFlightIcon from '@/assets/faction/argent_flight.svg?raw'
import type { Ability } from '@/combat'
import { raidFormation as ti4RaidFormation } from '@/data/main/faction/argent_flight/raid-formation'
import { cloneAbility } from '@/data/tf/clone-ability'

export const raidFormation: Ability = cloneAbility(ti4RaidFormation, {
  key: 'TF_RAID_FORMATION',
  icon: argentFlightIcon,
})
