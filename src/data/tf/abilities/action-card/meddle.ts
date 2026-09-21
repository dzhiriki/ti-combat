import type { Ability } from '@/combat'
import { heartOfIxth } from '@/data/main/abilities/relic/heart-of-ixth'
import { cloneAbility } from '@/data/tf/clone-ability'

// Same effect as the Heart of Ixth relic; the clone's own key lets a faction
// hold both Meddle (action card) and Heart of Ixth (relic).
export const meddle: Ability = cloneAbility(heartOfIxth, {
  key: 'TF_MEDDLE',
  name: 'Meddle',
  description: 'When any die is rolled: Add or subtract 1 from its result.',
})
