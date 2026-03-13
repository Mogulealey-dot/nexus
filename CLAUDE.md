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

3. Enable Auth providers in Supabase: Email/Password + Google
4. Set Google OAuth redirect URL to `http://localhost:3000/callback` (dev) and your deployed URL

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
