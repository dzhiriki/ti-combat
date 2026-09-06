import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { buildImportConfig } from '@/async-ti4/build-config'
import { parseGameId } from '@/async-ti4/fetch-game'
import { findActiveCombat, listBattleLocations } from '@/async-ti4/locations'
import { type BattleLocation, WebDataSchema } from '@/async-ti4/types'
import { getAllAbilities } from '@/hooks/combat-setup/get-available-abilities'
import { buildAbilityLookup } from '@/hooks/combat-setup/validation'

function loadFixture(name: string) {
  return WebDataSchema.parse(
    JSON.parse(
      readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8'),
    ),
  )
}

// Board states taken from real games and anonymised. Between them these five
// tiles cover damaged and galvanized stacks, structures under a space battle,
// and the tokens and attachments that share the units' shape.
const data = loadFixture('ti4-game.json')

// A Twilight's Fall game, where the upgrade cards live in `unitsOwned` rather
// than in the researched techs.
const tfData = loadFixture('twilights-fall-game.json')

// A game paused mid-battle. Nothing on its map looks contested — the losing
// fleet is already gone — so `activeCombat` is the only thing that says where
// the fight is.
const activeData = loadFixture('active-combat.json')

const abilityLookup = buildAbilityLookup(getAllAbilities())
const locations = listBattleLocations(data)

function locationAt(id: string): BattleLocation {
  const found = locations.find(l => l.id === id)
  if (!found) throw new Error(`No location "${id}" in fixture`)
  return found
}

function importAt(id: string, attacker: string, defender: string) {
  return buildImportConfig(
    data,
    { location: locationAt(id), attacker, defender },
    abilityLookup,
  )
}

describe('parseGameId', () => {
  it('accepts a bare id, a web link, and rejects anything else', () => {
    expect(parseGameId('abc12345')).toBe('abc12345')
    expect(parseGameId('https://asyncti4.com/game/abc12345')).toBe('abc12345')
    expect(parseGameId(' https://asyncti4.com/game/abc12345/map ')).toBe(
      'abc12345',
    )
    expect(parseGameId('not a game')).toBeNull()
    expect(parseGameId('')).toBeNull()
  })
})

describe('listBattleLocations', () => {
  it('lists a system and its planets separately', () => {
    expect(locationAt('frac4').mode).toBe('SPACE')
    expect(locationAt('frac4/styx').mode).toBe('GROUND')
  })

  it('ignores tokens and attachments when deciding who is present', () => {
    // Neutral holds only a Mirage token in 212 and only attachments on hercalor.
    expect(locationAt('212').factions).toEqual(['sardakk'])
    expect(locationAt('317/hercalor').factions).toEqual(['bastion'])
  })

  it('lists a planet with no units on it', () => {
    // Everra on 308 is held by Sol with nothing standing on it. Skipping such
    // planets hid them from the map, and an undefended planet is exactly the
    // kind you would be planning an invasion of.
    const everra = locations.find(l => l.id === '308/everra')
    expect(everra).toBeDefined()
    expect(everra?.unitCount).toBe(0)
    // With nobody standing there, the planet's holder is who you would face.
    expect(everra?.factions).toEqual(['sol'])
  })

  it('counts only the controller\u2019s forces where units coexist', () => {
    // The Cabal hold Styx with two mechs and a PDS; a Deepwrought infantry
    // coexists there. Landing troops means fighting the Cabal for control, not
    // the infantry beside them, so only the Cabal's forces are the defence.
    const styx = locationAt('frac4/styx')
    expect(styx.factions).toEqual(['cabal'])
    expect(styx.unitSummary).toBe('2M, PDS')
    expect(styx.unitCount).toBe(3)
  })

  it('summarises units in the notation the outcomes table uses', () => {
    // Short name, a count in front only when there is more than one, and a
    // trailing `-` for a damaged stack — the Cabal war sun at frac4 is
    // sustained. Ordered like every other unit list in the app.
    expect(locationAt('frac4').unitSummary).toBe('W-, 2Cr, 3F')
    expect(locationAt('106/lodor').unitSummary).toBe('M, 5I, 2PDS')
    expect(locationAt('308').unitSummary).toBe('De')
    // Galvanize is a mark, not damage: both Bastion cruisers at 104 are
    // healthy, one of them galvanized.
    expect(locationAt('104').unitSummary).toBe('2Cr, F, I')
    expect(locationAt('308/everra').unitSummary).toBe('')
  })

  it('leaves space stations out of the places a battle can happen', () => {
    // AsyncTI4 lists Revelation among 316's planets, but it is a space
    // station: there is no ground for an invasion to land on. Ordinian, the
    // real planet in that system, stays.
    const ids = locations.filter(l => l.tile === '316').map(l => l.id)
    expect(ids).toContain('316/ordinian')
    expect(ids).not.toContain('316/revelation')
  })

  it('offers every system\u2019s space, empty or not', () => {
    // A fight can be planned in a system nobody is sitting in, and an anomaly
    // there changes how it goes, so space is always on offer.
    const spaces = locations.filter(l => l.mode === 'SPACE')
    expect(spaces).toHaveLength(Object.keys(data.tileUnitData).length)

    const empty = locationAt('309')
    expect(empty.unitCount).toBe(0)
    expect(empty.factions).toEqual([])
    expect(empty.unitSummary).toBe('')
  })

  it('skips a planet nobody holds and nobody stands on', () => {
    // Such a planet is not a battle — troops just land on it — so a system
    // full of them should read as empty as it is.
    const tiamat = locations.find(l => l.id === '317/tiamat')
    expect(tiamat).toBeDefined() // held by Bastion, no units
    expect(locations.find(l => l.id === '303/nothing')).toBeUndefined()
    for (const l of locations) {
      if (l.mode !== 'GROUND') continue
      expect(
        l.factions.length,
        `${l.id} has neither holder nor units`,
      ).toBeGreaterThan(0)
    }
  })

  it('marks the anomalies and names the ones it models', () => {
    // Everra (308) is a nebula, 303 is an entropic scar; both are anomalies.
    expect(locationAt('308').isAnomaly).toBe(true)
    expect(locationAt('308').environment).toBe('NEBULA')
    expect(locationAt('303').environment).toBe('ENTROPIC_SCAR')
    // A gravity rift is an anomaly with no combat effect this models.
    expect(locationAt('212').isAnomaly).toBe(true)
    expect(locationAt('212').environment).toBeUndefined()
    expect(locationAt('104').isAnomaly).toBeUndefined()
  })

  it('sets the system environment on both sides of the import', () => {
    const nebula = importAt('308', 'cabal', 'sol').config
    expect(nebula.aa.NEBULA).toEqual({ isEnabled: true })
    expect(nebula.da.NEBULA).toEqual({ isEnabled: true })

    const scar = importAt('303', 'cabal', 'sol').config
    expect(scar.aa.ENTROPIC_SCAR).toEqual({ isEnabled: true })
    expect(scar.da.ENTROPIC_SCAR).toEqual({ isEnabled: true })
  })

  it('names the system, so an anonymous hexagon still says where it is', () => {
    expect(locationAt('308').systemName).toBe('Everra')
    expect(locationAt('303').systemName).toBe('Entropic Scar')
    // Mallice sits behind a locked nexus with no claimable planet, so the
    // tile name is the only thing identifying it.
    expect(locationAt('212').systemName).toBe('Gravity Rift')
  })

  it('sorts contested locations first', () => {
    const firstUncontested = locations.findIndex(l => l.factions.length < 2)
    const lastContested = locations.findLastIndex(l => l.factions.length > 1)
    expect(lastContested).toBeLessThan(firstUncontested)
  })

  it('ranks a shared space area above a shared planet', () => {
    // Two players sharing a space area are fighting; two on a planet may just
    // be a structure sitting on ground someone else holds. No real game here
    // has a space contest — a space combat resolves before the next snapshot —
    // so put an enemy destroyer in with the Cabal fleet.
    const doctored = structuredClone(data)
    doctored.tileUnitData.frac4.space!.deepwrought = [
      { entityType: 'unit', entityId: 'dd', count: 1, unitStates: null },
    ]
    // Styx is coexistence, not a contest, until nobody controls it.
    doctored.tileUnitData.frac4.planets!.styx!.controlledBy = null
    const ranked = listBattleLocations(doctored)
    expect(ranked[0].id).toBe('frac4')
    expect(ranked[0].mode).toBe('SPACE')
    // The ground contest on the same tile still ranks above everything quiet.
    const ground = ranked.findIndex(l => l.id === 'frac4/styx')
    const quiet = ranked.findIndex(l => l.factions.length < 2)
    expect(ground).toBeLessThan(quiet)
  })
})

describe('a game paused mid-combat', () => {
  it('resolves the open battle from the player colours', () => {
    expect(findActiveCombat(activeData)).toEqual({
      locationId: 'frac7',
      factions: ['yellowtf', 'redtf'],
    })
  })

  it('floats the open battle to the top, however quiet the map looks', () => {
    const found = listBattleLocations(activeData)
    // Not one location in this game holds two players' units.
    expect(found.every(l => l.factions.length < 2)).toBe(true)
    expect(found[0].id).toBe('frac7')
    expect(found[0].isActiveCombat).toBe(true)
  })

  it('imports a side that is in the fight without holding the system', () => {
    const location = listBattleLocations(activeData)[0]
    const { config } = buildImportConfig(
      activeData,
      { location, attacker: 'yellowtf', defender: 'redtf' },
      abilityLookup,
    )
    // Yellow holds the space; Red's ships are gone and only its structures on
    // Phlegethon remain, firing space cannon into the battle.
    expect(config.au.CARRIER).toEqual([1, 0])
    expect(config.au.FIGHTER).toEqual([6, 0])
    expect(config.du.PDS).toEqual([1, 0])
    expect(config.du.SPACE_DOCK).toEqual([1, 0])
  })
})

describe('buildImportConfig', () => {
  it('maps factions, units and combat techs for a space battle', () => {
    const { config } = importAt('frac4', 'cabal', 'deepwrought')

    expect(config.af).toBe('VUILRAITH_CABAL')
    expect(config.df).toBe('DEEPWROUGHT_SCHOLARATE')
    expect(config.m).toBe('S')
    expect(config.au.WAR_SUN).toEqual([1, 0])
    expect(config.au.CRUISER).toEqual([2, 0])
    expect(config.au.FIGHTER).toEqual([3, 0])
    // Assault Cannon is researched by both sides in this game.
    expect(config.aa.ASSAULT_CANNON).toEqual({ isEnabled: true })
    expect(config.da.ASSAULT_CANNON).toEqual({ isEnabled: true })
  })

  it('carries damaged and galvanized stacks over as pre-set unit state', () => {
    // The Cabal war sun at frac4 is sustained: unitStates [0, 1, 0, 0].
    const { config } = importAt('frac4', 'cabal', 'deepwrought')
    expect(config.aa.PRE_DAMAGED).toEqual({ damagedUnits: [['WAR_SUN', 1]] })

    // Two Bastion cruisers at 104, one of them galvanized: [1, 0, 1, 0].
    const bastion = importAt('104', 'bastion', 'sardakk').config
    expect(bastion.au.CRUISER).toEqual([2, 1]) // Cruiser II is researched
    expect(bastion.aa.PRE_GALVANIZED).toEqual({
      galvanizedUnits: [['CRUISER', 1]],
      reinforcementTokens: 4,
    })
  })

  it('pulls structures on the system planets into a space battle', () => {
    // Sardakk holds the space at 106; Bastion has only 2 PDS down on Lodor.
    const { config } = importAt('106', 'sardakk', 'bastion')
    expect(config.au.DREADNOUGHT).toEqual([2, 1]) // Exotrireme II
    expect(config.du.PDS).toEqual([2, 1]) // PDS II
    expect(config.du.INFANTRY).toBeUndefined()
  })

  it('takes every unit on the planet for a ground battle', () => {
    const { config } = importAt('106/lodor', 'sardakk', 'bastion')
    expect(config.m).toBe('G')
    expect(config.du.INFANTRY).toEqual([5, 0])
    expect(config.du.MECH).toEqual([1, 0])
    expect(config.du.PDS).toEqual([2, 1])
    expect(config.da.PRE_GALVANIZED).toEqual({
      galvanizedUnits: [['MECH', 1]],
      reinforcementTokens: 4,
    })
    // Magen Defense Grid ΩΩ is a ground card Bastion holds.
    expect(config.da.MAGEN_DEFENSE_GRID).toEqual({ isEnabled: true })
  })

  it('records researched upgrades for units the side has none of here', () => {
    const { config } = importAt('106', 'sardakk', 'bastion')
    // Sardakk has Cruiser II but no cruisers at 106.
    expect(config.au.CRUISER).toEqual([0, 1])
  })

  it('adds the fleet overhead to a ground battle', () => {
    // Sardakk holds the space at 106 with 2 fighters and 2 dreadnoughts —
    // the ships that carry the invasion and fire the bombardment.
    const { config } = importAt('106/lodor', 'sardakk', 'bastion')
    expect(config.au.FIGHTER).toEqual([2, 1])
    expect(config.au.DREADNOUGHT).toEqual([2, 1])
  })

  it('keeps ground forces riding in the space area of a space battle', () => {
    // Bastion has an infantry up in the space at 104, aboard the fleet.
    const { config } = importAt('104', 'bastion', 'sardakk')
    expect(config.au.INFANTRY).toEqual([1, 0])
  })

  it('leaves units on the planet out of a space battle', () => {
    // Bastion's infantry and mech are down on Lodor, not in the fight.
    const { config } = importAt('106', 'sardakk', 'bastion')
    expect(config.du.INFANTRY).toBeUndefined()
    expect(config.du.MECH).toBeUndefined()
  })

  it('imports faction technologies, not just the generic deck', () => {
    // Valkyrie Particle Weave is Sardakk's own tech rather than one of the
    // seven generic ones, and was silently dropped until the faction decks
    // were mapped. Sardakk holds no units on Styx, so this also covers a side
    // picked by hand rather than because it is standing there.
    const { config } = importAt('frac4/styx', 'sardakk', 'cabal')
    expect(config.aa.VALKYRIE_PARTICLE_WEAVE).toEqual({ isEnabled: true })
    expect(config.aa.X_89_BACTERIAL_WEAPON).toEqual({ isEnabled: true })
  })

  it('warns when AsyncTI4 bumps its data format', () => {
    const doctored = structuredClone(data)
    doctored.versionSchema = 99
    const { notes } = buildImportConfig(
      doctored,
      {
        location: locationAt('frac4'),
        attacker: 'cabal',
        defender: 'deepwrought',
      },
      abilityLookup,
    )
    expect(notes.join(' ')).toContain('v99')
    expect(notes.join(' ')).toContain('may be out of date')
  })

  it('stays quiet when everything maps', () => {
    expect(importAt('frac4', 'cabal', 'deepwrought').notes).toEqual([])
  })

  it('reports units and cards it could not bring across', () => {
    // Nothing in the fixture game is unmappable, so plant the two kinds of
    // thing that are: a Monument — a structure from AsyncTI4's Monuments
    // expansion, which this calculator has no unit for — and the pre-Omega
    // X-89, which is a different card from the ΩΩ printing implemented here.
    const doctored = structuredClone(data)
    doctored.tileUnitData.frac4.space!.cabal.push({
      entityType: 'unit',
      entityId: 'monument',
      count: 1,
      unitStates: null,
    })
    doctored.playerData
      .find(p => p.faction === 'cabal')!
      .techs!.push('x89_base')

    const { notes } = buildImportConfig(
      doctored,
      {
        location: locationAt('frac4'),
        attacker: 'cabal',
        defender: 'deepwrought',
      },
      abilityLookup,
    )
    expect(notes).toHaveLength(2)
    expect(notes.join(' ')).toContain('monument')
    expect(notes.join(' ')).toContain(
      'X-89 Bacterial Weapon (pre-\u03a9 printing)',
    )
  })
})

describe('Twilight\u2019s Fall games', () => {
  function tfImport(id: string, attacker: string, defender: string) {
    const location = listBattleLocations(tfData).find(l => l.id === id)
    if (!location) throw new Error(`No location "${id}" in TF fixture`)
    return buildImportConfig(
      tfData,
      { location, attacker, defender },
      abilityLookup,
    )
  }

  it('maps the colour ids upstream uses to the TF faction sheets', () => {
    const { config } = tfImport('313/acheron', 'yellowtf', 'purpletf')
    expect(config.af).toBe('AVARICE_REX')
    expect(config.df).toBe('IL_NA_VIROSET')
  })

  it('takes unit upgrades from the owned cards, not the techs', () => {
    const { config } = tfImport('313/acheron', 'yellowtf', 'purpletf')
    // Neither player has a single unit-upgrade tech; the cards are all in
    // `unitsOwned`.
    expect(config.aa.TF_UPGRADE_DAWNCRUSHER).toEqual({ isEnabled: true })
    expect(config.aa.TF_UPGRADE_HYBRID_CRYSTAL_FIGHTER).toEqual({
      isEnabled: true,
    })
    expect(config.da.TF_UPGRADE_THE_DRAGON_FREED).toEqual({ isEnabled: true })
    expect(config.da.TF_UPGRADE_LETANI_WARRIOR).toEqual({ isEnabled: true })
  })

  it('imports the TF shared ability deck', () => {
    const { config } = tfImport('313/acheron', 'yellowtf', 'purpletf')
    // Il Na Viroset holds Valkyrie Particle Weave and Non-Euclidean Shielding.
    expect(config.da.VALKYRIE_PARTICLE_WEAVE).toEqual({ isEnabled: true })
    expect(config.da.NON_EUCLIDEAN_SHIELDING).toEqual({ isEnabled: true })
  })

  it('carries the fleet and the damaged mechs into a ground battle', () => {
    const { config } = tfImport('101/atlas', 'yellowtf', 'yellowtf')
    expect(config.au.MECH).toEqual([2, 0])
    expect(config.au.CRUISER).toEqual([1, 0])
    expect(config.au.DREADNOUGHT).toEqual([4, 0])
    expect(config.aa.PRE_DAMAGED).toEqual({ damagedUnits: [['MECH', 2]] })
  })
})
