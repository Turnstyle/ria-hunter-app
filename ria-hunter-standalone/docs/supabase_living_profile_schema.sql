-- Living Profile Database Schema for RIA Hunter
-- This schema complements the ETL schema (advisers, filings, private_funds, narratives)
-- These tables store user-specific data for the Living Profile features

-- Table: user_notes
-- Stores personal notes that users add to RIA profiles
CREATE TABLE IF NOT EXISTS user_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Auth0 user ID (sub claim)
    ria_id TEXT NOT NULL, -- CIK number as string for consistency
    note_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure ria_id references a valid adviser
    CONSTRAINT fk_user_notes_ria_id
        FOREIGN KEY (ria_id)
        REFERENCES advisers(cik)
        ON DELETE CASCADE,

    -- Index for performance
    CONSTRAINT unique_user_note_order
        UNIQUE (user_id, ria_id, created_at)
);

-- Table: user_tags
-- Stores personal tags that users add to RIA profiles
CREATE TABLE IF NOT EXISTS user_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Auth0 user ID (sub claim)
    ria_id TEXT NOT NULL, -- CIK number as string for consistency
    tag_text TEXT NOT NULL CHECK (length(tag_text) <= 50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure ria_id references a valid adviser
    CONSTRAINT fk_user_tags_ria_id
        FOREIGN KEY (ria_id)
        REFERENCES advisers(cik)
        ON DELETE CASCADE,

    -- Prevent duplicate tags for same user/RIA combination
    CONSTRAINT unique_user_ria_tag
        UNIQUE (user_id, ria_id, tag_text)
);

-- Table: user_links
-- Stores personal links that users add to RIA profiles
CREATE TABLE IF NOT EXISTS user_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Auth0 user ID (sub claim)
    ria_id TEXT NOT NULL, -- CIK number as string for consistency
    link_url TEXT NOT NULL CHECK (link_url ~ '^https?://'),
    link_description TEXT, -- Optional description
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure ria_id references a valid adviser
    CONSTRAINT fk_user_links_ria_id
        FOREIGN KEY (ria_id)
        REFERENCES advisers(cik)
        ON DELETE CASCADE,

    -- Prevent duplicate links for same user/RIA combination
    CONSTRAINT unique_user_ria_link
        UNIQUE (user_id, ria_id, link_url)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_ria_id ON user_notes(ria_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_created_at ON user_notes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_tags_user_id ON user_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_ria_id ON user_tags(ria_id);

CREATE INDEX IF NOT EXISTS idx_user_links_user_id ON user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_links_ria_id ON user_links(ria_id);
CREATE INDEX IF NOT EXISTS idx_user_links_created_at ON user_links(created_at DESC);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_links ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own notes
DROP POLICY IF EXISTS "Users can view their own notes" ON user_notes;
CREATE POLICY "Users can view their own notes" ON user_notes
    FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON user_notes;
CREATE POLICY "Users can insert their own notes" ON user_notes
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON user_notes;
CREATE POLICY "Users can update their own notes" ON user_notes
    FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON user_notes;
CREATE POLICY "Users can delete their own notes" ON user_notes
    FOR DELETE USING (auth.uid()::text = user_id);

-- RLS Policy: Users can only access their own tags
DROP POLICY IF EXISTS "Users can view their own tags" ON user_tags;
CREATE POLICY "Users can view their own tags" ON user_tags
    FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own tags" ON user_tags;
CREATE POLICY "Users can insert their own tags" ON user_tags
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete their own tags" ON user_tags;
CREATE POLICY "Users can delete their own tags" ON user_tags
    FOR DELETE USING (auth.uid()::text = user_id);

-- RLS Policy: Users can only access their own links
DROP POLICY IF EXISTS "Users can view their own links" ON user_links;
CREATE POLICY "Users can view their own links" ON user_links
    FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own links" ON user_links;
CREATE POLICY "Users can insert their own links" ON user_links
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update their own links" ON user_links;
CREATE POLICY "Users can update their own links" ON user_links
    FOR UPDATE USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete their own links" ON user_links;
CREATE POLICY "Users can delete their own links" ON user_links
    FOR DELETE USING (auth.uid()::text = user_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS update_user_notes_updated_at ON user_notes;
CREATE TRIGGER update_user_notes_updated_at
    BEFORE UPDATE ON user_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_links_updated_at ON user_links;
CREATE TRIGGER update_user_links_updated_at
    BEFORE UPDATE ON user_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON user_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_links TO authenticated;

-- Grant select access to the advisers table for foreign key validation
GRANT SELECT ON advisers TO authenticated;

-- Comments for documentation
COMMENT ON TABLE user_notes IS 'Personal notes that users add to RIA profiles';
COMMENT ON TABLE user_tags IS 'Personal tags that users add to RIA profiles';
COMMENT ON TABLE user_links IS 'Personal links that users add to RIA profiles';

COMMENT ON COLUMN user_notes.user_id IS 'Auth0 user ID (sub claim)';
COMMENT ON COLUMN user_notes.ria_id IS 'CIK number referencing advisers table';
COMMENT ON COLUMN user_tags.tag_text IS 'Tag text, max 50 characters';
COMMENT ON COLUMN user_links.link_url IS 'Must be a valid HTTP/HTTPS URL';
COMMENT ON COLUMN user_links.link_description IS 'Optional description for the link';
