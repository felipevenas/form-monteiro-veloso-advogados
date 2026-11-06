/**
 * Google Drive via service account.
 *
 * A service account precisa de um Drive Compartilhado (service accounts não
 * têm cota no "Meu Drive"). A pasta raiz é configurada por ID em
 * `GOOGLE_DRIVE_ROOT_FOLDER_ID`; cada processo ganha uma subpasta com o
 * `public_code`.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

interface ServiceAccount {
  client_email: string
  private_key: string
}

interface TokenCache {
  accessToken: string
  expiresAt: number
}

let cache: TokenCache | null = null

export function isDriveConfigured(): boolean {
  return Boolean(
    Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') &&
      Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID'),
  )
}

export interface DriveUploadInput {
  name: string
  mimeType: string
  bytes: Uint8Array
  folderId?: string
}

export interface DriveUploadResult {
  fileId: string
  folderId: string
}

/** Cria (ou reutiliza) a pasta do processo dentro da pasta raiz. */
export async function ensureProcessFolder(
  processCode: string,
): Promise<string | null> {
  if (!isDriveConfigured()) return null
  const root = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')?.trim()
  if (!root) return null

  const token = await getAccessToken()
  const name = processCode.replace(/[^\w.-]+/g, '_')
  const query = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `'${root}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ')

  const url = new URL(`${DRIVE_API}/files`)
  url.searchParams.set('q', query)
  url.searchParams.set('fields', 'files(id,name)')
  url.searchParams.set('pageSize', '1')

  const found = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  })

  if (found.ok) {
    const payload = (await found.json()) as { files?: Array<{ id?: string }> }
    const existing = payload.files?.[0]?.id
    if (existing) return existing
  }

  const created = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [root],
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!created.ok) {
    console.error('[drive] falha ao criar pasta:', created.status)
    throw new Error('DRIVE_FOLDER_FAILED')
  }

  const body = (await created.json()) as { id?: string }
  if (!body.id) throw new Error('DRIVE_INVALID_RESPONSE')
  return body.id
}

export async function uploadToDrive(
  input: DriveUploadInput,
): Promise<DriveUploadResult> {
  if (!isDriveConfigured()) throw new Error('DRIVE_NOT_CONFIGURED')

  const token = await getAccessToken()
  const folderId =
    input.folderId ??
    (await ensureProcessFolder('documentos')) ??
    Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') ??
    ''

  if (!folderId) throw new Error('DRIVE_FOLDER_NOT_CONFIGURED')

  const boundary = `mv_${crypto.randomUUID()}`
  const metadata = JSON.stringify({
    name: input.name,
    mimeType: input.mimeType,
    parents: [folderId],
  })

  const body = concatBytes(
    encodeText(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
    ),
    input.bytes,
    encodeText(`\r\n--${boundary}--\r\n`),
  )

  const response = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,parents`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body as unknown as BodyInit,
      signal: AbortSignal.timeout(60_000),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    console.error('[drive] falha no upload:', response.status, detail.slice(0, 200))
    throw new Error('DRIVE_UPLOAD_FAILED')
  }

  const payload = (await response.json()) as { id?: string; parents?: string[] }
  if (!payload.id) throw new Error('DRIVE_INVALID_RESPONSE')

  return { fileId: payload.id, folderId: payload.parents?.[0] ?? folderId }
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cache && cache.expiresAt > now + 60) return cache.accessToken

  const account = loadServiceAccount()
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPES,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  )

  const unsigned = `${header}.${claim}`
  const key = await importPrivateKey(account.private_key)
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      encodeText(unsigned) as unknown as BufferSource,
    ),
  )
  const assertion = `${unsigned}.${base64UrlBytes(signature)}`

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    const detail = await response.text()
    console.error('[drive] falha ao obter token:', response.status, detail.slice(0, 200))
    throw new Error('DRIVE_AUTH_FAILED')
  }

  const payload = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!payload.access_token) throw new Error('DRIVE_AUTH_INVALID_RESPONSE')

  cache = {
    accessToken: payload.access_token,
    expiresAt: now + (payload.expires_in ?? 3600),
  }

  return cache.accessToken
}

function loadServiceAccount(): ServiceAccount {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')?.trim()
  if (!raw) throw new Error('DRIVE_NOT_CONFIGURED')

  const json = raw.startsWith('{') ? raw : new TextDecoder().decode(base64Decode(raw))
  const parsed = JSON.parse(json) as Partial<ServiceAccount>

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('DRIVE_INVALID_SERVICE_ACCOUNT')
  }

  return { client_email: parsed.client_email, private_key: parsed.private_key }
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')

  const bytes = base64Decode(base64)
  return crypto.subtle.importKey(
    'pkcs8',
    bytes as unknown as BufferSource,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function encodeText(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function base64Url(value: string): string {
  return base64UrlBytes(encodeText(value))
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.byteLength
  }
  return result
}
