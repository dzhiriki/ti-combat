import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { hitOrderUnits, setAbility, setupOptions } from '../utils/setup-options'
import { PLANET_1, PLANET_2 } from '../utils/surface-units'

describe('GHOM_SEKKUS', () => {
  it('adds configured units during COMMIT_UNITS', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          GHOM_SEKKUS: {
            isEnabled: true,
            units: [
              ['INFANTRY', 2],
              ['MECH', 1],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('places galvanized variants when the variant is picked', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          // PRE_GALVANIZED enabled so INFANTRY:Galvanized is a declared
          // variant key. count==0 keeps it non-participating but still
          // visible in the synced list (`includeNonParticipating: true`).
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['INFANTRY', 0]],
          },
          GHOM_SEKKUS: {
            isEnabled: true,
            units: [['INFANTRY:Galvanized', 2]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    const galvanized = t.attacker.units.INFANTRY!.filter(u =>
      u.subtypes?.includes('Galvanized'),
    )
    expect(galvanized).toHaveLength(2)
  })

  it('keeps subtype variants in params on first reconcile when galvanizedUnits is empty', () => {
    // Regression: PRE_GALVANIZED's `declareSubtype` reads from
    // `params.galvanizedUnits`, which is itself a sync-source param. On
    // the first pass the source isn't reconciled yet; the engine's second
    // collectDeclaredSubtypes pass after reconcileSyncAll picks up the
    // populated value so Ghom Sek'kus's saved INFANTRY:Galvanized entry
    // survives instead of being dropped from the validList.
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          PRE_GALVANIZED: { isEnabled: true },
          GHOM_SEKKUS: {
            isEnabled: true,
            units: [['INFANTRY:Galvanized', 2]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    const galvanized = t.attacker.units.INFANTRY!.filter(u =>
      u.subtypes?.includes('Galvanized'),
    )
    expect(galvanized).toHaveLength(2)
  })

  it('declares the committed units for the hit order', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'SARDAKK_NORR')
    setup.setCombatMode('GROUND')
    setup.setUnitCount('attacker', 'INFANTRY', 1)
    const mech = 'MECH'
    setAbility(setup, 'attacker', 'GHOM_SEKKUS', { isEnabled: true })
    expect(hitOrderUnits(setup, 'GROUND')).not.toContain(mech)

    setAbility(setup, 'attacker', 'GHOM_SEKKUS', {
      units: [
        ['MECH', 1],
        ['INFANTRY', 0],
      ],
    })
    expect(hitOrderUnits(setup, 'GROUND')).toContain(mech)
  })

  it('offers one count per type within the reinforcements left', () => {
    const setup = new CombatSetup('FULL')
    setup.setCombatMode('GROUND')
    setup.addPlanet()
    setup.setSurfaceUnitCount('attacker', SPACE_SURFACE_ID, 'MECH', 1)
    setup.setSurfaceUnitCount('defender', PLANET_1, 'INFANTRY', 1)
    setup.setSurfaceUnitCount('defender', PLANET_2, 'INFANTRY', 1)
    setAbility(setup, 'attacker', 'GHOM_SEKKUS', {
      isEnabled: true,
      units: [['MECH', 5]],
    })

    const mech = setupOptions(setup, 'GHOM_SEKKUS', 'units').find(
      item => item.value === 'MECH',
    )
    // Three mechs are left in reinforcements.
    expect(mech?.max).toBe(3)
    const counts = new Map(
      setup.abilities.attacker.GHOM_SEKKUS.units as [string, number][],
    )
    expect(counts.get('MECH')).toBe(3)
  })
})
