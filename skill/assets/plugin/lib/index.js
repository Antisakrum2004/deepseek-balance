/**
 * Host half of the local token/balance indicator.
 *
 * Registers one read-only loopback route, `GET /token-balance`, that returns the
 * DeepSeek platform balance for the API key stored in the DSH credentials file.
 * The answer is cached for a short TTL so a polling browser cannot hammer the
 * upstream endpoint. Nothing here is model-facing: no prompt, tool or message.
 * @module @local/dsh-token-balance
 */

import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Stable Cordis plugin name. */
export const name = 'token-balance'

/** Required services: the HTTP carrier that owns the route table. */
export const inject = ['webServer']

const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const KEY_PATTERN = /sk-[A-Za-z0-9_-]{10,}/
const DEFAULT_TTL_MS = 45_000
const UPSTREAM_TIMEOUT_MS = 20_000

/**
 * Read the DeepSeek API key out of the DSH credentials document.
 * @returns the key text, or null when the file or the key is absent.
 */
async function readApiKey() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  try {
    const text = await readFile(join(home, '.credentials.yaml'), 'utf8')
    return KEY_PATTERN.exec(text)?.[0] ?? null
  } catch {
    return null
  }
}

/**
 * Normalize one upstream balance row.
 * @param row - raw `balance_infos` entry.
 */
function normalizeBalance(row) {
  return {
    currency: String(row?.currency ?? ''),
    total: String(row?.total_balance ?? ''),
    granted: String(row?.granted_balance ?? ''),
    toppedUp: String(row?.topped_up_balance ?? ''),
  }
}

/**
 * Serve the balance snapshot over HTTP.
 * @param ctx - plugin context carrying the web server.
 * @param config - optional tuning: `path` and `ttlMs`.
 */
export function apply(ctx, config = {}) {
  const routePath = typeof config.path === 'string' && config.path.startsWith('/') ? config.path : '/token-balance'
  const ttlMs = Number.isFinite(config.ttlMs) && config.ttlMs > 0 ? config.ttlMs : DEFAULT_TTL_MS
  let cached = null
  let inflight = null

  const readBalance = async () => {
    const now = Date.now()
    if (cached !== null && now - cached.at < ttlMs) return { ...cached.value, cached: true }
    if (inflight !== null) return inflight
    inflight = (async () => {
      try {
        const key = await readApiKey()
        if (key === null) return { ok: false, error: 'no-api-key', at: Date.now() }
        const response = await fetch(BALANCE_URL, {
          headers: { authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
        if (!response.ok) return { ok: false, error: `upstream-${response.status}`, at: Date.now() }
        const body = await response.json()
        const value = {
          ok: true,
          at: Date.now(),
          available: body?.is_available === true,
          balances: Array.isArray(body?.balance_infos) ? body.balance_infos.map(normalizeBalance) : [],
        }
        cached = { at: value.at, value }
        return value
      } catch (error) {
        return { ok: false, error: String(error?.message ?? error), at: Date.now() }
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: routePath,
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405)
        res.end()
        return
      }
      const payload = await readBalance()
      const text = JSON.stringify(payload)
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': String(Buffer.byteLength(text)),
      })
      res.end(req.method === 'HEAD' ? undefined : text)
    },
  }), 'token-balance: balance route')
}
