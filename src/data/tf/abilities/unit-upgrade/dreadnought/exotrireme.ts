import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import type { Ability } from '@/combat'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import { exotrireme as sardakkExotrireme } from '@/data/main/faction/sardakk_norr/exotrireme'
import { cloneAbility } from '@/data/tf/clone-ability'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

// The Sardakk N'orr Exotrireme II under the card's key: after a round of
// space combat, each dreadnought carrying it may destroy itself to destroy up
// to 2 of the opponent's ships (picked by target priority), one use per
// sacrifice. The Faces of Janovet copies it along with the stat block.
const exotriremeText = cloneAbility(sardakkExotrireme, {
  key: 'TF_UPGRADE_EXOTRIREME',
  icon: sardakkNorrIcon,
  name: 'Exotrireme',
  description:
    "This unit cannot be destroyed by 'Spark' action cards. After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system.",
})

const statsInvoke = createStatsInvoke('DREADNOUGHT', {
  COST: 4,
  COMBAT: [4, 1],
  MOVE: 2,
  CAPACITY: 1,
  UNIT_ABILITIES: { SUSTAIN_DAMAGE: true, BOMBARDMENT: [4, 2] },
  ABILITIES: [exotriremeText, sustainDamage],
  DIRECT_HIT_IMMUNE: true,
})

// The card registers the text's params, controls, and sacrifice order (the
// engine reads `sort` from the registered ability) and applies the stat
// block. Setup applies the block too, so the sacrifice list offers every unit
// carrying the text. Unlike the Sardakk N'orr ability, the card itself is
// switched on (the upgrade is held) apart from its uses, 0 by default.
export const exotrireme: Ability = {
  ...exotriremeText,
  params: { ...exotriremeText.params, isEnabled: false },
  headerUI: 'isEnabled',
  // The stat block applies in ground combat too; only the text is space-only.
  context: undefined,
  exclusiveGroup: 'UNIT_UPGRADE_DREADNOUGHT',
  declareChanges: statsInvoke.call,
  invoke: [statsInvoke],
}
