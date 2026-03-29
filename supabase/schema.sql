create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop table if exists public.player_answers cascade;
drop table if exists public.game_rounds cascade;
drop table if exists public.game_sessions cascade;
drop table if exists public.room_players cascade;
drop table if exists public.rooms cascade;
drop table if exists public.questions cascade;
drop table if exists public.categories cascade;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  prompt text not null,
  answers jsonb not null,
  correct_answer_indexes int[] not null,
  explanation text,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, prompt),
  check (jsonb_typeof(answers) = 'array'),
  check (jsonb_array_length(answers) = 3),
  check (cardinality(correct_answer_indexes) between 1 and 2),
  check (correct_answer_indexes <@ array[0,1,2]::int[])
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'closed')),
  settings jsonb not null,
  host_player_id uuid,
  current_game_id uuid,
  closed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(settings) = 'object')
);

create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_token text not null,
  display_name text not null,
  is_host boolean not null default false,
  status text not null default 'active' check (status in ('active', 'left', 'kicked')),
  connection_status text not null default 'online' check (connection_status in ('online', 'offline')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  unique (room_id, player_token)
);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'finished', 'cancelled')),
  phase text not null default 'question' check (phase in ('question', 'reveal', 'finished')),
  current_round_number int not null default 1,
  total_rounds int not null check (total_rounds > 0),
  settings jsonb not null,
  phase_started_at timestamptz not null default now(),
  phase_ends_at timestamptz not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (jsonb_typeof(settings) = 'object')
);

create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  round_number int not null,
  answer_order int[] not null default array[0,1,2]::int[],
  created_at timestamptz not null default now(),
  unique (game_session_id, round_number),
  check (cardinality(answer_order) = 3),
  check (answer_order <@ array[0,1,2]::int[])
);

create table public.player_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds(id) on delete cascade,
  player_id uuid not null references public.room_players(id) on delete cascade,
  selected_indexes int[] not null default '{}'::int[],
  is_correct boolean not null default false,
  timed_out boolean not null default false,
  points_awarded int not null default 0,
  submitted_at timestamptz not null default now(),
  unique (round_id, player_id),
  check (cardinality(selected_indexes) <= 2),
  check (selected_indexes <@ array[0,1,2]::int[])
);

alter table public.rooms
  add constraint rooms_host_player_id_fkey
  foreign key (host_player_id) references public.room_players(id) on delete set null;

alter table public.rooms
  add constraint rooms_current_game_id_fkey
  foreign key (current_game_id) references public.game_sessions(id) on delete set null;

create index room_players_room_id_idx on public.room_players (room_id);
create index room_players_room_status_idx on public.room_players (room_id, status);
create index questions_category_id_idx on public.questions (category_id);
create index game_sessions_room_id_idx on public.game_sessions (room_id);
create index game_rounds_game_session_id_idx on public.game_rounds (game_session_id);
create index player_answers_round_id_idx on public.player_answers (round_id);
create index player_answers_player_id_idx on public.player_answers (player_id);

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

create trigger questions_set_updated_at
before update on public.questions
for each row
execute function public.set_updated_at();

create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at();

alter table public.categories disable row level security;
alter table public.questions disable row level security;
alter table public.rooms disable row level security;
alter table public.room_players disable row level security;
alter table public.game_sessions disable row level security;
alter table public.game_rounds disable row level security;
alter table public.player_answers disable row level security;

alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.questions;
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.game_sessions;
alter publication supabase_realtime add table public.game_rounds;
alter publication supabase_realtime add table public.player_answers;
