import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'

import { hitOrderUnits, setAbility } from '../utils/setup-options'

describe('MOYINS_ASHES', () => {
  it('declares its mech for the hit order', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'YIN_BROTHERHOOD')
    setup.setCombatMode('GROUND')
    setup.setUnitCount('attacker', 'INFANTRY', 1)
    const mech = 'MECH'
    expect(hitOrderUnits(setup, 'GROUND')).not.toContain(mech)

    setAbility(setup, 'attacker', 'MOYINS_ASHES', { isEnabled: true })
    expect(hitOrderUnits(setup, 'GROUND')).toContain(mech)
  })
})
