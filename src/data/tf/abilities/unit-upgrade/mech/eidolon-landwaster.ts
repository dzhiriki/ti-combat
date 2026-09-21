import naazRokhaAllianceIcon from '@/assets/faction/naaz_rokha_alliance.svg?raw'
import type { Ability } from '@/combat'
import { createStatsTransformInvoke } from '@/utils/create-stats-transform-invoke'

export const eidolonLandwaster: Ability = {
  key: 'TF_UPGRADE_EIDOLON_LANDWASTER',
  icon: naazRokhaAllianceIcon,
  name: 'Eidolon Landwaster',
  description: 'Your mechs roll 1 additional die during combat.',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  // Mech upgrades stack: no exclusiveGroup.
  invoke: [
    createStatsTransformInvoke('MECH', stats => {
      const combat = stats.COMBAT
      if (!combat) return {}
      return {
        COMBAT: [combat[0], (combat[1] ?? 1) + 1],
      }
    }),
  ],
}
