import argentFlightIcon from '@/assets/faction/argent_flight.svg?raw'
import type { Ability } from '@/combat'
import { strikeWingAlphaII } from '@/data/main/faction/argent_flight/strike-wing-alpha-ii'
import { cloneAbility } from '@/data/tf/clone-ability'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

// The Argent Flight Strike Wing Alpha II under the card's key: each natural 9
// or 10 on the Anti-Fighter Barrage of a unit carrying it also destroys 1 of
// the opponent's infantry in the space area. The Faces of Janovet copies it
// along with the stat block.
const strikeWingAlphaText = cloneAbility(strikeWingAlphaII, {
  key: 'TF_UPGRADE_STRIKE_WING_ALPHA',
  icon: argentFlightIcon,
  name: 'Strike Wing Alpha',
})

const statsInvoke = createStatsInvoke('DESTROYER', {
  COST: 1,
  COMBAT: [7, 1],
  MOVE: 2,
  CAPACITY: 1,
  UNIT_ABILITIES: { AFB: [6, 3] },
  ABILITIES: [strikeWingAlphaText],
})

// The card registers the text's params and controls and applies the stat
// block; the text fires from each unit that carries it.
export const strikeWingAlpha: Ability = {
  ...strikeWingAlphaText,
  // The stat block applies in ground combat too; only the text is space-only.
  context: undefined,
  exclusiveGroup: 'UNIT_UPGRADE_DESTROYER',
  invoke: [statsInvoke],
}
