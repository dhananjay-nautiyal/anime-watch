-- Database indexes for performance optimization
-- Run against your PostgreSQL database after schema creation

-- Anime table: add indexes for query patterns not yet covered
CREATE INDEX IF NOT EXISTS idx_anime_popularity ON anime (popularity);
CREATE INDEX IF NOT EXISTS idx_anime_imported_at ON anime (imported_at);

-- Episodes: most common lookup is by anime_mal_id
CREATE INDEX IF NOT EXISTS idx_episodes_anime_mal_id ON episodes (anime_mal_id);
CREATE INDEX IF NOT EXISTS idx_episodes_mal_id_number ON episodes (anime_mal_id, episode_number);

-- Reviews: FK lookups for anime detail page and user profile
CREATE INDEX IF NOT EXISTS idx_reviews_anime_id ON reviews (anime_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews (user_id);

-- Favorites: user and anime lookups
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_anime_id ON favorites (anime_id);

-- Watchlist: user and anime lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist (user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_anime_id ON watchlist (anime_id);

-- Watch history: continue-watching query and user history
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history (user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_updated ON watch_history (user_id, updated_at);

-- Import pipeline
CREATE INDEX IF NOT EXISTS idx_import_log_job_id ON import_log (job_id);
CREATE INDEX IF NOT EXISTS idx_import_job_status_created ON import_job (status, created_at);

-- Settings
CREATE INDEX IF NOT EXISTS idx_setting_detail_setting_id ON setting_detail (setting_id);
CREATE INDEX IF NOT EXISTS idx_setting_detail_key ON setting_detail (setting_key);
