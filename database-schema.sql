
DO $$ BEGIN DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS trg_generate_problem_slug ON coding_problems; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS trg_update_user_stats ON user_progress; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS generate_problem_slug() CASCADE;
DROP FUNCTION IF EXISTS update_user_stats_on_progress() CASCADE;

-- Drop tables (order matters — child tables first)
DROP TABLE IF EXISTS daily_challenges CASCADE;
DROP TABLE IF EXISTS bookmarks CASCADE;
DROP TABLE IF EXISTS user_progress CASCADE;
DROP TABLE IF EXISTS ai_verification_logs CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS streaks CASCADE;
DROP TABLE IF EXISTS leaderboard_entries CASCADE;
DROP TABLE IF EXISTS contest_problems CASCADE;
DROP TABLE IF EXISTS contest_participants CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS contests CASCADE;
DROP TABLE IF EXISTS coding_problems CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;


-- ======================== 1. PROFILES ========================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  phone TEXT,
  total_points INTEGER DEFAULT 0,
  problems_solved INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  badges JSONB DEFAULT '[]'::jsonb,
  banned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup (handles email, phone, and OAuth users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _username TEXT;
  _full_name TEXT;
  _avatar TEXT;
  _phone TEXT;
BEGIN
  -- Determine username: metadata > email prefix > phone > random
  _username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NULLIF(NEW.raw_user_meta_data->>'preferred_username', ''),
    CASE WHEN NEW.email IS NOT NULL AND NEW.email != '' THEN split_part(NEW.email, '@', 1) END,
    CASE WHEN NEW.phone IS NOT NULL AND NEW.phone != '' THEN 'user_' || RIGHT(NEW.phone, 4) END,
    'user_' || LEFT(NEW.id::text, 8)
  );

  -- Determine full name: metadata > name from Google > email prefix > phone
  _full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    CASE WHEN NEW.email IS NOT NULL AND NEW.email != '' THEN split_part(NEW.email, '@', 1) END,
    _username
  );

  -- Avatar URL from metadata (Google provides 'avatar_url' or 'picture')
  _avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', ''),
    ''
  );

  -- Phone from auth record
  _phone := COALESCE(NEW.phone, '');

  INSERT INTO public.profiles (id, username, full_name, avatar_url, phone)
  VALUES (NEW.id, _username, _full_name, _avatar, _phone);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ======================== 2. VIDEOS ========================
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  tags TEXT[] DEFAULT '{}',
  channel_title TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  duration TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  view_count INTEGER DEFAULT 0,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_videos_youtube_id ON videos(youtube_id);


-- ======================== 3. CODING PROBLEMS ========================
CREATE TABLE coding_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT NOT NULL,
  difficulty TEXT DEFAULT 'Easy' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  category TEXT DEFAULT 'DSA',
  type TEXT DEFAULT 'code' CHECK (type IN ('mcq', 'code', 'sql', 'project')),
  tags TEXT[] DEFAULT '{}',
  starter_code JSONB DEFAULT '{}'::jsonb,
  test_cases JSONB DEFAULT '[]'::jsonb,
  examples JSONB DEFAULT '[]'::jsonb,
  constraints TEXT[] DEFAULT '{}',
  mcq_options JSONB DEFAULT '[]'::jsonb,
  correct_answer TEXT DEFAULT '',
  points INTEGER DEFAULT 10,
  order_index INTEGER DEFAULT 0,
  is_daily_challenge BOOLEAN DEFAULT false,
  daily_challenge_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_coding_problems_slug ON coding_problems(slug);
CREATE INDEX idx_coding_problems_category ON coding_problems(category);
CREATE INDEX idx_coding_problems_difficulty ON coding_problems(difficulty);
CREATE INDEX idx_coding_problems_type ON coding_problems(type);
CREATE INDEX idx_coding_problems_daily ON coding_problems(daily_challenge_date);


-- ======================== 4. SUBMISSIONS ========================
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES coding_problems(id) ON DELETE CASCADE,
  contest_id UUID,
  language TEXT DEFAULT 'javascript',
  code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'wrong_answer', 'runtime_error', 'time_limit')),
  execution_time REAL DEFAULT 0,
  test_results JSONB DEFAULT '[]'::jsonb,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ======================== 5. CONTESTS ========================
CREATE TABLE contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ======================== 6. CONTEST PARTICIPANTS ========================
CREATE TABLE contest_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contest_id, user_id)
);


-- ======================== 7. CONTEST PROBLEMS ========================
CREATE TABLE contest_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES coding_problems(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  points INTEGER DEFAULT 100,
  UNIQUE(contest_id, problem_id)
);


-- ======================== 8. LEADERBOARD ========================
CREATE TABLE leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  problems_solved INTEGER DEFAULT 0,
  last_submission_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contest_id, user_id)
);


-- ======================== 9. STREAKS ========================
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_type TEXT DEFAULT 'login',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, activity_date)
);


-- ======================== 10. REPORTS ========================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ======================== 11. AI VERIFICATION LOGS ========================
CREATE TABLE ai_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id TEXT,
  video_title TEXT,
  is_educational BOOLEAN DEFAULT false,
  confidence_score REAL DEFAULT 0,
  reason TEXT DEFAULT '',
  ai_provider TEXT DEFAULT 'mock',
  raw_response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ======================== 12. BOOKMARKS ========================
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID REFERENCES coding_problems(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);


-- ======================== 13. USER PROGRESS ========================
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID REFERENCES coding_problems(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'attempted' CHECK (status IN ('solved', 'attempted')),
  language_used TEXT DEFAULT 'javascript',
  score INTEGER DEFAULT 0,
  submitted_code TEXT DEFAULT '',
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX idx_user_progress_user ON user_progress(user_id);
CREATE INDEX idx_user_progress_status ON user_progress(user_id, status);


-- ======================== 14. DAILY CHALLENGES ========================
CREATE TABLE daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES coding_problems(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_daily_challenges_date ON daily_challenges(challenge_date);


-- ======================== ROW LEVEL SECURITY ========================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Videos
CREATE POLICY "Approved videos are viewable by everyone" ON videos FOR SELECT USING (true);
CREATE POLICY "Authenticated users can submit videos" ON videos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Service role can update videos" ON videos FOR UPDATE USING (true);

-- Coding Problems
CREATE POLICY "Problems are viewable by everyone" ON coding_problems FOR SELECT USING (true);
CREATE POLICY "Service role can manage problems" ON coding_problems FOR ALL USING (true);

-- Submissions
CREATE POLICY "Users can view own submissions" ON submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own submissions" ON submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Contests
CREATE POLICY "Contests are viewable by everyone" ON contests FOR SELECT USING (true);
CREATE POLICY "Service role can manage contests" ON contests FOR ALL USING (true);

-- Contest Participants
CREATE POLICY "Participants viewable by all" ON contest_participants FOR SELECT USING (true);
CREATE POLICY "Users can join contests" ON contest_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Contest Problems
CREATE POLICY "Contest problems viewable by all" ON contest_problems FOR SELECT USING (true);

-- Leaderboard
CREATE POLICY "Leaderboard viewable by all" ON leaderboard_entries FOR SELECT USING (true);
CREATE POLICY "Service role can manage leaderboard" ON leaderboard_entries FOR ALL USING (true);

-- Streaks
CREATE POLICY "Users can view own streaks" ON streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streaks" ON streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streaks" ON streaks FOR UPDATE USING (auth.uid() = user_id);

-- Reports
CREATE POLICY "Users can insert reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Service role can manage reports" ON reports FOR SELECT USING (true);
CREATE POLICY "Service role can update reports" ON reports FOR UPDATE USING (true);

-- AI Logs
CREATE POLICY "Service role can manage ai logs" ON ai_verification_logs FOR ALL USING (true);

-- Bookmarks
CREATE POLICY "Users can view own bookmarks" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

-- User Progress
CREATE POLICY "Users can view own progress" ON user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON user_progress FOR UPDATE USING (auth.uid() = user_id);

-- Daily Challenges
CREATE POLICY "Daily challenges viewable by all" ON daily_challenges FOR SELECT USING (true);
CREATE POLICY "Service role can manage daily challenges" ON daily_challenges FOR ALL USING (true);


-- ======================== REALTIME ========================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE profiles; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE submissions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE user_progress; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard_entries; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE bookmarks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ======================== FUNCTIONS & TRIGGERS ========================

-- Auto-generate slug from title
CREATE OR REPLACE FUNCTION generate_problem_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
    NEW.slug := trim(BOTH '-' FROM NEW.slug);
    IF EXISTS (SELECT 1 FROM coding_problems WHERE slug = NEW.slug AND id != NEW.id) THEN
      NEW.slug := NEW.slug || '-' || substr(gen_random_uuid()::text, 1, 6);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_problem_slug
  BEFORE INSERT OR UPDATE ON coding_problems
  FOR EACH ROW EXECUTE FUNCTION generate_problem_slug();

-- Update user stats when problem solved
CREATE OR REPLACE FUNCTION update_user_stats_on_progress()
RETURNS TRIGGER AS $$
DECLARE
  solved_count INTEGER;
  total_score INTEGER;
BEGIN
  IF NEW.status = 'solved' THEN
    SELECT COUNT(*), COALESCE(SUM(score), 0)
    INTO solved_count, total_score
    FROM user_progress
    WHERE user_id = NEW.user_id AND status = 'solved';
    UPDATE profiles SET
      problems_solved = solved_count,
      total_points = total_score,
      updated_at = now()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_user_stats
  AFTER INSERT OR UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_progress();


