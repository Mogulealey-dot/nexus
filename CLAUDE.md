# CLAUDE.md — Project Nexus

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

## Setup

1. Copy `.env.example` → `.env.local` and fill in all 4 values
2. In Supabase dashboard, run this SQL to create the docs table:

```sql
create table docs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  title       text not null default 'Untitled',
  parent_id   uuid references docs(id),
  content     bytea,
  icon        text,
  is_archived boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table docs enable row level security;
create policy "Users own their docs" on docs for all using (auth.uid() = user_id);
```

3. Run this SQL to create the tasks table:

```sql
create table tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  doc_id     uuid references docs(id) on delete set null,
  title      text not null,
  completed  boolean default false,
  due_date   date,
  priority   text default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tasks enable row level security;
create policy "Users own their tasks" on tasks for all using (auth.uid() = user_id);
```

4. Run this SQL to create the doc_versions table (version history):

```sql
create table doc_versions (
  id           uuid primary key default gen_random_uuid(),
  doc_id       uuid references docs(id) on delete cascade not null,
  user_id      uuid references auth.users not null,
  content_html text,
  text_content text,
  created_at   timestamptz default now()
);

alter table doc_versions enable row level security;
create policy "Users own their versions" on doc_versions for all using (auth.uid() = user_id);
```

5. Also add missing columns to docs table (run if upgrading from initial setup):

```sql
alter table docs add column if not exists is_starred boolean default false;
alter table docs add column if not exists tags text[] default '{}';
alter table docs add column if not exists text_content text;
alter table docs add column if not exists embedding vector(384);
```

6. Enable Auth providers in Supabase: Email/Password + Google
7. Set Google OAuth redirect URL to `http://localhost:3000/callback` (dev) and your deployed URL

8. Run this SQL to create the gmail_tokens table (for Gmail integration):

```sql
create table gmail_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null unique,
  access_token text not null,
  refresh_token text,
  token_type   text default 'Bearer',
  expiry_date  bigint,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table gmail_tokens enable row level security;
create policy "Users own their gmail tokens" on gmail_tokens for all using (auth.uid() = user_id);
```

9. Gmail integration env vars — add to `.env.local` (and Vercel env vars for production):
   - `NEXT_PUBLIC_APP_URL` — e.g. `http://localhost:3000` (dev) or `https://nexus-nu-seven.vercel.app` (prod)
   - `GOOGLE_CLIENT_ID` — from Google Cloud Console → APIs & Services → Credentials
   - `GOOGLE_CLIENT_SECRET` — same credential

   **Google Cloud setup:**
   1. Go to console.cloud.google.com → APIs & Services → Library → Enable "Gmail API"
   2. APIs & Services → Credentials → Create OAuth 2.0 Client ID (type: **Web application**)
   3. Authorised redirect URIs: `http://localhost:3000/api/gmail/callback` + your Vercel URL
   4. Copy Client ID + Secret into env vars above

## Architecture

**Project Nexus** — local-first, AI-native note-taking app built with Next.js 15 (App Router), TypeScript, Tailwind CSS.

### Route Groups
- `(auth)` — `/login`, `/callback` — unauthenticated routes
- `(app)` — `/`, `/docs/[docId]` — authenticated app shell

### Stack
- **Editor**: TipTap with custom SlashCommand extension
- **Sync**: Yjs (`y-indexeddb` for local, Supabase for cloud)
- **Auth/DB**: Supabase (email + Google)
- **AI**: Anthropic Claude Haiku via Vercel AI SDK (streaming)
- **State**: Zustand (`appStore` for sidebar/command palette)
- **UI**: Tailwind CSS, Framer Motion, Lucide icons

### Key Files
| File | Purpose |
|---|---|
| `src/middleware.ts` | Auth guard — redirect unauthenticated to /login |
| `src/components/editor/NexusEditor.tsx` | Core editor: TipTap + Yjs + AI ghost writer |
| `src/components/editor/extensions/SlashCommand.ts` | `/` slash command extension |
| `src/components/sidebar/AppSidebar.tsx` | Collapsible sidebar with doc tree |
| `src/components/command-palette/CommandPalette.tsx` | ⌘K command palette (cmdk) |
| `src/app/api/ai/complete/route.ts` | Streaming AI completion (Edge runtime) |
| `src/hooks/useYDoc.ts` | Yjs doc lifecycle + IndexedDB + Supabase sync |
| `src/hooks/useDocs.ts` | Firestore-style CRUD for docs via Supabase |

### AI Features
- **Ghost Writer**: Streaming Claude Haiku completions, Tab to accept, Esc to dismiss
- Triggered via the "AI Complete" button in the editor footer
- Endpoint: `POST /api/ai/complete` — Edge runtime, streams via Vercel AI SDK

### Editor Slash Commands
Trigger with `/` in the editor: Heading 1/2/3, Bullet List, Numbered List, Task List, Code Block, Quote, Divider, Text

### Local-First Architecture
1. On doc open → load from IndexedDB first (zero latency)
2. If IndexedDB empty → fetch Yjs binary snapshot from Supabase
3. On edit → save to IndexedDB immediately, sync to Supabase debounced 1.5s
