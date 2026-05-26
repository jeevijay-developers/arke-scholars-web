-- Fix ERROR 42702: local variable `winner_id` was ambiguous with column `winner_id`
-- in the UPDATE statement. Renamed to `v_winner_id` throughout.
CREATE OR REPLACE FUNCTION public.finalize_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  m            compete_matches%ROWTYPE;
  r1           compete_ratings%ROWTYPE;
  r2           compete_ratings%ROWTYPE;
  v_winner_id  uuid    := NULL;
  p1_score     numeric;
  p2_score     numeric;
  d1           int     := 0;
  d2           int     := 0;
  new_streak   int;
  today        date    := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  -- Lock the row. The second concurrent call blocks here, then sees
  -- status != 'active' (already 'finished') and returns immediately.
  SELECT * INTO m
  FROM compete_matches
  WHERE id = p_match_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  -- Guard: both players must have answered every question
  IF m.player1_answer_count < m.total_questions THEN RETURN; END IF;
  IF NOT m.is_bot AND m.player2_id IS NOT NULL
     AND m.player2_answer_count < m.total_questions THEN RETURN; END IF;

  -- Determine winner (NULL = draw)
  IF m.player1_score > m.player2_score THEN
    v_winner_id := m.player1_id;
  ELSIF m.player2_score > m.player1_score THEN
    v_winner_id := COALESCE(m.player2_id, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  IF NOT m.is_bot AND m.player2_id IS NOT NULL THEN

    -- ELO score values: win=1, draw=0.5, loss=0
    p1_score := CASE WHEN v_winner_id IS NULL        THEN 0.5
                     WHEN v_winner_id = m.player1_id THEN 1.0
                     ELSE 0.0 END;
    p2_score := 1.0 - p1_score;

    d1 := round(32 * (p1_score - 1.0 / (1.0 + power(10.0,
            (m.player2_rating_before - m.player1_rating_before)::numeric / 400.0))));
    d2 := round(32 * (p2_score - 1.0 / (1.0 + power(10.0,
            (m.player1_rating_before - m.player2_rating_before)::numeric / 400.0))));

    -- Player 1: lock their rating row, then update
    SELECT * INTO r1 FROM compete_ratings
    WHERE user_id = m.player1_id
      AND target_exam = COALESCE(m.player1_target_exam, 'general')
    FOR UPDATE;

    IF FOUND THEN
      new_streak := CASE
        WHEN r1.last_streak_date IS NULL     THEN 1
        WHEN r1.last_streak_date = today     THEN r1.current_streak
        WHEN r1.last_streak_date = today - 1 THEN r1.current_streak + 1
        ELSE 1
      END;
      UPDATE compete_ratings SET
        rating           = r1.rating + d1,
        wins             = r1.wins   + (p1_score = 1.0)::int,
        losses           = r1.losses + (p1_score = 0.0)::int,
        draws            = r1.draws  + (p1_score = 0.5)::int,
        current_streak   = new_streak,
        best_streak      = GREATEST(r1.best_streak, new_streak),
        last_streak_date = today,
        updated_at       = now()
      WHERE id = r1.id;
    END IF;

    -- Player 2: lock their rating row, then update
    SELECT * INTO r2 FROM compete_ratings
    WHERE user_id = m.player2_id
      AND target_exam = COALESCE(m.player2_target_exam, 'general')
    FOR UPDATE;

    IF FOUND THEN
      new_streak := CASE
        WHEN r2.last_streak_date IS NULL     THEN 1
        WHEN r2.last_streak_date = today     THEN r2.current_streak
        WHEN r2.last_streak_date = today - 1 THEN r2.current_streak + 1
        ELSE 1
      END;
      UPDATE compete_ratings SET
        rating           = r2.rating + d2,
        wins             = r2.wins   + (p2_score = 1.0)::int,
        losses           = r2.losses + (p2_score = 0.0)::int,
        draws            = r2.draws  + (p2_score = 0.5)::int,
        current_streak   = new_streak,
        best_streak      = GREATEST(r2.best_streak, new_streak),
        last_streak_date = today,
        updated_at       = now()
      WHERE id = r2.id;
    END IF;

  ELSE

    -- Bot match: streak counts as a played day, but rating/wins unchanged
    SELECT * INTO r1 FROM compete_ratings
    WHERE user_id = m.player1_id
      AND target_exam = COALESCE(m.player1_target_exam, 'general')
    FOR UPDATE;

    IF FOUND THEN
      new_streak := CASE
        WHEN r1.last_streak_date IS NULL     THEN 1
        WHEN r1.last_streak_date = today     THEN r1.current_streak
        WHEN r1.last_streak_date = today - 1 THEN r1.current_streak + 1
        ELSE 1
      END;
      UPDATE compete_ratings SET
        current_streak   = new_streak,
        best_streak      = GREATEST(r1.best_streak, new_streak),
        last_streak_date = today,
        updated_at       = now()
      WHERE id = r1.id;
    END IF;

  END IF;

  -- Mark match finished — final write in the transaction
  UPDATE compete_matches SET
    status               = 'finished',
    finished_at          = now(),
    winner_id            = v_winner_id,
    player1_rating_after = m.player1_rating_before + d1,
    player2_rating_after = m.player2_rating_before + d2
  WHERE id = p_match_id;
END;
$$;
