-- Question Bank: a reusable library of MCQs maintained by teachers/staff.

CREATE TABLE public.question_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID,
  subject TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  question_text TEXT NOT NULL,
  question_image_url TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer JSONB NOT NULL,
  explanation TEXT,
  marks_correct NUMERIC NOT NULL DEFAULT 4,
  marks_wrong NUMERIC NOT NULL DEFAULT -1,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_question_bank_subject ON public.question_bank(subject);
CREATE INDEX idx_question_bank_difficulty ON public.question_bank(difficulty);
CREATE INDEX idx_question_bank_created_by ON public.question_bank(created_by);

ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

-- Any teacher / staff / admin can read the bank
CREATE POLICY "Teachers and staff can view question bank"
ON public.question_bank
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Teachers can insert their own questions
CREATE POLICY "Teachers can add questions"
ON public.question_bank
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    has_role(auth.uid(), 'teacher'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Owners + staff/admin can update
CREATE POLICY "Owners and staff can update questions"
ON public.question_bank
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Owners + staff/admin can delete
CREATE POLICY "Owners and staff can delete questions"
ON public.question_bank
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Auto-update updated_at
CREATE TRIGGER update_question_bank_updated_at
BEFORE UPDATE ON public.question_bank
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed sample questions (created_by NULL = system seed; visible to all teachers/staff)
INSERT INTO public.question_bank (subject, topic, difficulty, question_text, options, correct_answer, explanation) VALUES
('Physics', 'Kinematics', 'easy',
 'A body starts from rest with uniform acceleration 2 m/s². Distance covered in 5 s?',
 '[{"id":0,"text":"10 m"},{"id":1,"text":"15 m"},{"id":2,"text":"25 m"},{"id":3,"text":"50 m"}]'::jsonb,
 '2'::jsonb,
 's = ½ a t² = ½ × 2 × 25 = 25 m.'),
('Physics', 'Newton''s Laws', 'medium',
 'A 2 kg block is pushed with 10 N force on a frictionless surface. Acceleration?',
 '[{"id":0,"text":"2 m/s²"},{"id":1,"text":"5 m/s²"},{"id":2,"text":"10 m/s²"},{"id":3,"text":"20 m/s²"}]'::jsonb,
 '1'::jsonb,
 'a = F/m = 10/2 = 5 m/s².'),
('Physics', 'Optics', 'medium',
 'Refractive index of water is 4/3. Critical angle for water-air interface is approximately?',
 '[{"id":0,"text":"30°"},{"id":1,"text":"42°"},{"id":2,"text":"49°"},{"id":3,"text":"60°"}]'::jsonb,
 '2'::jsonb,
 'sin C = 1/μ = 3/4 → C ≈ 48.6°.'),
('Physics', 'Electrostatics', 'hard',
 'Two point charges +q and −q are placed at distance d. Electric field at the midpoint is?',
 '[{"id":0,"text":"0"},{"id":1,"text":"kq/d²"},{"id":2,"text":"4kq/d²"},{"id":3,"text":"8kq/d²"}]'::jsonb,
 '3'::jsonb,
 'Both fields point in the same direction; E = 2 × kq/(d/2)² = 8kq/d².'),
('Physics', 'Thermodynamics', 'easy',
 'First law of thermodynamics is a statement of conservation of?',
 '[{"id":0,"text":"Mass"},{"id":1,"text":"Energy"},{"id":2,"text":"Momentum"},{"id":3,"text":"Charge"}]'::jsonb,
 '1'::jsonb,
 'ΔU = Q − W expresses energy conservation.'),

('Chemistry', 'Atomic Structure', 'easy',
 'Number of electrons in a neutral atom of oxygen (Z=8)?',
 '[{"id":0,"text":"6"},{"id":1,"text":"7"},{"id":2,"text":"8"},{"id":3,"text":"16"}]'::jsonb,
 '2'::jsonb,
 'Neutral atom has electrons = atomic number = 8.'),
('Chemistry', 'Periodic Table', 'medium',
 'Which element has the highest electronegativity?',
 '[{"id":0,"text":"Oxygen"},{"id":1,"text":"Nitrogen"},{"id":2,"text":"Fluorine"},{"id":3,"text":"Chlorine"}]'::jsonb,
 '2'::jsonb,
 'Fluorine: 3.98 on the Pauling scale.'),
('Chemistry', 'Organic Chemistry', 'medium',
 'IUPAC name of CH3-CH(OH)-CH3 is?',
 '[{"id":0,"text":"Propan-1-ol"},{"id":1,"text":"Propan-2-ol"},{"id":2,"text":"Ethanol"},{"id":3,"text":"Methanol"}]'::jsonb,
 '1'::jsonb,
 'OH on the middle (2nd) carbon of a 3-carbon chain.'),
('Chemistry', 'Equilibrium', 'hard',
 'For N2 + 3H2 ⇌ 2NH3, increasing pressure shifts equilibrium toward?',
 '[{"id":0,"text":"Reactants"},{"id":1,"text":"Products"},{"id":2,"text":"No change"},{"id":3,"text":"Depends on temperature"}]'::jsonb,
 '1'::jsonb,
 'Higher pressure favours fewer moles of gas (2 < 4) → products.'),
('Chemistry', 'Mole Concept', 'easy',
 'Number of molecules in 18 g of water?',
 '[{"id":0,"text":"6.022 × 10²²"},{"id":1,"text":"6.022 × 10²³"},{"id":2,"text":"3.011 × 10²³"},{"id":3,"text":"1.204 × 10²⁴"}]'::jsonb,
 '1'::jsonb,
 '18 g = 1 mole = Avogadro''s number of molecules.'),

('Mathematics', 'Calculus', 'easy',
 'd/dx (sin x) = ?',
 '[{"id":0,"text":"cos x"},{"id":1,"text":"−cos x"},{"id":2,"text":"−sin x"},{"id":3,"text":"tan x"}]'::jsonb,
 '0'::jsonb,
 'Standard derivative.'),
('Mathematics', 'Algebra', 'medium',
 'Roots of x² − 5x + 6 = 0 are?',
 '[{"id":0,"text":"1, 6"},{"id":1,"text":"2, 3"},{"id":2,"text":"−2, −3"},{"id":3,"text":"−1, −6"}]'::jsonb,
 '1'::jsonb,
 '(x − 2)(x − 3) = 0.'),
('Mathematics', 'Trigonometry', 'medium',
 'Value of sin 30° + cos 60° = ?',
 '[{"id":0,"text":"0"},{"id":1,"text":"½"},{"id":2,"text":"1"},{"id":3,"text":"√3"}]'::jsonb,
 '2'::jsonb,
 '½ + ½ = 1.'),
('Mathematics', 'Probability', 'hard',
 'A fair coin is tossed 3 times. Probability of getting at least one head?',
 '[{"id":0,"text":"1/8"},{"id":1,"text":"3/8"},{"id":2,"text":"7/8"},{"id":3,"text":"1"}]'::jsonb,
 '2'::jsonb,
 '1 − P(no heads) = 1 − 1/8 = 7/8.'),
('Mathematics', 'Vectors', 'medium',
 'If a·b = 0 and a, b are non-zero, then a and b are?',
 '[{"id":0,"text":"Parallel"},{"id":1,"text":"Anti-parallel"},{"id":2,"text":"Perpendicular"},{"id":3,"text":"Equal"}]'::jsonb,
 '2'::jsonb,
 'Dot product zero ⇒ angle 90°.'),

('Biology', 'Cell Biology', 'easy',
 'Powerhouse of the cell is?',
 '[{"id":0,"text":"Nucleus"},{"id":1,"text":"Mitochondria"},{"id":2,"text":"Ribosome"},{"id":3,"text":"Golgi body"}]'::jsonb,
 '1'::jsonb,
 'Mitochondria produce ATP via cellular respiration.'),
('Biology', 'Genetics', 'medium',
 'Number of chromosomes in a normal human somatic cell?',
 '[{"id":0,"text":"23"},{"id":1,"text":"44"},{"id":2,"text":"46"},{"id":3,"text":"48"}]'::jsonb,
 '2'::jsonb,
 '23 pairs = 46 chromosomes.'),
('Biology', 'Human Physiology', 'medium',
 'Which blood cells are responsible for clotting?',
 '[{"id":0,"text":"RBCs"},{"id":1,"text":"WBCs"},{"id":2,"text":"Platelets"},{"id":3,"text":"Plasma"}]'::jsonb,
 '2'::jsonb,
 'Platelets (thrombocytes) initiate clotting.'),
('Biology', 'Plant Physiology', 'easy',
 'Photosynthesis occurs primarily in which organelle?',
 '[{"id":0,"text":"Mitochondria"},{"id":1,"text":"Chloroplast"},{"id":2,"text":"Nucleus"},{"id":3,"text":"Vacuole"}]'::jsonb,
 '1'::jsonb,
 'Chloroplasts contain chlorophyll for photosynthesis.'),
('Biology', 'Ecology', 'hard',
 'In a food chain, energy flow is?',
 '[{"id":0,"text":"Cyclic"},{"id":1,"text":"Unidirectional"},{"id":2,"text":"Bidirectional"},{"id":3,"text":"Random"}]'::jsonb,
 '1'::jsonb,
 'Energy flows one way: producers → consumers → decomposers.');
