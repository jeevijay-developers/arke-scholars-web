-- Per-question answers for each player in a battle
create table if not exists battle_answers (
  id                    uuid        primary key default gen_random_uuid(),
  battle_id             uuid        not null references battles(id) on delete cascade,
  player_id             uuid        not null references auth.users(id) on delete cascade,
  question_id           uuid        not null,
  selected_option_index int,                    -- null = unanswered / timeout
  is_correct            boolean     not null default false,
  seconds_taken         int         not null default 30,
  points_earned         int         not null default 0,
  answered_at           timestamptz not null default now(),
  unique (battle_id, player_id, question_id)
);

create index if not exists battle_answers_battle_player_idx
  on battle_answers (battle_id, player_id);

alter table battle_answers enable row level security;

-- Both players in the battle can read all answers
create policy "battle_answers_select" on battle_answers
  for select using (
    auth.uid() in (
      select player1_id from battles where id = battle_id
      union
      select player2_id from battles where id = battle_id
    )
  );

-- Only the answering player inserts their own answer
create policy "battle_answers_insert" on battle_answers
  for insert with check (auth.uid() = player_id);

create policy "battle_answers_service_all" on battle_answers
  for all using (true)
  with check (true);
