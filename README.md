# QuizDuell Live

Realtime multiplayer quiz duel MVP built with Next.js App Router, Tailwind CSS, and Supabase.

## Features

- Local display-name onboarding stored in `localStorage`
- Host/join flow with 6-character room codes
- Live lobby with host badge, kick controls, room link, and copy actions
- Category and question management with validation
- Configurable duel settings:
  - question count
  - timer length
  - points per question
  - selected categories
  - randomized question order
  - randomized answer order
  - explanations on reveal
- Realtime synced gameplay using Supabase Realtime subscriptions
- Auto reveal on timeout or when all players answer
- Live leaderboard and replay flow
- Demo seed data for:
  - General Knowledge
  - Movies
  - Gaming
  - Geography

## Project Structure

```text
app/
  api/                  Next route handlers for rooms, games, categories, questions
  categories/           Standalone question-bank page
  room/[code]/          Realtime room page
components/
  ui/                   Reusable UI primitives
  home-page.tsx         Landing page and entry flow
  room-page.tsx         Lobby, game, leaderboard, replay UI
  category-manager.tsx  CRUD editor for categories/questions
hooks/
  use-profile.ts        Local profile persistence
  use-room.ts           Room join, subscriptions, heartbeat, syncing
  use-category-bank.ts  Question-bank data loader
lib/
  server/               Supabase-backed room/game/content services
  supabase/             Browser + server Supabase clients
  validation.ts         Zod schemas
  game.ts               Game helpers and scoring logic
supabase/
  schema.sql            Database schema + realtime publication
  seed.sql              Demo categories and questions
types/
  app.ts                Shared app-level types
  database.ts           Supabase database shape
```

## Supabase Setup

1. Create a new Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Open the Supabase SQL Editor and run:
   - [`supabase/schema.sql`](/c:/Users/Dieter%20Holstein/OneDrive/Desktop/QuizDuel/QuizDuell/supabase/schema.sql)
   - [`supabase/seed.sql`](/c:/Users/Dieter%20Holstein/OneDrive/Desktop/QuizDuel/QuizDuell/supabase/seed.sql)

Notes:

- The MVP uses the service role key on the Next.js server for mutations.
- Tables are added to the `supabase_realtime` publication in `schema.sql`.
- RLS is disabled in this MVP to keep the no-auth flow simple. That is fine for local development and demo use, but should be redesigned for production.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## How To Test Multiplayer

1. Open the app in one browser tab and choose a display name.
2. Host a room.
3. Open a second tab or an incognito window.
4. Enter another display name.
5. Join the room with the code or copied link.
6. Start the duel and answer in both windows.

## Validation Rules

- Every question must have exactly 3 answers.
- Each question must have 1 or 2 correct answers.
- Empty fields are rejected.
- Rooms require at least 2 active players to start.
- Starting fails if there are not enough questions in the selected categories.
- Duplicate display names in the same room are auto-numbered.

## Verification

The app was verified with:

```bash
npm run lint
npm run build
```

## What To Improve Later

- Real authentication and secure RLS policies
- Presence/broadcast channels instead of open table subscriptions
- Better host transfer rules
- Richer analytics and match history
- Image/media support for questions
- Dedicated mobile gestures and audio feedback
