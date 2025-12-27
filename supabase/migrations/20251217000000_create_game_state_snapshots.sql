-- Game State Snapshots table
-- Stores player spirit data synced from TTS after each navigation round

CREATE TABLE IF NOT EXISTS "arc-spirits-rev2".game_state_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  game_id text NOT NULL,
  game_timestamp timestamptz NOT NULL,
  navigation_count integer NOT NULL DEFAULT 0,
  player_color text NOT NULL,
  selected_character text NOT NULL,
  blood integer NOT NULL DEFAULT 0,
  victory_points integer NOT NULL DEFAULT 0,
  spirits jsonb NOT NULL DEFAULT '[]',
  bags jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT unique_game_nav_player UNIQUE (game_id, navigation_count, player_color)
);

-- Index for querying by game_id
CREATE INDEX IF NOT EXISTS idx_game_state_game_id
  ON "arc-spirits-rev2".game_state_snapshots(game_id);

-- Index for querying recent snapshots
CREATE INDEX IF NOT EXISTS idx_game_state_created_at
  ON "arc-spirits-rev2".game_state_snapshots(created_at DESC);

-- Index for querying by navigation count within a game
CREATE INDEX IF NOT EXISTS idx_game_state_game_navigation
  ON "arc-spirits-rev2".game_state_snapshots(game_id, navigation_count DESC);

-- Auto-update updated_at trigger (matching existing pattern)
CREATE OR REPLACE FUNCTION "arc-spirits-rev2".update_game_state_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_game_state_snapshots_updated_at
  ON "arc-spirits-rev2".game_state_snapshots;

CREATE TRIGGER update_game_state_snapshots_updated_at
  BEFORE UPDATE ON "arc-spirits-rev2".game_state_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION "arc-spirits-rev2".update_game_state_snapshots_updated_at();

-- Comments
COMMENT ON TABLE "arc-spirits-rev2".game_state_snapshots IS
  'Stores player spirit data synced from TTS after each navigation round';
COMMENT ON COLUMN "arc-spirits-rev2".game_state_snapshots.game_id IS
  'Unique game session ID (format: game_YYYYMMDD_HHMMSS_XXXX)';
COMMENT ON COLUMN "arc-spirits-rev2".game_state_snapshots.game_timestamp IS
  'Timestamp when the sync was triggered in TTS';
COMMENT ON COLUMN "arc-spirits-rev2".game_state_snapshots.navigation_count IS
  'Number of navigation rounds completed';
COMMENT ON COLUMN "arc-spirits-rev2".game_state_snapshots.player_color IS
  'TTS player color (Red, Orange, Yellow, Green, Blue, Purple)';
COMMENT ON COLUMN "arc-spirits-rev2".game_state_snapshots.selected_character IS
  'Character/Guardian name selected by the player';
COMMENT ON COLUMN "arc-spirits-rev2".game_state_snapshots.blood IS
  'Arcane Blood count for this player';
COMMENT ON COLUMN "arc-spirits-rev2".game_state_snapshots.victory_points IS
  'Victory Points count for this player';
COMMENT ON COLUMN "arc-spirits-rev2".game_state_snapshots.spirits IS
  'JSON array of spirits on the player mat with slot, id, name, cost, classes, origins';
COMMENT ON COLUMN "arc-spirits-rev2".game_state_snapshots.bags IS
  'JSON object with hexSpirits bag and purgeBags (5 sealed spirit bags) contents';
