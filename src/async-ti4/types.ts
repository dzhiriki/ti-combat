import { z } from 'zod/mini'

/** The `versionSchema` this import was built against. AsyncTI4 stamps every
 *  payload with one and its own UI reads it, so a bump is the earliest warning
 *  that the shape has moved. A mismatch is reported, never fatal — most bumps
 *  won't touch the handful of fields read here. */
export const EXPECTED_SCHEMA_VERSION = 7

/** Optional upstream detail: absent, malformed and unexpected all collapse to
 *  `null` rather than failing the whole parse. Only the fields a battle can't
 *  be built without are allowed to be fatal. */
function soft<T extends z.ZodMiniType>(schema: T) {
  return z.catch(z.nullish(schema), null)
}

/** A stack of identical units (or a token/attachment) at one map location.
 *
 *  `unitStates` is `[healthy, damaged, galvanized, damaged galvanized]` and is
 *  the authoritative breakdown; `count` is its sum. Non-unit entities (tokens,
 *  attachments, action cards) share the shape and are filtered out by
 *  `entityType`. */
const EntitySchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  count: z.number(),
  unitStates: soft(z.array(z.number())),
})

const PlanetSchema = z.nullish(
  z.object({
    /** Who holds the planet. The only thing that identifies an owner when the
     *  planet has no units standing on it, which is the commonest state for an
     *  invasion target. */
    controlledBy: soft(z.string()),
    entities: soft(z.record(z.string(), z.array(EntitySchema))),
  }),
)

const TileSchema = z.object({
  space: soft(z.record(z.string(), z.array(EntitySchema))),
  planets: soft(z.record(z.string(), PlanetSchema)),
})

const PlayerSchema = z.object({
  faction: z.string(),
  color: soft(z.string()),
  userName: soft(z.string()),
  techs: soft(z.array(z.string())),
  /** Twilight's Fall keeps its unit upgrades here rather than in `techs`. */
  unitsOwned: soft(z.array(z.string())),
  galvanizeTokensReinf: soft(z.number()),
})

/** The battle AsyncTI4 has open right now, if any. `unitHolder` is either
 *  `space` or a planet name, and participants are identified by player colour
 *  rather than by faction. */
const ActiveCombatSchema = soft(
  z.object({
    system: soft(z.string()),
    unitHolder: soft(z.string()),
    participantColors: soft(z.array(z.string())),
  }),
)

/** The slice of AsyncTI4's `/web-data` payload this import reads — deliberately
 *  small, since every field here is a chance for an upstream change to break
 *  the import. Only `playerData` and `tileUnitData` are load-bearing; the rest
 *  is either a display label or an optional refinement.
 *
 *  Unknown fields are dropped rather than rejected, so upstream additions to
 *  the payload cost nothing. */
export const WebDataSchema = z.object({
  versionSchema: soft(z.number()),
  gameName: soft(z.string()),
  gameCustomName: soft(z.string()),
  gameRound: soft(z.number()),
  /** How many rings the map has: 3 for a six-player game, 4 for seven or
   *  eight, more with expansions. Drives where the off-grid slots sit. */
  ringCount: soft(z.number()),
  gameState: soft(z.object({ activeCombat: ActiveCombatSchema })),
  playerData: z.array(PlayerSchema),
  tileUnitData: z.record(z.string(), TileSchema),
})

export type WebData = z.infer<typeof WebDataSchema>
export type AsyncPlayer = z.infer<typeof PlayerSchema>
export type AsyncEntity = z.infer<typeof EntitySchema>

/** One place a combat can happen: a system's space area, or a single planet
 *  in it. Ground combat is fought per planet, so planets are listed
 *  individually rather than rolled up into their system. */
export interface BattleLocation {
  /** Stable identifier used as the select value, e.g. `301` or `301/lodor`. */
  id: string
  /** AsyncTI4 tile position. */
  tile: string
  /** Planet name, or `undefined` for the system's space area. */
  planet?: string
  label: string
  mode: 'SPACE' | 'GROUND'
  /** AsyncTI4 faction ids holding units here, most units first. */
  factions: string[]
  /** Modelled units standing here, across every faction. Drives the map's
   *  at-a-glance sense of where the weight is. */
  unitCount: number
  /** Those units in the notation the outcomes table uses — `Ca, 3F, De`, with
   *  a trailing `-` on a damaged stack. Empty when nothing is here. */
  unitSummary: string
  /** Set when this is the battle AsyncTI4 currently has open. */
  isActiveCombat?: boolean
}
