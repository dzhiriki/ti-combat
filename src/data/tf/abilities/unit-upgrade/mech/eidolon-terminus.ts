import vuilraithCabalIcon from '@/assets/faction/vuilraith_cabal.svg?raw'
import type { Ability } from '@/combat'

export const eidolonTerminus: Ability = {
  key: 'TF_UPGRADE_EIDOLON_TERMINUS',
  icon: vuilraithCabalIcon,
  name: 'Eidolon Terminus',
  description: 'The Combat value of your mechs is reduced by 1.',
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
          COMBAT: [Math.max(1, combat[0] - 1), combat[1]],
        })
      },
    },
  ],
}
