-- Battles table: one row per 1v1 SCQ battle session
create table if not exists battles (
  id             uuid        primary key default gen_random_uuid(),
  player1_id     uuid        not null references auth.users(id) on delete cascade,
  player2_id     uuid                 references auth.users(id) on delete cascade,
  class_level    text        not null,
  target_exam    text        not null,
  subject        text        not null,
  topic          text        not null,
  question_ids   uuid[]      not null default '{}',
  status         text        not null default 'waiting',
  winner_id      uuid                 references auth.users(id),
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  constraint battles_status_check check (status in ('waiting', 'active', 'completed'))
);

-- Fast lookup for open lobbies with matching filters
create index if not exists battles_open_lobby_idx
  on battles (class_level, target_exam, subject, topic)
  where status = 'waiting';

alter table battles enable row level security;

-- Both players can read their battle row
create policy "battles_select" on battles
  for select using (
    auth.uid() = player1_id or auth.uid() = player2_id
  );

-- Only the creating player inserts (they become player1)
create policy "battles_insert" on battles
  for insert with check (auth.uid() = player1_id);

-- Either player can update (joining as player2, completing)
create policy "battles_update" on battles
  for update using (
    auth.uid() = player1_id or auth.uid() = player2_id
  );

-- Service role bypass (used by edge functions)
create policy "battles_service_all" on battles
  for all using (true)
  with check (true);
