import crypto from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { defaultBody, type Lang, type Member } from '@days/shared'
import type { Config } from './config'
import { nowIso, type Db } from './db/index'

export const SESSION_COOKIE = 'days_session'
/** Browsers limit cookie lifetime to about 400 days; the session is renewed on use. */
const SESSION_DAYS = 400
const RENEW_AFTER_DAYS = 30

export interface MemberRow {
  id: number
  space_id: number
  slot: 1 | 2
  username: string
  password_hash: string
  display_name: string
  sprite_id: string
  /** Null for members created before bodies could be chosen without a migration value. */
  body_id: string | null
  lang: Lang
  /** Items older than this are never marked as new for this member. */
  seen_since: string | null
  /** When the member last opened the badge album. */
  badges_seen_at: string | null
}

export type AppEnv = { Variables: { member: MemberRow } }

export function toMember(r: MemberRow): Member {
  return {
    id: r.id,
    slot: r.slot,
    username: r.username,
    displayName: r.display_name,
    bodyId: r.body_id ?? defaultBody(r.slot),
    spriteId: r.sprite_id,
    lang: r.lang,
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length)
  return crypto.timingSafeEqual(expected, actual)
}

export function newToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/** Tokens are stored only as hashes, so a copy of the database cannot be used to sign in. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400_000).toISOString()
}

function writeCookie(c: Context, config: Config, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  })
}

export function startSession(c: Context, db: Db, config: Config, memberId: number): void {
  const token = newToken()
  db.prepare('INSERT INTO session (token_hash, member_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    hashToken(token),
    memberId,
    nowIso(),
    daysFromNow(SESSION_DAYS),
  )
  writeCookie(c, config, token)
}

export function endSession(c: Context, db: Db): void {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) db.prepare('DELETE FROM session WHERE token_hash = ?').run(hashToken(token))
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

/** Returns the signed-in member, renewing a session that is getting old. */
export function currentMember(c: Context, db: Db, config: Config): MemberRow | null {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null
  const tokenHash = hashToken(token)
  const row = db
    .prepare(
      `SELECT m.*, s.expires_at AS session_expires_at FROM session s
       JOIN member m ON m.id = s.member_id WHERE s.token_hash = ?`,
    )
    .get(tokenHash) as (MemberRow & { session_expires_at: string }) | undefined
  if (!row) return null
  if (row.session_expires_at <= nowIso()) {
    db.prepare('DELETE FROM session WHERE token_hash = ?').run(tokenHash)
    return null
  }
  if (row.session_expires_at < daysFromNow(SESSION_DAYS - RENEW_AFTER_DAYS)) {
    db.prepare('UPDATE session SET expires_at = ? WHERE token_hash = ?').run(daysFromNow(SESSION_DAYS), tokenHash)
    writeCookie(c, config, token)
  }
  return row
}

export function requireMember(db: Db, config: Config): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const member = currentMember(c, db, config)
    if (!member) return c.json({ error: 'unauthorized' }, 401)
    c.set('member', member)
    await next()
  }
}

/**
 * Rejects state-changing requests sent from another site. The session cookie
 * is already SameSite=Lax; this is a second check.
 */
export const sameOrigin: MiddlewareHandler = async (c, next) => {
  const method = c.req.method
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const origin = c.req.header('origin')
    const host = c.req.header('x-forwarded-host') ?? c.req.header('host')
    if (origin && host) {
      let originHost = ''
      try {
        originHost = new URL(origin).host
      } catch {
        /* malformed origin is rejected below */
      }
      if (originHost !== host) return c.json({ error: 'cross_origin' }, 403)
    }
  }
  await next()
}

/** Limits failed sign-in attempts per user name. Held in memory. */
export class AttemptLimiter {
  private failures = new Map<string, number[]>()
  constructor(
    private max = 10,
    private windowMs = 15 * 60_000,
  ) {}

  blocked(key: string): boolean {
    return this.recent(key).length >= this.max
  }

  fail(key: string): void {
    const list = this.recent(key)
    list.push(Date.now())
    this.failures.set(key, list)
  }

  clear(key: string): void {
    this.failures.delete(key)
  }

  private recent(key: string): number[] {
    const cutoff = Date.now() - this.windowMs
    return (this.failures.get(key) ?? []).filter((t) => t > cutoff)
  }
}
