import { z } from 'zod/mini'

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
  unitStates: z.nullish(z.array(z.number())),
})

const PlanetSchema = z.nullish(
  z.object({
    controlledBy: z.nullish(z.string()),
    entities: z.nullish(z.record(z.string(), z.array(EntitySchema))),
  }),
)

const TileSchema = z.object({
  space: z.nullish(z.record(z.string(), z.array(EntitySchema))),
  planets: z.nullish(z.record(z.string(), PlanetSchema)),
})

const PlayerSchema = z.object({
  faction: z.string(),
  color: z.nullish(z.string()),
  userName: z.nullish(z.string()),
  techs: z.nullish(z.array(z.string())),
  eliminated: z.nullish(z.boolean()),
  galvanizeTokensReinf: z.nullish(z.number()),
})

/** The slice of AsyncTI4's `/web-data` payload this import reads. Unknown
 *  fields are dropped rather than rejected, so upstream additions to the
 *  payload don't break the import. */
export const WebDataSchema = z.object({
  gameName: z.nullish(z.string()),
  gameCustomName: z.nullish(z.string()),
  gameRound: z.nullish(z.number()),
  isTwilightsFallMode: z.nullish(z.boolean()),
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
}
