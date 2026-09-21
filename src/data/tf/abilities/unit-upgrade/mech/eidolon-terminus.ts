import vuilraithCabalIcon from '@/assets/faction/vuilraith_cabal.svg?raw'
import type { Ability } from '@/combat'
import { createStatsTransformInvoke } from '@/utils/create-stats-transform-invoke'

export const eidolonTerminus: Ability = {
  key: 'TF_UPGRADE_EIDOLON_TERMINUS',
  icon: vuilraithCabalIcon,
  name: 'Eidolon Terminus',
  description: 'The Combat value of your mechs is reduced by 1.',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  // Mech upgrades stack: no exclusiveGroup.
  invoke: [
    createStatsTransformInvoke('MECH', stats => {
      const combat = stats.COMBAT
      if (!combat) return {}
      return {
        COMBAT: [Math.max(1, combat[0] - 1), combat[1]],
      }
    }),
  ],
}
