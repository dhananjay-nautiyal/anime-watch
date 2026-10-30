// Regression tests for the refresh-token rotation logic in client.js.
//
// These run with Node's built-in test runner (node --test) against a local
// HTTP server, so they exercise the REAL axios interceptor with no extra test
// dependencies. They guard the two bugs from issue #59:
//   1. the rotated refresh token was discarded (only the access token was
//      saved), so the next refresh replayed a revoked token and signed the
//      user out;
//   2. requests queued behind a FAILED refresh were never settled, so they
//      hung forever.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { setApiBaseURL, default as client } from './client.js'

// A minimal in-memory token store matching the configureTokenStorage contract.
function memoryStore(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    getToken: () => Promise.resolve(map.get('token') ?? null),
    setToken: t => { map.set('token', t); return Promise.resolve() },
    getRefreshToken: () => Promise.resolve(map.get('refreshToken') ?? null),
    setRefreshToken: t => { map.set('refreshToken', t); return Promise.resolve() },
    clearTokens: () => { map.delete('token'); map.delete('refreshToken'); return Promise.resolve() },
    _map: map,
  }
}

function listen(handler) {
  return new Promise(resolve => {
    const server = http.createServer(handler)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function readBody(req) {
  return new Promise(resolve => {
    let data = ''
    req.on('data', c => { data += c })
    req.on('end', () => resolve(data))
  })
}

test('persists the rotated refresh token and retries with the new access token', async () => {
  const seen = { refreshCalls: [], protectedAuths: [] }

  const server = await listen(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/auth/refresh') {
      const body = JSON.parse((await readBody(req)) || '{}')
      seen.refreshCalls.push(body.refreshToken)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ token: 'new-access', refreshToken: 'new-refresh' }))
      return
    }
    if (req.method === 'GET' && req.url === '/api/protected') {
      const auth = req.headers.authorization || ''
      seen.protectedAuths.push(auth)
      if (auth === 'Bearer new-access') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } else {
        // Old / unknown access token -> force a refresh.
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'expired' }))
      }
      return
    }
    res.writeHead(404).end()
  })

  try {
    setApiBaseURL(`http://127.0.0.1:${server.address().port}`)
    const store = memoryStore({ token: 'old-access', refreshToken: 'old-refresh' })
    client.defaults.headers.common = {}
    // Wire the store the same way AuthProvider does.
    const { configureTokenStorage } = await import('./client.js')
    configureTokenStorage(store)

    const res = await client.get('/api/protected')
    assert.equal(res.status, 200)

    // The refresh endpoint was called with the CURRENT refresh token...
    assert.deepEqual(seen.refreshCalls, ['old-refresh'])
    // ...the retried request used the NEW access token...
    assert.ok(seen.protectedAuths.includes('Bearer new-access'))
    // ...and BOTH tokens were persisted. Before the fix the refresh token was
    // left as the (now revoked) old one, breaking the next refresh.
    assert.equal(store._map.get('token'), 'new-access')
    assert.equal(store._map.get('refreshToken'), 'new-refresh')
  } finally {
    server.close()
  }
})

test('a second refresh uses the previously rotated token (rotation chains)', async () => {
  let validRefresh = 'rt-1'
  let validAccess = null // no access token is valid initially -> force a 401
  let counter = 0

  const server = await listen(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/auth/refresh') {
      const body = JSON.parse((await readBody(req)) || '{}')
      if (body.refreshToken !== validRefresh) {
        // Replayed a revoked token -> the bug this test guards against.
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'revoked' }))
        return
      }
      // Rotate: revoke the presented token, issue a new pair.
      counter += 1
      validAccess = `a-${counter + 1}`
      validRefresh = `rt-${counter + 1}`
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ token: validAccess, refreshToken: validRefresh }))
      return
    }
    if (req.method === 'GET' && req.url === '/api/protected') {
      const auth = req.headers.authorization || ''
      if (validAccess && auth === `Bearer ${validAccess}`) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'expired' }))
      }
      return
    }
    res.writeHead(404).end()
  })

  try {
    setApiBaseURL(`http://127.0.0.1:${server.address().port}`)
    const store = memoryStore({ token: 'a-1', refreshToken: 'rt-1' })
    const { configureTokenStorage } = await import('./client.js')
    configureTokenStorage(store)

    // First 401 -> refresh rt-1 -> (a-2, rt-2), retry succeeds.
    await client.get('/api/protected')
    assert.equal(store._map.get('token'), 'a-2')
    assert.equal(store._map.get('refreshToken'), 'rt-2')

    // Expire a-2 so the next call must refresh again. The refresh MUST present
    // the rotated rt-2, not the revoked rt-1.
    validAccess = 'expired-now'
    await client.get('/api/protected')
    assert.equal(store._map.get('refreshToken'), 'rt-3')
  } finally {
    server.close()
  }
})

test('queued requests REJECT (not hang) when the refresh fails', async () => {
  const server = await listen(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/auth/refresh') {
      // Simulate a revoked / invalid refresh token.
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'revoked' }))
      return
    }
    // Everything else is unauthorized, forcing the refresh path.
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'expired' }))
  })

  try {
    setApiBaseURL(`http://127.0.0.1:${server.address().port}`)
    const store = memoryStore({ token: 'old', refreshToken: 'revoked-rt' })
    const { configureTokenStorage } = await import('./client.js')
    configureTokenStorage(store)

    // Two concurrent requests: the first triggers the refresh, the second
    // queues behind it. Before the fix the second promise never settled.
    const settled = await Promise.allSettled([
      client.get('/api/protected'),
      client.get('/api/other'),
    ])

    // Both must have settled by now (allSettled only resolves once they do),
    // and both must be rejections rather than pending forever.
    assert.equal(settled.length, 2)
    assert.ok(settled.every(r => r.status === 'rejected'))

    // Tokens are cleared so the app can send the user to login.
    assert.equal(store._map.has('token'), false)
    assert.equal(store._map.has('refreshToken'), false)
  } finally {
    server.close()
  }
})

test('no refresh token -> request fails and tokens are cleared (no refresh attempted)', async () => {
  let refreshHits = 0
  const server = await listen(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/auth/refresh') {
      refreshHits++
    }
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'expired' }))
  })

  try {
    setApiBaseURL(`http://127.0.0.1:${server.address().port}`)
    const store = memoryStore({ token: 'old' }) // no refresh token
    const { configureTokenStorage } = await import('./client.js')
    configureTokenStorage(store)

    await assert.rejects(() => client.get('/api/protected'))
    assert.equal(refreshHits, 0)
    assert.equal(store._map.has('token'), false)
  } finally {
    server.close()
  }
})
