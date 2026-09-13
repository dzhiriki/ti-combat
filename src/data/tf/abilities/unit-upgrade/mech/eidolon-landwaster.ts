import naazRokhaAllianceIcon from '@/assets/faction/naaz_rokha_alliance.svg?raw'
import type { Ability } from '@/combat'

export const eidolonLandwaster: Ability = {
  key: 'TF_UPGRADE_EIDOLON_LANDWASTER',
  icon: naazRokhaAllianceIcon,
  name: 'Eidolon Landwaster',
  description: 'Your mechs roll 1 additional die during combat.',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  // Mech upgrades stack: no exclusiveGroup.
  invoke: [
    {
      timing: 'PREPARE',
      system: true,
      call: ctx => {
        const combat = ctx.api.own.getUnitStats('MECH')?.COMBAT
        if (!combat) return
        ctx.api.own.modifyUnitType('MECH', {
          COMBAT: [combat[0], (combat[1] ?? 1) + 1],
        })
      },
    },
  ],
}
