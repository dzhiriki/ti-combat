/** Contract check against the live AsyncTI4 API.
 *
 *  AsyncTI4 is maintained by a different project, so the import can go stale
 *  without a single test here failing — the committed fixtures keep passing
 *  against a payload shape that no longer exists. This fetches real games and
 *  checks the assumptions the import rests on. It is deliberately outside the
 *  normal suite: it needs the network, and a red result usually means upstream
 *  changed rather than that this repo is broken.
 *
 *      npm run check:asyncti4
 */
import { findActiveCombat, listBattleLocations, parseGameId } from '@/async-ti4'
import {
  ABILITY_BY_TECH,
  ABILITY_BY_TF_UNIT,
  FACTION_BY_ASYNC_ID,
  UNIT_TYPE_BY_ASYNC_ID,
  UNIT_UPGRADE_BY_TECH,
  UNMODELLED_TECHS,
  UNMODELLED_TF_UNITS,
} from '@/async-ti4/mappings'
import { EXPECTED_SCHEMA_VERSION, WebDataSchema } from '@/async-ti4/types'

// The games the committed fixtures were cut from: a TI4 game, a Twilight's
// Fall game, and one paused mid-combat.
const GAMES = []

const GAME_DATA_URL = 'https://bot.asyncti4.com/api/public/game'

// Sets, not arrays: one renamed unit id would otherwise repeat once per stack
// on the map and bury everything else.
const failures = new Set<string>()
const warnings = new Set<string>()

function fail(message: string): void {
  if (!failures.has(message)) console.info(`  ✗ ${message}`)
  failures.add(message)
}

function warn(message: string): void {
  if (!warnings.has(message)) console.info(`  ! ${message}`)
  warnings.add(message)
}

function ok(message: string): void {
  console.info(`  ✓ ${message}`)
}

/** TI4 unit upgrades are researched, and their aliases end in the mark number
 *  (`cv2`, `sdn2`, `pws2`). An unmapped one is either a rename upstream or
 *  homebrew we never modelled, so it warns rather than fails.
 *
 *  Twilight's Fall upgrades are deliberately not covered here: they are cards
 *  in `unitsOwned`, so every `tf-` entry in `techs` is an ability, and most are
 *  economy ones this calculator is right to ignore. Flagging those would bury
 *  the signal in ~60 lines of noise. */
function looksLikeUnitUpgrade(alias: string): boolean {
  return /\d$/.test(alias) && !alias.startsWith('tf-')
}

async function checkGame(gameId: string): Promise<void> {
  console.info(`\n${gameId}`)

  const response = await fetch(`${GAME_DATA_URL}/${gameId}/web-data`)
  if (!response.ok) {
    fail(`fetch returned ${response.status}`)
    return
  }

  const raw: unknown = await response.json()
  const parsed = WebDataSchema.safeParse(raw)
  if (!parsed.success) {
    fail(`payload no longer matches the schema: ${parsed.error.message}`)
    return
  }
  const data = parsed.data
  ok('payload parses')

  if (data.versionSchema !== EXPECTED_SCHEMA_VERSION) {
    warn(
      `versionSchema is ${data.versionSchema}, import expects ${EXPECTED_SCHEMA_VERSION}`,
    )
  }

  // Vocabulary: every faction and unit in play must still be one we know.
  for (const player of data.playerData) {
    if (!(player.faction in FACTION_BY_ASYNC_ID)) {
      fail(`unknown faction id "${player.faction}"`)
    }
    for (const alias of player.techs ?? []) {
      if (
        looksLikeUnitUpgrade(alias) &&
        !(alias in UNIT_UPGRADE_BY_TECH) &&
        !(alias in ABILITY_BY_TECH) &&
        !(alias in UNMODELLED_TECHS)
      ) {
        warn(`unrecognised unit-upgrade tech "${alias}"`)
      }
    }
    for (const owned of player.unitsOwned ?? []) {
      if (
        owned.startsWith('tf-') &&
        !(owned in ABILITY_BY_TF_UNIT) &&
        !UNMODELLED_TF_UNITS.has(owned)
      ) {
        warn(`unrecognised TF unit card "${owned}"`)
      }
    }
  }

  let unitStacks = 0
  for (const tile of Object.values(data.tileUnitData)) {
    const groups = [
      ...Object.values(tile.space ?? {}),
      ...Object.values(tile.planets ?? {}).flatMap(planet =>
        Object.values(planet?.entities ?? {}),
      ),
    ]
    for (const entity of groups.flat()) {
      if (entity.entityType !== 'unit') continue
      unitStacks++
      if (!(entity.entityId in UNIT_TYPE_BY_ASYNC_ID)) {
        warn(`unknown unit id "${entity.entityId}"`)
      }
      // `[healthy, damaged, galvanized, damaged galvanized]` — the import
      // reads indices 1..3 by position, so a different width means the
      // meaning has moved.
      if (entity.unitStates && entity.unitStates.length !== 4) {
        fail(
          `unitStates is ${entity.unitStates.length} wide, expected 4 — damage and galvanize are read positionally`,
        )
      }
    }
  }
  if (unitStacks === 0) fail('no units found anywhere on the map')
  else ok(`${unitStacks} unit stacks, ids and states as expected`)

  const locations = listBattleLocations(data)
  if (locations.length === 0) fail('no importable locations')
  else ok(`${locations.length} importable locations`)

  const active = findActiveCombat(data)
  if (active) {
    const known = locations.some(l => l.id === active.locationId)
    if (!known) {
      warn(
        `active combat at "${active.locationId}" is not an importable location`,
      )
    } else {
      ok(`active combat resolves to ${active.locationId}`)
    }
    if (active.factions.length !== 2) {
      warn(`active combat has ${active.factions.length} resolved participants`)
    }
  }
}

console.info('Checking the AsyncTI4 import against live games…')
for (const game of GAMES) {
  const id = parseGameId(game)
  if (!id) {
    fail(`"${game}" is not a usable game id`)
    continue
  }
  try {
    await checkGame(id)
  } catch (e) {
    fail(`${id} threw: ${String(e)}`)
  }
}

console.info(
  `\n${failures.size} failure(s), ${warnings.size} warning(s).` +
    (failures.size
      ? '\nThe import is out of date with AsyncTI4 — see src/async-ti4/mappings.ts.'
      : ''),
)
process.exit(failures.size > 0 ? 1 : 0)
