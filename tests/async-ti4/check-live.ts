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
import { readFileSync } from 'node:fs'

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

/** Where the game ids come from: `ASYNCTI4_GAMES` if set, otherwise the
 *  gitignored `.asyncti4-games` at the repo root, one id per line.
 *
 *      ASYNCTI4_GAMES=abc123,def456 npm run check:asyncti4
 *
 *  Nothing is committed. The games belong to other people, so their ids would
 *  put a lasting pointer to them — and to whoever is playing — in this
 *  repository's history. They are poor constants besides: games get played on,
 *  finish, and are archived, so a hardcoded list would rot. Keep a couple of
 *  games in progress in the local file; a combat in flight is a bonus, not a
 *  requirement. */
const GAMES_FILE = new URL('../../.asyncti4-games', import.meta.url)

function readGameIds(): string[] {
  let raw = process.env.ASYNCTI4_GAMES
  if (raw === undefined) {
    try {
      raw = readFileSync(GAMES_FILE, 'utf-8')
    } catch {
      // No local list — the run says so and explains how to make one.
      raw = ''
    }
  }
  return (
    raw
      .split('\n')
      // Comments are stripped per line before anything splits on commas, or a
      // comma inside a comment leaves its tail behind as a bogus game id.
      .map(line => line.replace(/#.*$/, ''))
      .flatMap(line => line.split(','))
      .map(id => id.trim())
      .filter(Boolean)
  )
}

const GAMES = readGameIds()

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

/** Returns false when the game could not be checked at all, so the run can
 *  tell "upstream is fine" from "we checked nothing". */
async function checkGame(gameId: string): Promise<boolean> {
  console.info(`\n${gameId}`)

  const response = await fetch(`${GAME_DATA_URL}/${gameId}/web-data`)
  // Upstream answers 400 for a game it doesn't have, 404 for a route it
  // doesn't have. Either way the game is gone, which says nothing about
  // compatibility — it just means this sample needs replacing.
  if (response.status === 400 || response.status === 404) {
    warn('no longer available — pick another sample game')
    return false
  }
  if (!response.ok) {
    fail(`fetch returned ${response.status}`)
    return false
  }

  const raw: unknown = await response.json()
  const parsed = WebDataSchema.safeParse(raw)
  if (!parsed.success) {
    fail(`payload no longer matches the schema: ${parsed.error.message}`)
    return false
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

  // Combats resolve within a turn or two, so most of the time there won't be
  // one. Only its shape is checked, never its presence.
  const active = findActiveCombat(data)
  if (!active) {
    ok('no combat open (nothing to check there)')
  } else {
    if (!locations.some(l => l.id === active.locationId)) {
      warn(
        `active combat at "${active.locationId}" is not an importable location`,
      )
    } else if (active.factions.length !== 2) {
      warn(`active combat has ${active.factions.length} resolved participants`)
    } else {
      ok(`active combat resolves to ${active.locationId}`)
    }
  }
  return true
}

console.info('Checking the AsyncTI4 import against live games…')
let checked = 0
for (const game of GAMES) {
  const id = parseGameId(game)
  if (!id) {
    fail(`"${game}" is not a usable game id`)
    continue
  }
  try {
    if (await checkGame(id)) checked++
  } catch (e) {
    fail(`${id} threw: ${String(e)}`)
  }
}
// A run that reached no game has proved nothing, and mustn't pass as if it
// had. It is a different problem from an incompatible payload, though, so say
// so rather than pointing at the mappings.
const nothingChecked = checked === 0
if (nothingChecked) {
  fail(GAMES.length === 0 ? 'no games given' : 'no game could be checked')
}

console.info(`\n${failures.size} failure(s), ${warnings.size} warning(s).`)
if (nothingChecked) {
  console.info(
    (GAMES.length === 0
      ? 'Name some games in progress to probe.'
      : 'Those games have probably finished. Try some that are in progress.') +
      '\nEither list them one per line in .asyncti4-games (gitignored), or:' +
      '\n  ASYNCTI4_GAMES=abc123,def456 npm run check:asyncti4',
  )
} else if (failures.size > 0) {
  console.info(
    'The import looks out of date with AsyncTI4 — see src/async-ti4/mappings.ts.',
  )
}
process.exit(failures.size > 0 ? 1 : 0)
