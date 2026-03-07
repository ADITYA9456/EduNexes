-- =====================================================================
-- EduNexes — COMPLETE DATABASE (YouTube + Coding Module)
-- ONE query to rule them all. Run in Supabase SQL Editor.
-- Drops everything first, then creates fresh. Safe to re-run.
-- =====================================================================


-- ======================== CLEAN SLATE ========================
-- Drop triggers first (wrapped so they don't fail if table doesn't exist)
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


-- ======================== SAMPLE VIDEOS ========================
INSERT INTO videos (youtube_id, title, description, category, tags, channel_title, thumbnail_url, status, view_count) VALUES
('dQw4w9WgXcQ', 'Learn React in 30 Minutes - Complete Beginner Tutorial', 'A complete introduction to React.js for beginners.', 'Web Development', ARRAY['react','javascript','tutorial','beginner'], 'Code Academy', 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 'approved', 15420),
('Tn6-PIqc4UM', 'JavaScript Full Course for Beginners', 'Learn JavaScript from scratch. Variables, functions, DOM, async/await.', 'Programming', ARRAY['javascript','programming','beginner','course'], 'Bro Code', 'https://img.youtube.com/vi/Tn6-PIqc4UM/hqdefault.jpg', 'approved', 28340),
('kqtD5dpn9C8', 'Python Full Course for Beginners 2024', 'Complete Python tutorial covering basics to advanced concepts.', 'Programming', ARRAY['python','programming','tutorial','beginner'], 'Programming with Mosh', 'https://img.youtube.com/vi/kqtD5dpn9C8/hqdefault.jpg', 'approved', 45120),
('CvUiKWv2-C0', 'Next.js 14 Full Course - Build & Deploy a Full Stack App', 'Build a full-stack app with Next.js 14 App Router.', 'Web Development', ARRAY['nextjs','react','fullstack','tutorial'], 'JavaScript Mastery', 'https://img.youtube.com/vi/CvUiKWv2-C0/hqdefault.jpg', 'approved', 32100),
('pTFZrS8GHKA', 'Data Structures and Algorithms Full Course', 'Complete DSA course covering arrays, linked lists, trees, graphs.', 'DSA', ARRAY['dsa','algorithms','data structures','coding interview'], 'freeCodeCamp', 'https://img.youtube.com/vi/pTFZrS8GHKA/hqdefault.jpg', 'approved', 67800),
('HVjjoMvutma', 'Machine Learning Full Course for Beginners', 'Introduction to machine learning with Python.', 'Machine Learning', ARRAY['machine learning','python','AI','data science'], 'Tech With Tim', 'https://img.youtube.com/vi/HVjjoMvutma/hqdefault.jpg', 'approved', 21500),
('WnBfGz2f3XE', 'SQL Tutorial - Full Database Course for Beginners', 'Learn SQL from scratch. SELECT, JOIN, GROUP BY.', 'Data Science', ARRAY['sql','database','tutorial','beginner'], 'freeCodeCamp', 'https://img.youtube.com/vi/WnBfGz2f3XE/hqdefault.jpg', 'approved', 38900),
('l0JoIMDSEvg', 'Git and GitHub for Beginners - Crash Course', 'Learn Git version control and GitHub collaboration.', 'DevOps', ARRAY['git','github','version control','tutorial'], 'freeCodeCamp', 'https://img.youtube.com/vi/l0JoIMDSEvg/hqdefault.jpg', 'approved', 19200),
('3PHXvlpOkf4', 'TypeScript Full Course for Beginners', 'Learn TypeScript from basics to advanced.', 'Programming', ARRAY['typescript','javascript','tutorial','programming'], 'Academind', 'https://img.youtube.com/vi/3PHXvlpOkf4/hqdefault.jpg', 'approved', 24600),
('YS4e4q9oBaU', 'How do computers read code?', 'An illustrated guide to how programming languages work.', 'Science', ARRAY['computer science','compilers','explained','education'], 'Art of the Problem', 'https://img.youtube.com/vi/YS4e4q9oBaU/hqdefault.jpg', 'approved', 12800),
('umepbfKp5rI', 'System Design Interview – Step By Step Guide', 'Learn system design interview concepts.', 'System Design', ARRAY['system design','interview','architecture','scalability'], 'ByteByteGo', 'https://img.youtube.com/vi/umepbfKp5rI/hqdefault.jpg', 'approved', 41200),
('fis26HvvDII', 'Tailwind CSS Full Course for Beginners 2024', 'Complete Tailwind CSS tutorial.', 'Design', ARRAY['tailwind','css','design','tutorial'], 'Net Ninja', 'https://img.youtube.com/vi/fis26HvvDII/hqdefault.jpg', 'approved', 17300)
ON CONFLICT (youtube_id) DO NOTHING;


-- ======================== SAMPLE CODING PROBLEMS ========================
INSERT INTO coding_problems (title, slug, description, difficulty, category, type, tags, order_index, points, starter_code, test_cases, examples, constraints) VALUES
('Two Sum','two-sum',E'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.','Easy','DSA','code',ARRAY['arrays','hash-table','two-pointers'],1,10,'{"javascript":"function twoSum(nums, target) {\n  // Your code here\n}","python":"def two_sum(nums, target):\n    # Your code here\n    pass","java":"class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Your code here\n        return new int[]{};\n    }\n}"}'::jsonb,'[{"input":"[2,7,11,15], 9","expectedOutput":"[0,1]"},{"input":"[3,2,4], 6","expectedOutput":"[1,2]"},{"input":"[3,3], 6","expectedOutput":"[0,1]"}]'::jsonb,'[{"input":"nums = [2,7,11,15], target = 9","output":"[0,1]","explanation":"Because nums[0] + nums[1] == 9, we return [0, 1]."}]'::jsonb,ARRAY['2 <= nums.length <= 10^4','-10^9 <= nums[i] <= 10^9','-10^9 <= target <= 10^9','Only one valid answer exists.']),
('Valid Parentheses','valid-parentheses',E'Given a string `s` containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.','Easy','DSA','code',ARRAY['stack','strings'],2,10,'{"javascript":"function isValid(s) {\n  // Your code here\n}","python":"def is_valid(s):\n    # Your code here\n    pass","java":"class Solution {\n    public boolean isValid(String s) {\n        // Your code here\n        return false;\n    }\n}"}'::jsonb,'[{"input":"\"()\"","expectedOutput":"true"},{"input":"\"()[]{}\"","expectedOutput":"true"},{"input":"\"(]\"","expectedOutput":"false"}]'::jsonb,'[{"input":"s = \"()\"","output":"true"},{"input":"s = \"([)]\"","output":"false"}]'::jsonb,ARRAY['1 <= s.length <= 10^4','s consists of parentheses only']),
('Palindrome Number','palindrome-number',E'Given an integer `x`, return `true` if `x` is a palindrome, and `false` otherwise.\n\nAn integer is a palindrome when it reads the same forward and backward.','Easy','DSA','code',ARRAY['math','basics'],3,10,'{"javascript":"function isPalindrome(x) {\n  // Your code here\n}","python":"def is_palindrome(x):\n    # Your code here\n    pass"}'::jsonb,'[{"input":"121","expectedOutput":"true"},{"input":"-121","expectedOutput":"false"},{"input":"10","expectedOutput":"false"}]'::jsonb,'[{"input":"x = 121","output":"true","explanation":"121 reads as 121 from left to right and from right to left."}]'::jsonb,ARRAY['-2^31 <= x <= 2^31 - 1']),
('Reverse String','reverse-string',E'Write a function that reverses a string. The input string is given as an array of characters.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.','Easy','DSA','code',ARRAY['strings','two-pointers'],4,10,'{"javascript":"function reverseString(s) {\n  // Your code here\n}","python":"def reverse_string(s):\n    # Your code here\n    pass"}'::jsonb,'[{"input":"[\"h\",\"e\",\"l\",\"l\",\"o\"]","expectedOutput":"[\"o\",\"l\",\"l\",\"e\",\"h\"]"},{"input":"[\"H\",\"a\",\"n\",\"n\",\"a\",\"h\"]","expectedOutput":"[\"h\",\"a\",\"n\",\"n\",\"a\",\"H\"]"}]'::jsonb,'[{"input":"s = [\"h\",\"e\",\"l\",\"l\",\"o\"]","output":"[\"o\",\"l\",\"l\",\"e\",\"h\"]"}]'::jsonb,ARRAY['1 <= s.length <= 10^5','s[i] is a printable ascii character']),
('FizzBuzz','fizzbuzz',E'Given an integer `n`, return a string array where:\n- answer[i] == \"FizzBuzz\" if i is divisible by 3 and 5\n- answer[i] == \"Fizz\" if i is divisible by 3\n- answer[i] == \"Buzz\" if i is divisible by 5\n- answer[i] == i (as a string) otherwise','Easy','DSA','code',ARRAY['math','simulation'],5,10,'{"javascript":"function fizzBuzz(n) {\n  // Your code here\n}","python":"def fizz_buzz(n):\n    # Your code here\n    pass"}'::jsonb,'[{"input":"3","expectedOutput":"[\"1\",\"2\",\"Fizz\"]"},{"input":"5","expectedOutput":"[\"1\",\"2\",\"Fizz\",\"4\",\"Buzz\"]"},{"input":"15","expectedOutput":"[\"1\",\"2\",\"Fizz\",\"4\",\"Buzz\",\"Fizz\",\"7\",\"8\",\"Fizz\",\"Buzz\",\"11\",\"Fizz\",\"13\",\"14\",\"FizzBuzz\"]"}]'::jsonb,'[{"input":"n = 3","output":"[\"1\",\"2\",\"Fizz\"]"}]'::jsonb,ARRAY['1 <= n <= 10^4']),
('Maximum Subarray','maximum-subarray',E'Given an integer array `nums`, find the subarray with the largest sum, and return its sum.\n\nA subarray is a contiguous non-empty sequence of elements within an array.','Medium','DSA','code',ARRAY['arrays','dynamic-programming','divide-and-conquer'],6,25,'{"javascript":"function maxSubArray(nums) {\n  // Your code here\n}","python":"def max_sub_array(nums):\n    # Your code here\n    pass"}'::jsonb,'[{"input":"[-2,1,-3,4,-1,2,1,-5,4]","expectedOutput":"6"},{"input":"[1]","expectedOutput":"1"},{"input":"[5,4,-1,7,8]","expectedOutput":"23"}]'::jsonb,'[{"input":"nums = [-2,1,-3,4,-1,2,1,-5,4]","output":"6","explanation":"The subarray [4,-1,2,1] has the largest sum 6."}]'::jsonb,ARRAY['1 <= nums.length <= 10^5','-10^4 <= nums[i] <= 10^4']),
('Merge Two Sorted Lists','merge-two-sorted-lists',E'You are given the heads of two sorted linked lists `list1` and `list2`.\n\nMerge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists.\n\nReturn the head of the merged linked list.','Medium','DSA','code',ARRAY['linked-list','recursion'],7,25,'{"javascript":"function mergeTwoLists(list1, list2) {\n  // Your code here\n}","python":"def merge_two_lists(list1, list2):\n    # Your code here\n    pass","java":"class Solution {\n    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {\n        // Your code here\n        return null;\n    }\n}"}'::jsonb,'[{"input":"[1,2,4] [1,3,4]","expectedOutput":"[1,1,2,3,4,4]"},{"input":"[] []","expectedOutput":"[]"}]'::jsonb,'[{"input":"list1 = [1,2,4], list2 = [1,3,4]","output":"[1,1,2,3,4,4]"}]'::jsonb,ARRAY['The number of nodes in both lists is in [0,50]','-100 <= Node.val <= 100']),
('Binary Search','binary-search',E'Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search `target` in `nums`. If `target` exists, return its index. Otherwise, return `-1`.\n\nYou must write an algorithm with O(log n) runtime complexity.','Easy','DSA','code',ARRAY['binary-search','arrays'],8,10,'{"javascript":"function search(nums, target) {\n  // Your code here\n}","python":"def search(nums, target):\n    # Your code here\n    pass","java":"class Solution {\n    public int search(int[] nums, int target) {\n        // Your code here\n        return -1;\n    }\n}"}'::jsonb,'[{"input":"[-1,0,3,5,9,12], 9","expectedOutput":"4"},{"input":"[-1,0,3,5,9,12], 2","expectedOutput":"-1"}]'::jsonb,'[{"input":"nums = [-1,0,3,5,9,12], target = 9","output":"4","explanation":"9 exists in nums and its index is 4"}]'::jsonb,ARRAY['1 <= nums.length <= 10^4','-10^4 < nums[i], target < 10^4','All integers in nums are unique','nums is sorted in ascending order']),
('Longest Common Subsequence','longest-common-subsequence',E'Given two strings `text1` and `text2`, return the length of their longest common subsequence. If there is no common subsequence, return `0`.\n\nA subsequence of a string is a new string generated from the original string with some characters (can be none) deleted without changing the relative order of the remaining characters.','Hard','DSA','code',ARRAY['dynamic-programming','strings'],9,50,'{"javascript":"function longestCommonSubsequence(text1, text2) {\n  // Your code here\n}","python":"def longest_common_subsequence(text1, text2):\n    # Your code here\n    pass","java":"class Solution {\n    public int longestCommonSubsequence(String text1, String text2) {\n        // Your code here\n        return 0;\n    }\n}"}'::jsonb,'[{"input":"\"abcde\", \"ace\"","expectedOutput":"3"},{"input":"\"abc\", \"abc\"","expectedOutput":"3"},{"input":"\"abc\", \"def\"","expectedOutput":"0"}]'::jsonb,'[{"input":"text1 = \"abcde\", text2 = \"ace\"","output":"3","explanation":"The longest common subsequence is \"ace\" and its length is 3."}]'::jsonb,ARRAY['1 <= text1.length, text2.length <= 1000','text1 and text2 consist of only lowercase English characters']),
('List Comprehension Filter','python-list-comprehension',E'Write a Python function that takes a list of integers and returns a new list containing only the even numbers, squared.\n\nUse list comprehension to solve this in a single line.\n\n**Example:**\n```python\nfilter_and_square([1, 2, 3, 4, 5, 6])\n# Returns: [4, 16, 36]\n```','Easy','Python','code',ARRAY['list-comprehension','basics','python-fundamentals'],10,10,'{"python":"def filter_and_square(nums):\n    # Use list comprehension\n    pass"}'::jsonb,'[{"input":"[1,2,3,4,5,6]","expectedOutput":"[4,16,36]"},{"input":"[1,3,5]","expectedOutput":"[]"},{"input":"[2,4,6]","expectedOutput":"[4,16,36]"}]'::jsonb,'[{"input":"[1,2,3,4,5,6]","output":"[4,16,36]","explanation":"Even numbers: 2,4,6. Squared: 4,16,36"}]'::jsonb,ARRAY['List will contain integers only','0 <= len(nums) <= 1000']),
('Dictionary Merge','python-dict-merge',E'Write a Python function that takes two dictionaries and merges them. If a key exists in both, the values should be summed.\n\n**Example:**\n```python\nmerge_dicts({''a'': 1, ''b'': 2}, {''b'': 3, ''c'': 4})\n# Returns: {''a'': 1, ''b'': 5, ''c'': 4}\n```','Medium','Python','code',ARRAY['dictionaries','data-structures','python-fundamentals'],11,25,'{"python":"def merge_dicts(dict1, dict2):\n    # Your code here\n    pass"}'::jsonb,'[{"input":"{\"a\":1,\"b\":2}, {\"b\":3,\"c\":4}","expectedOutput":"{\"a\":1,\"b\":5,\"c\":4}"}]'::jsonb,'[{"input":"{''a'': 1, ''b'': 2}, {''b'': 3, ''c'': 4}","output":"{''a'': 1, ''b'': 5, ''c'': 4}"}]'::jsonb,ARRAY['Dictionary values are integers','Keys are strings']),
('Reverse a String in Java','java-reverse-string',E'Write a Java method that reverses a given string without using the built-in `reverse()` method.\n\n**Example:**\n```java\nreverseString("hello") → "olleh"\nreverseString("Java") → "avaJ"\n```','Easy','Java','code',ARRAY['strings','java-basics'],20,10,'{"java":"public class Solution {\n    public static String reverseString(String s) {\n        // Your code here\n        return \"\";\n    }\n}"}'::jsonb,'[{"input":"\"hello\"","expectedOutput":"\"olleh\""},{"input":"\"Java\"","expectedOutput":"\"avaJ\""},{"input":"\"\"","expectedOutput":"\"\""}]'::jsonb,'[{"input":"\"hello\"","output":"\"olleh\""}]'::jsonb,ARRAY['0 <= s.length <= 10^5','s consists of printable ASCII characters']),
('Singleton Pattern','java-singleton-pattern',E'Implement the Singleton design pattern in Java. The class should:\n\n1. Have a private constructor\n2. Have a static method `getInstance()` that returns the single instance\n3. Be thread-safe\n4. Have a `getValue()` and `setValue(int)` method','Medium','Java','code',ARRAY['design-patterns','oop','java-advanced'],21,25,'{"java":"public class Singleton {\n    // Implement singleton pattern here\n    \n    public int getValue() {\n        return 0;\n    }\n    \n    public void setValue(int value) {\n        // Your code here\n    }\n}"}'::jsonb,'[{"input":"getInstance() == getInstance()","expectedOutput":"true"}]'::jsonb,'[{"input":"getInstance()","output":"Same instance returned every time"}]'::jsonb,ARRAY['Must be thread-safe','Lazy initialization preferred']),
('Select All Employees','sql-select-employees',E'Write a SQL query to select all employees from the `employees` table who earn more than 50000.\n\n**Table: employees**\n| id | name | salary | department |\n|-------|-----------|--------|------------|\n| 1 | Alice | 75000 | Engineering |\n| 2 | Bob | 45000 | Marketing |\n| 3 | Charlie | 60000 | Engineering |\n| 4 | Diana | 55000 | HR |\n\nReturn columns: `name`, `salary`, `department`\nOrder by salary descending.','Easy','SQL','sql',ARRAY['select','where','order-by'],30,10,'{"sql":"-- Write your SQL query here\nSELECT "}'::jsonb,'[{"input":"employees table","expectedOutput":"Alice,75000,Engineering; Charlie,60000,Engineering; Diana,55000,HR"}]'::jsonb,'[{"input":"SELECT from employees WHERE salary > 50000","output":"3 rows returned"}]'::jsonb,ARRAY['Use standard SQL syntax','Order by salary DESC']),
('Join and Group By','sql-join-group-by',E'Write a SQL query to find the average salary per department.\n\n**Table: employees**\n| id | name | salary | department_id |\n\n**Table: departments**\n| id | name |\n\nReturn: `department_name`, `avg_salary` (rounded to 2 decimal places)\nOrder by `avg_salary` DESC.','Medium','SQL','sql',ARRAY['join','group-by','aggregate'],31,25,'{"sql":"-- Write your SQL query here\nSELECT "}'::jsonb,'[{"input":"employees + departments tables","expectedOutput":"department_name, avg_salary"}]'::jsonb,'[{"input":"JOIN + GROUP BY","output":"Average salary per department"}]'::jsonb,ARRAY['Use INNER JOIN','Round to 2 decimal places','Order by avg_salary DESC']),
('Build a Responsive Card Component','webdev-responsive-card',E'Create a responsive card component using HTML and CSS that:\n\n1. Has a header image area (200px height)\n2. Has a title, description, and a "Read More" button\n3. Uses flexbox for layout\n4. Is responsive: 3 columns on desktop, 2 on tablet, 1 on mobile\n5. Has hover effect with subtle shadow','Easy','WebDev','project',ARRAY['html','css','responsive','flexbox'],40,15,'{"javascript":"<!-- Write your HTML here -->\n<div class=\"card\">\n  <!-- Your card structure -->\n</div>\n\n<style>\n  /* Your CSS here */\n</style>"}'::jsonb,'[{"input":"Visual inspection","expectedOutput":"Responsive card with image, title, description, button"}]'::jsonb,'[{"input":"Responsive card","output":"Displays correctly on all screen sizes"}]'::jsonb,ARRAY['Use semantic HTML','Mobile-first approach','No JavaScript required']),
('React Counter with Hooks','webdev-react-counter',E'Build a React counter component using hooks that:\n\n1. Displays the current count\n2. Has Increment (+1), Decrement (-1), and Reset buttons\n3. Count cannot go below 0\n4. Changes color to red when count > 10\n5. Uses `useState` hook','Easy','WebDev','code',ARRAY['react','hooks','useState','components'],41,10,'{"javascript":"import { useState } from ''react'';\n\nexport default function Counter() {\n  // Your code here\n  \n  return (\n    <div>\n      {/* Your JSX here */}\n    </div>\n  );\n}"}'::jsonb,'[{"input":"Increment 3 times","expectedOutput":"Count: 3"},{"input":"Decrement below 0","expectedOutput":"Count: 0"}]'::jsonb,'[{"input":"Click increment","output":"Count increases by 1"}]'::jsonb,ARRAY['Use functional components','Use useState hook','Count minimum is 0']),
('Python Data Types Quiz','python-data-types-mcq',E'What is the output of the following Python code?\n\n```python\nx = [1, 2, 3]\ny = x\ny.append(4)\nprint(len(x))\n```','Easy','Python','mcq',ARRAY['python-basics','data-types','references'],50,5,'{}'::jsonb,'[]'::jsonb,'[]'::jsonb,ARRAY['Choose the correct answer']),
('JavaScript Closures Quiz','javascript-closures-mcq',E'What will be logged to the console?\n\n```javascript\nfor (var i = 0; i < 3; i++) {\n  setTimeout(function() {\n    console.log(i);\n  }, 100);\n}\n```','Medium','DSA','mcq',ARRAY['closures','javascript','scope'],51,5,'{}'::jsonb,'[]'::jsonb,'[]'::jsonb,ARRAY['Choose the correct answer'])
ON CONFLICT (slug) DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description, difficulty=EXCLUDED.difficulty,
  category=EXCLUDED.category, type=EXCLUDED.type, tags=EXCLUDED.tags,
  order_index=EXCLUDED.order_index, points=EXCLUDED.points, starter_code=EXCLUDED.starter_code,
  test_cases=EXCLUDED.test_cases, examples=EXCLUDED.examples, constraints=EXCLUDED.constraints;

-- MCQ answers
UPDATE coding_problems SET mcq_options='["3","4","Error","None"]'::jsonb, correct_answer='4' WHERE slug='python-data-types-mcq';
UPDATE coding_problems SET mcq_options='["0, 1, 2","3, 3, 3","undefined, undefined, undefined","0, 0, 0"]'::jsonb, correct_answer='3, 3, 3' WHERE slug='javascript-closures-mcq';
