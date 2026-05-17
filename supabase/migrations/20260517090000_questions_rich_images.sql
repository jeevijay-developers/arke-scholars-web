-- Add rich_images column to questions table
-- Stores structured image metadata: type (equation/chemistry/diagram),
-- MOL data for chemistry structures, SMILES strings, and Storage URLs.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS rich_images jsonb;
