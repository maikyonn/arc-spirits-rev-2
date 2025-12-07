-- Add quantity column to artifacts table
-- This allows artifacts to be exported multiple times

ALTER TABLE "arc-spirits-rev2".artifacts
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- Add check constraint to ensure quantity is at least 1
ALTER TABLE "arc-spirits-rev2".artifacts
ADD CONSTRAINT artifacts_quantity_check CHECK (quantity >= 1);

