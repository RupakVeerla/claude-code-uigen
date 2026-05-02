# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
npm run setup          # install + prisma generate + prisma migrate dev

# Development
npm run dev            # Next.js dev server with Turbopack
npm run dev:daemon     # Same, but backgrounded; logs go to logs.txt
npm run build          # Production build
npm run lint           # ESLint via next lint

# Testing
npm run test           # Run all tests with vitest

# Database
npm run db:reset       # Wipe and re-migrate (destructive)
```

To run a single test file: `npx vitest run src/lib/__tests__/file-system.test.ts`

## Environment

Create a `.env` file at the project root (no `.env.example` exists):

```
ANTHROPIC_API_KEY=your-key-here   # optional — omit to use MockLanguageModel
JWT_SECRET=your-secret            # optional — defaults to "development-secret-key"
```

Dev server runs at `http://localhost:3000`.

## Architecture

UIGen is an AI-powered React component generator with a live preview. Users describe components in chat; Claude writes code into a **virtual (in-memory) file system**; the result renders instantly in a sandboxed iframe. There is no real file system for user code — everything lives in `VirtualFileSystem` (a `Map`-based tree) and is persisted as JSON in SQLite via Prisma.

### Request flow

```
User message → ChatContext (useChat from @ai-sdk/react)
  → POST /api/chat/route.ts
      → Deserializes VirtualFileSystem from client request body
      → Streams Claude (claude-haiku-4-5) with two tools:
          str_replace_editor  (view/create/str_replace/insert on VFS)
          file_manager        (rename/delete on VFS)
      → onFinish: persists messages + VFS JSON to Prisma (if authenticated)
  → Client receives streamed tool calls
  → FileSystemContext.handleToolCall() applies changes to local VFS
  → refreshTrigger increments → PreviewFrame re-renders
      → @babel/standalone transpiles JSX in-browser
      → import map maps @/ aliases + third-party packages to esm.sh CDN URLs
      → Full HTML injected into sandboxed iframe srcdoc
```

### Key files

| Path | Role |
|---|---|
| `src/app/api/chat/route.ts` | The only API route — all AI interaction goes through here |
| `src/lib/file-system.ts` | `VirtualFileSystem` class — the core data structure |
| `src/lib/contexts/file-system-context.tsx` | React context wrapping VFS; `handleToolCall` dispatches AI tool calls into the VFS |
| `src/lib/contexts/chat-context.tsx` | Wraps `useChat`; sends serialized VFS with every request |
| `src/lib/tools/str-replace.ts` | Vercel AI SDK tool for file view/create/edit operations |
| `src/lib/tools/file-manager.ts` | Vercel AI SDK tool for rename/delete |
| `src/lib/transform/jsx-transformer.ts` | In-browser Babel transpilation + import map + preview HTML generation |
| `src/lib/provider.ts` | Returns the Claude model; falls back to `MockLanguageModel` if no API key |
| `src/lib/prompts/generation.tsx` | System prompt that instructs Claude to always start with `/App.jsx`, use `@/` imports, Tailwind |
| `src/actions/` | Server actions: auth (`signUp`/`signIn`/`signOut`) and project CRUD |

### Important conventions

- **Entry point**: The preview always looks for `/App.jsx` as the root component.
- **Import alias**: `@/` maps to `src/` in TypeScript and to the virtual file system root in the preview iframe.
- **`NODE_OPTIONS='--require ./node-compat.cjs'`** is prepended to all runtime scripts — this is a Node 25 SSR fix that removes non-functional `localStorage`/`sessionStorage` stubs from `globalThis`. Do not remove it.
- **MockLanguageModel** in `src/lib/provider.ts` enables the app to run without an `ANTHROPIC_API_KEY` by returning canned components via tool calls.
- Database: SQLite at `prisma/dev.db`; Prisma client is generated into `src/generated/prisma/`.
- **Auth**: Custom JWT auth via `jose` (not NextAuth). Sessions are stored in an `auth-token` httpOnly cookie (7-day expiry). `src/lib/auth.ts` handles signing/verification; middleware (`src/middleware.ts`) protects `/api/projects` and `/api/filesystem` routes.
- **Anonymous work**: Unauthenticated users can generate components; their messages + VFS are saved to `sessionStorage` via `src/lib/anon-work-tracker.ts` and migrated into a new project on sign-in/sign-up.
