-- Adds object-level throughput limits for entrance/exit.
ALTER TABLE objects ADD COLUMN IF NOT EXISTS capacity_in INTEGER;
ALTER TABLE objects ADD COLUMN IF NOT EXISTS capacity_out INTEGER;

