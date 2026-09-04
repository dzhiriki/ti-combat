import vuilraithCabalIcon from '@/assets/faction/vuilraith_cabal.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const eidolonTerminus: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_EIDOLON_TERMINUS',
  icon: vuilraithCabalIcon,
  name: 'Eidolon Terminus',
  description: 'The Combat value of your mechs is reduced by 1.',
  unitType: 'MECH',
  stack: true,
  apply: ctx => {
    const combat = ctx.api.own.getUnitStats('MECH')?.COMBAT
    if (!combat) return
    ctx.api.own.modifyUnitType('MECH', {
      COMBAT: [Math.max(1, combat[0] - 1), combat[1]],
    })
  },
})
