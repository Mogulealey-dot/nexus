#!/usr/bin/env node
/**
 * Nexus Email Digest
 * Fetches unread Gmail emails, prioritizes them with Claude, and creates a note in Nexus.
 *
 * Setup (one-time):
 *   1. In Google Cloud Console (your Firebase project) → APIs & Services → Enable "Gmail API"
 *   2. APIs & Services → Credentials → Create OAuth 2.0 Client ID (type: Desktop app)
 *   3. Download JSON → save as scripts/gmail-credentials.json
 *   4. Run: node scripts/email-digest.mjs
 *      (First run opens browser for Gmail authorization)
 */

import fs from 'fs'
import path from 'path'
import http from 'http'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { google } from 'googleapis'
import * as Y from 'yjs'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// Load env
config({ path: path.join(ROOT, '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const NEXUS_USER_ID = process.env.NEXUS_USER_ID

const CREDENTIALS_PATH = path.join(__dirname, 'gmail-credentials.json')
const TOKEN_PATH = path.join(__dirname, 'gmail-token.json')
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

// ── Gmail OAuth ────────────────────────────────────────────────────────────────

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`
❌  Missing Gmail credentials.

Steps to fix:
  1. Go to console.cloud.google.com → select your Firebase project
  2. APIs & Services → Library → search "Gmail API" → Enable
  3. APIs & Services → Credentials → "+ Create Credentials" → OAuth 2.0 Client ID
  4. Application type: Desktop app  →  Create
  5. Download JSON → save as:
     ${CREDENTIALS_PATH}
  6. Re-run this script.
`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'))
}

async function getAuthClient() {
  const { installed } = loadCredentials()
  const oAuth2 = new google.auth.OAuth2(
    installed.client_id,
    installed.client_secret,
    'http://localhost:3500/oauth2callback'
  )

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
    oAuth2.setCredentials(token)
    // Auto-refresh if expired
    if (token.expiry_date && token.expiry_date < Date.now()) {
      const { credentials } = await oAuth2.refreshAccessToken()
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials))
      oAuth2.setCredentials(credentials)
    }
    return oAuth2
  }

  // First-time OAuth flow
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES })
    console.log('\n🔐  Opening browser for Gmail authorization...\n')

    // Try to open browser
    const { exec } = await import('child_process')
    exec(`open "${authUrl}"`, () => {})
    console.log('If browser did not open, visit:\n', authUrl, '\n')

    // Local redirect server
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost:3500')
      const code = url.searchParams.get('code')
      if (!code) { res.end('No code.'); return }
      res.end('<h2>✅ Authorized! You can close this tab.</h2>')
      server.close()
      try {
        const { tokens } = await oAuth2.getToken(code)
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens))
        oAuth2.setCredentials(tokens)
        console.log('✅  Gmail authorized and token saved.\n')
        resolve(oAuth2)
      } catch (err) {
        reject(err)
      }
    })
    server.listen(3500)
  })
}

// ── Fetch unread emails ────────────────────────────────────────────────────────

async function fetchUnreadEmails(auth, maxResults = 50) {
  const gmail = google.gmail({ version: 'v1', auth })

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
    maxResults,
  })

  const messages = listRes.data.messages || []
  if (messages.length === 0) {
    console.log('📭  No unread emails found.')
    return []
  }

  console.log(`📬  Found ${messages.length} unread emails. Fetching details...`)

  const emails = await Promise.all(
    messages.map(async ({ id }) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })
      const headers = msg.data.payload?.headers || []
      const get = (name) => headers.find(h => h.name === name)?.value || ''
      return {
        id,
        from: get('From'),
        subject: get('Subject') || '(no subject)',
        date: get('Date'),
        snippet: msg.data.snippet || '',
      }
    })
  )

  return emails
}

// ── Prioritize with Claude ─────────────────────────────────────────────────────

async function prioritizeEmails(emails) {
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY })

  const emailList = emails
    .map((e, i) => `[${i + 1}] From: ${e.from}\n    Subject: ${e.subject}\n    Preview: ${e.snippet.slice(0, 120)}`)
    .join('\n\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are an email triage assistant. Categorize each email below as HIGH, NORMAL, or LOW priority.

HIGH: Urgent action required, deadlines, security alerts, critical issues, direct requests from real people needing a response.
NORMAL: Informational updates, newsletters you subscribed to, meeting invites, non-urgent requests.
LOW: Promotions, marketing, social notifications, bulk mail.

For each email return a JSON array (no markdown) in this exact format:
[{"index": 1, "priority": "HIGH", "reason": "one sentence"}, ...]

Emails:
${emailList}`,
    }],
  })

  try {
    const text = response.content[0].text.trim()
    const jsonText = text.startsWith('[') ? text : text.slice(text.indexOf('['))
    return JSON.parse(jsonText)
  } catch {
    console.warn('⚠️  Could not parse Claude response, defaulting all to NORMAL')
    return emails.map((_, i) => ({ index: i + 1, priority: 'NORMAL', reason: 'Could not determine' }))
  }
}

// ── Build Yjs document ─────────────────────────────────────────────────────────
// Creates a TipTap-compatible Yjs XmlFragment with headings, paragraphs, bullet lists.

function xmlEl(tag, attrs = {}) {
  const el = new Y.XmlElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

function xmlText(str, marks = {}) {
  const t = new Y.XmlText()
  if (str) t.insert(0, str, Object.keys(marks).length ? marks : undefined)
  return t
}

function para(text, marks = {}) {
  const p = xmlEl('paragraph')
  if (text) p.push([xmlText(text, marks)])
  return p
}

function heading(text, level = 1) {
  const h = xmlEl('heading', { level })
  h.push([xmlText(text)])
  return h
}

function bullet(items) {
  const ul = xmlEl('bulletList')
  for (const item of items) {
    const li = xmlEl('listItem')
    const p = xmlEl('paragraph')
    p.push([xmlText(item)])
    li.push([p])
    ul.push([li])
  }
  return ul
}

function buildYjsDoc(emails, priorities) {
  const doc = new Y.Doc()
  const frag = doc.getXmlFragment('default')

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Title
  frag.push([heading(`📧 Email Digest — ${dateStr}`, 1)])
  frag.push([para(`${emails.length} unread emails · sorted by priority`)])

  const groups = { HIGH: [], NORMAL: [], LOW: [] }
  for (const p of priorities) {
    const email = emails[p.index - 1]
    if (!email) continue
    const label = `${email.subject} — from ${email.from.replace(/<.*>/, '').trim()}`
    groups[p.priority]?.push(label)
  }

  if (groups.HIGH.length) {
    frag.push([heading('🔴 High Priority', 2)])
    frag.push([bullet(groups.HIGH)])
  }
  if (groups.NORMAL.length) {
    frag.push([heading('🟡 Normal Priority', 2)])
    frag.push([bullet(groups.NORMAL)])
  }
  if (groups.LOW.length) {
    frag.push([heading('🟢 Low Priority', 2)])
    frag.push([bullet(groups.LOW)])
  }

  frag.push([para('')])
  frag.push([para(`Generated by Nexus Email Digest · ${now.toISOString()}`)])

  return doc
}

// ── Save to Nexus (Supabase) ───────────────────────────────────────────────────

async function saveToNexus(doc, title, textSummary) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const update = Y.encodeStateAsUpdate(doc)
  const contentArray = Array.from(update)

  const { data, error } = await supabase
    .from('docs')
    .insert({
      user_id: NEXUS_USER_ID,
      title,
      content: contentArray,
      text_content: textSummary,
      icon: '📧',
    })
    .select('id')
    .single()

  if (error) throw new Error(`Supabase insert failed: ${error.message}`)
  return data.id
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀  Nexus Email Digest starting...\n')

  const auth = await getAuthClient()
  const emails = await fetchUnreadEmails(auth)

  if (emails.length === 0) {
    console.log('Nothing to do.')
    return
  }

  console.log('🤖  Asking Claude to prioritize emails...')
  const priorities = await prioritizeEmails(emails)

  const ydoc = buildYjsDoc(emails, priorities)

  const now = new Date()
  const title = `📧 Email Digest — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const highCount = priorities.filter(p => p.priority === 'HIGH').length
  const textSummary = `${emails.length} unread emails. ${highCount} high priority.`

  console.log('💾  Saving to Nexus...')
  const docId = await saveToNexus(ydoc, title, textSummary)

  console.log(`\n✅  Done! Note created in Nexus.`)
  console.log(`   High priority:   ${priorities.filter(p => p.priority === 'HIGH').length}`)
  console.log(`   Normal priority: ${priorities.filter(p => p.priority === 'NORMAL').length}`)
  console.log(`   Low priority:    ${priorities.filter(p => p.priority === 'LOW').length}`)
  console.log(`\n   Open it: https://nexus-nu-seven.vercel.app/docs/${docId}\n`)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
