# QuizDuell Live

Realtime multiplayer quiz duel MVP built with Next.js App Router and Tailwind CSS.

## Architecture

This version is intentionally local-only and does not use any database provider.

- Categories and questions are stored in [`data/question-bank.json`](/c:/Users/Dieter%20Holstein/OneDrive/Desktop/QuizDuel/QuizDuell/data/question-bank.json)
- Active rooms, players, rounds, and scores are stored in the Next.js server process memory
- Browser clients stay in sync by polling the room APIs

Important limitation:

- If you restart the dev server, all active rooms and ongoing games are lost
- The question bank persists because it is saved in the repo file

## Features

- Display-name onboarding stored in `localStorage`
- Host/join flow with 6-character room codes
- Lobby with live player list, host badge, kick controls, room code, and share link
- Category and question CRUD with validation
- Configurable game settings
- Synced multiplayer gameplay with timed reveal phases
- Leaderboard and replay flow
- Demo categories:
  - General Knowledge
  - Movies
  - Gaming
  - Geography

## Project Structure

```text
app/
  api/                  Route handlers for rooms, games, categories, questions
  categories/           Standalone question-bank page
  room/[code]/          Multiplayer room page
components/
  ui/                   Reusable UI primitives
  home-page.tsx         Landing page and entry flow
  room-page.tsx         Lobby, game, leaderboard, replay UI
  category-manager.tsx  CRUD editor for categories/questions
hooks/
  use-profile.ts        Local profile persistence
  use-room.ts           Room join, polling, heartbeat, syncing
  use-category-bank.ts  Question-bank loader
lib/
  server/               Local file-backed content service and in-memory room engine
  validation.ts         Zod schemas
  game.ts               Game helpers and scoring logic
data/
  question-bank.json    Persistent categories and questions
types/
  app.ts                Shared app-level types
```

## Local Development

No environment variables are required.

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
5. Join with the room code or copied room link.
6. Start the duel and answer in both windows.

## Editing Questions Directly

You can edit quiz content in two ways:

1. In the app through the category/question manager.
2. Directly in [`data/question-bank.json`](/c:/Users/Dieter%20Holstein/OneDrive/Desktop/QuizDuel/QuizDuell/data/question-bank.json).

Each category stores its own nested questions. Keep these rules intact when editing manually:

- Every question must have exactly 3 answers
- Every question must have 1 or 2 correct answer indexes
- `category_id` must match the parent category `id`

## Verification

The app was verified with:

```bash
npm run lint
npm run build
```

## What To Improve Later

- Durable room persistence across server restarts
- WebSocket or SSE sync instead of polling
- Host transfer when the host leaves
- Match history and analytics
- Media-rich questions
