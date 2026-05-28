#!/usr/bin/env node
/**
 * Tiny TCP proxy that forwards :8001 -> :3000.
 *
 * Why this exists:
 *   The Emergent preview platform's nginx ingress routes /api/* to port 8001
 *   (expecting a separate FastAPI backend in the standard CRA+FastAPI template).
 *   Mission Control is a Next.js fullstack app that serves both / and /api/*
 *   from port 3000. This proxy makes the platform routing work without
 *   requiring socat or any system package install (which gets wiped on
 *   container recycle).
 *
 * No dependencies, pure Node `net` module.
 */
'use strict'

const net = require('node:net')

const LISTEN_HOST = '0.0.0.0'
const LISTEN_PORT = Number(process.env.PROXY_LISTEN_PORT || 8001)
const TARGET_HOST = process.env.PROXY_TARGET_HOST || '127.0.0.1'
const TARGET_PORT = Number(process.env.PROXY_TARGET_PORT || 3000)

const server = net.createServer((clientSocket) => {
  const upstream = net.createConnection({ host: TARGET_HOST, port: TARGET_PORT })
  let upstreamReady = false
  const buffered = []

  upstream.on('connect', () => {
    upstreamReady = true
    while (buffered.length) upstream.write(buffered.shift())
  })

  clientSocket.on('data', (chunk) => {
    if (upstreamReady) upstream.write(chunk)
    else buffered.push(chunk)
  })

  upstream.on('data', (chunk) => clientSocket.write(chunk))

  const teardown = () => {
    try { clientSocket.destroy() } catch {}
    try { upstream.destroy() } catch {}
  }
  clientSocket.on('end', teardown)
  clientSocket.on('error', teardown)
  upstream.on('end', teardown)
  upstream.on('error', teardown)
})

server.on('error', (err) => {
  console.error('[api-proxy] server error:', err.message)
  process.exit(1)
})

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[api-proxy] listening on ${LISTEN_HOST}:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`)
})
