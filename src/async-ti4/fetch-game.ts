import { type WebData, WebDataSchema } from './types'

const GAME_DATA_URL = 'https://bot.asyncti4.com/api/public/game'

/** Pull the game id out of whatever the user pasted — a bare id, a link to the
 *  web UI, or the underlying bot API url. Returns `null` when nothing
 *  id-shaped is present. */
export function parseGameId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const fromUrl = /\/game\/([A-Za-z0-9_-]+)/.exec(trimmed)
  const candidate = fromUrl ? fromUrl[1] : trimmed
  return /^[A-Za-z0-9_-]+$/.test(candidate) ? candidate : null
}

export class AsyncTi4Error extends Error {}

/** Fetch and validate one game's public web data.
 *
 *  The endpoint sets `access-control-allow-origin: *`, so this runs straight
 *  from the browser with no proxy. */
export async function fetchGame(gameId: string): Promise<WebData> {
  let response: Response
  try {
    response = await fetch(`${GAME_DATA_URL}/${gameId}/web-data`)
  } catch {
    throw new AsyncTi4Error('Could not reach AsyncTI4')
  }

  if (response.status === 404) {
    throw new AsyncTi4Error(`No game named "${gameId}"`)
  }
  if (!response.ok) {
    throw new AsyncTi4Error(`AsyncTI4 returned ${response.status}`)
  }

  const parsed = WebDataSchema.safeParse(await response.json())
  if (!parsed.success) {
    // AsyncTI4 is maintained by another project, and this is what it looks
    // like when their payload moves out from under the import. `npm run
    // check:asyncti4` probes live games and reports which assumption broke;
    // the mappings it points at are in ./mappings.ts. The message stays plain
    // because it is read by someone in a browser, not by whoever fixes it.
    throw new AsyncTi4Error('Unexpected data format from AsyncTI4')
  }
  return parsed.data
}
