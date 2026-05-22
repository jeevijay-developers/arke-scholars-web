-- Running totals per player per battle — updated after every answer.
-- Realtime broadcasts these changes so each player sees the opponent's live score.
create table if not exists battle_scores (
  id                  uuid        primary key default gen_random_uuid(),
  battle_id           uuid        not null references battles(id) on delete cascade,
  player_id           uuid        not null references auth.users(id) on delete cascade,
  score               int         not null default 0,
  questions_answered  int         not null default 0,
  updated_at          timestamptz not null default now(),
  unique (battle_id, player_id)
);

create index if not exists battle_scores_battle_idx
  on battle_scores (battle_id);

alter table battle_scores enable row level security;

-- Both players in the battle can read all score rows
create policy "battle_scores_select" on battle_scores
  for select using (
    auth.uid() in (
      select player1_id from battles where id = battle_id
      union
      select player2_id from battles where id = battle_id
    )
  );

-- Player inserts their own score row (created when battle goes active)
create policy "battle_scores_insert" on battle_scores
  for insert with check (auth.uid() = player_id);

-- Player updates their own score row
create policy "battle_scores_update" on battle_scores
  for update using (auth.uid() = player_id);

create policy "battle_scores_service_all" on battle_scores
  for all using (true)
  with check (true);
