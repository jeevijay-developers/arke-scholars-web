
-- =========================================================
-- COMPETE QUESTIONS
-- =========================================================
CREATE TABLE public.compete_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  topic text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_index int NOT NULL,
  explanation text,
  created_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compete_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read active compete questions"
  ON public.compete_questions FOR SELECT TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins manage compete questions"
  ON public.compete_questions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_compete_questions_filter ON public.compete_questions (subject, topic, difficulty) WHERE is_active = true;

CREATE TRIGGER trg_compete_questions_updated
  BEFORE UPDATE ON public.compete_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- COMPETE RATINGS
-- =========================================================
CREATE TABLE public.compete_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_exam text NOT NULL DEFAULT 'general',
  rating int NOT NULL DEFAULT 1000,
  wins int NOT NULL DEFAULT 0,
  losses int NOT NULL DEFAULT 0,
  draws int NOT NULL DEFAULT 0,
  current_streak int NOT NULL DEFAULT 0,
  best_streak int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_exam)
);
ALTER TABLE public.compete_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ratings"
  ON public.compete_ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own rating row"
  ON public.compete_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update ratings"
  ON public.compete_ratings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- =========================================================
-- COMPETE QUEUE
-- =========================================================
CREATE TABLE public.compete_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  target_exam text NOT NULL DEFAULT 'general',
  class_level text,
  subject text NOT NULL,
  topic text NOT NULL,
  rating int NOT NULL DEFAULT 1000,
  status text NOT NULL DEFAULT 'waiting',
  match_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compete_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User manages own queue entry"
  ON public.compete_queue FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_compete_queue_search ON public.compete_queue (status, subject, topic, target_exam, class_level, rating);

-- =========================================================
-- COMPETE MATCHES
-- =========================================================
CREATE TABLE public.compete_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id uuid NOT NULL,
  player2_id uuid,
  player1_name text,
  player2_name text,
  player1_avatar text,
  player2_avatar text,
  player1_rating_before int,
  player2_rating_before int,
  player1_rating_after int,
  player2_rating_after int,
  player1_score numeric NOT NULL DEFAULT 0,
  player2_score numeric NOT NULL DEFAULT 0,
  subject text NOT NULL,
  topic text NOT NULL,
  question_ids uuid[] NOT NULL DEFAULT '{}',
  current_question_index int NOT NULL DEFAULT 0,
  total_questions int NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'pending', -- pending | active | finished | cancelled
  room_code text UNIQUE,
  is_private boolean NOT NULL DEFAULT false,
  is_bot boolean NOT NULL DEFAULT false,
  winner_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.compete_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own matches"
  ON public.compete_matches FOR SELECT TO authenticated
  USING (auth.uid() = player1_id OR auth.uid() = player2_id
         OR has_role(auth.uid(), 'admin'::app_role)
         OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_compete_matches_players ON public.compete_matches (player1_id, player2_id, status);
CREATE INDEX idx_compete_matches_room ON public.compete_matches (room_code) WHERE room_code IS NOT NULL;

CREATE TRIGGER trg_compete_matches_updated
  BEFORE UPDATE ON public.compete_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- COMPETE MATCH ANSWERS
-- =========================================================
CREATE TABLE public.compete_match_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.compete_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_index int NOT NULL,
  question_id uuid NOT NULL,
  selected_index int,
  is_correct boolean NOT NULL DEFAULT false,
  time_taken_ms int NOT NULL DEFAULT 0,
  points numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id, question_index)
);
ALTER TABLE public.compete_match_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view answers in own match"
  ON public.compete_match_answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.compete_matches m
    WHERE m.id = compete_match_answers.match_id
      AND (auth.uid() = m.player1_id OR auth.uid() = m.player2_id)
  ));

CREATE INDEX idx_compete_answers_match ON public.compete_match_answers (match_id, question_index);

-- =========================================================
-- REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.compete_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.compete_match_answers;
ALTER TABLE public.compete_matches REPLICA IDENTITY FULL;
ALTER TABLE public.compete_match_answers REPLICA IDENTITY FULL;

-- =========================================================
-- SEED COMPETE QUESTIONS (~40)
-- =========================================================
INSERT INTO public.compete_questions (subject, topic, difficulty, question_text, options, correct_index, explanation) VALUES
-- Physics: Kinematics
('Physics','Kinematics','easy','A body starts from rest with acceleration 2 m/s². Distance covered in 5 s?', '["10 m","25 m","50 m","100 m"]'::jsonb, 1, 's = ½·a·t² = ½·2·25 = 25 m'),
('Physics','Kinematics','easy','SI unit of acceleration is?', '["m/s","m/s²","m·s","N"]'::jsonb, 1, 'Acceleration = velocity/time → m/s²'),
('Physics','Kinematics','medium','A ball thrown up with 20 m/s reaches max height (g=10): ', '["10 m","20 m","30 m","40 m"]'::jsonb, 1, 'h = u²/2g = 400/20 = 20 m'),
('Physics','Kinematics','medium','For uniform circular motion, acceleration is always:', '["Zero","Tangential","Centripetal","Constant in direction"]'::jsonb, 2, 'Centripetal — toward the center.'),
('Physics','Kinematics','hard','A car decelerates uniformly from 30 m/s to rest over 75 m. Deceleration?', '["3 m/s²","6 m/s²","9 m/s²","12 m/s²"]'::jsonb, 1, 'v² = u² − 2as → 0 = 900 − 2·a·75 → a = 6 m/s²'),
-- Physics: Laws of Motion
('Physics','Laws of Motion','easy','Newton''s first law is the law of:', '["Inertia","Force","Action-reaction","Gravitation"]'::jsonb, 0, 'A body remains at rest or in motion unless acted upon.'),
('Physics','Laws of Motion','medium','Force needed to give 5 kg an acceleration of 4 m/s² is:', '["9 N","20 N","1.25 N","0.8 N"]'::jsonb, 1, 'F = ma = 20 N'),
('Physics','Laws of Motion','medium','Action and reaction forces act on:', '["Same body","Different bodies","Same line, same body","None"]'::jsonb, 1, 'Newton''s 3rd law — different bodies.'),
-- Chemistry: Atomic Structure
('Chemistry','Atomic Structure','easy','Number of protons in carbon-12?', '["6","12","8","14"]'::jsonb, 0, 'Atomic number of C is 6.'),
('Chemistry','Atomic Structure','easy','Mass number = ?', '["Protons","Protons + neutrons","Electrons","Neutrons"]'::jsonb, 1, 'A = Z + N'),
('Chemistry','Atomic Structure','medium','Maximum electrons in n=3 shell?', '["8","18","32","2"]'::jsonb, 1, '2n² = 18'),
('Chemistry','Atomic Structure','medium','Quantum number that gives orbital orientation:', '["n","l","m","s"]'::jsonb, 2, 'Magnetic quantum number m gives orientation.'),
('Chemistry','Atomic Structure','hard','de Broglie wavelength is given by:', '["h/mv","mv/h","hv","mh"]'::jsonb, 0, 'λ = h/p = h/mv'),
-- Chemistry: Periodic Table
('Chemistry','Periodic Table','easy','Most electronegative element is:', '["O","F","Cl","N"]'::jsonb, 1, 'Fluorine — 4.0 on Pauling scale.'),
('Chemistry','Periodic Table','easy','Group 1 elements are called:', '["Halogens","Alkali metals","Noble gases","Alkaline earth"]'::jsonb, 1, 'Group 1 → alkali metals.'),
('Chemistry','Periodic Table','medium','Atomic radius across a period (left→right):', '["Increases","Decreases","Same","No trend"]'::jsonb, 1, 'Effective nuclear charge increases.'),
-- Chemistry: Mole Concept
('Chemistry','Mole Concept','easy','Avogadro''s number ≈', '["6.022e22","6.022e23","1.602e19","9.81"]'::jsonb, 1, '6.022 × 10²³ per mole.'),
('Chemistry','Mole Concept','medium','Moles in 36 g water?', '["1","2","18","0.5"]'::jsonb, 1, '36/18 = 2 mol.'),
-- Math: Algebra
('Math','Algebra','easy','Roots of x² − 5x + 6 = 0?', '["1,6","2,3","−2,−3","3,4"]'::jsonb, 1, 'Factor: (x−2)(x−3).'),
('Math','Algebra','easy','Value of (a+b)² − (a−b)² =', '["4ab","2ab","a²+b²","0"]'::jsonb, 0, 'Identity → 4ab.'),
('Math','Algebra','medium','If x + 1/x = 3, find x² + 1/x²:', '["7","9","11","5"]'::jsonb, 0, '(x+1/x)² − 2 = 9 − 2 = 7'),
('Math','Algebra','medium','Sum of roots of 2x² − 4x + 1 = 0?', '["2","−2","1/2","4"]'::jsonb, 0, '−b/a = 4/2 = 2'),
('Math','Algebra','hard','If α,β are roots of x² − 6x + 8 = 0, then α³+β³ =', '["72","144","56","216"]'::jsonb, 0, 's=6,p=8 → s³−3ps = 216 − 144 = 72'),
-- Math: Trigonometry
('Math','Trigonometry','easy','sin 30° =', '["1/2","√3/2","1","0"]'::jsonb, 0, 'Standard value.'),
('Math','Trigonometry','easy','cos 0° =', '["0","1","−1","√2"]'::jsonb, 1, 'cos 0 = 1.'),
('Math','Trigonometry','medium','tan 45° + cot 45° =', '["1","2","0","√2"]'::jsonb, 1, '1 + 1 = 2.'),
('Math','Trigonometry','medium','sin²θ + cos²θ =', '["0","1","2","tan²θ"]'::jsonb, 1, 'Pythagorean identity.'),
-- Math: Calculus
('Math','Calculus','medium','d/dx (x³) =', '["x²","3x²","3x","x³/3"]'::jsonb, 1, 'Power rule.'),
('Math','Calculus','medium','∫ 2x dx =', '["x²+C","2x²+C","x+C","2+C"]'::jsonb, 0, '∫2x dx = x² + C'),
('Math','Calculus','hard','lim_{x→0} sin(x)/x =', '["0","1","∞","Undefined"]'::jsonb, 1, 'Standard limit = 1.'),
-- Biology: Cell
('Biology','Cell','easy','Powerhouse of the cell:', '["Nucleus","Mitochondria","Ribosome","Golgi"]'::jsonb, 1, 'ATP production site.'),
('Biology','Cell','easy','Plant cells differ from animal cells by having:', '["Nucleus","Cell wall","Mitochondria","Membrane"]'::jsonb, 1, 'Cellulose cell wall.'),
('Biology','Cell','medium','Site of protein synthesis:', '["Ribosome","Lysosome","Nucleolus","Vacuole"]'::jsonb, 0, 'Ribosomes assemble proteins.'),
('Biology','Cell','medium','DNA is found primarily in:', '["Cytoplasm","Mitochondria only","Nucleus","Cell wall"]'::jsonb, 2, 'Mostly nuclear DNA (also some in mitochondria).'),
-- Biology: Human Physiology
('Biology','Human Physiology','easy','Normal human body temperature (°C):', '["35","37","39","40"]'::jsonb, 1, '~37 °C / 98.6 °F.'),
('Biology','Human Physiology','easy','Number of chambers in the human heart:', '["2","3","4","5"]'::jsonb, 2, 'Two atria + two ventricles.'),
('Biology','Human Physiology','medium','Insulin is secreted by:', '["Liver","Pancreas","Kidney","Spleen"]'::jsonb, 1, 'Beta cells of pancreas.'),
('Biology','Human Physiology','medium','Largest gland in human body:', '["Pancreas","Liver","Thyroid","Adrenal"]'::jsonb, 1, 'Liver is the largest gland.'),
-- General
('Math','Algebra','easy','log₁₀(1000) =', '["1","2","3","10"]'::jsonb, 2, '10³ = 1000.'),
('Physics','Laws of Motion','easy','Unit of force in SI:', '["dyne","newton","joule","watt"]'::jsonb, 1, 'Newton (kg·m/s²).');
