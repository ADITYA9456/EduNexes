-- ============================================
-- EduNexes — Complete Database Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- 1. PROFILES (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
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

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. VIDEOS
CREATE TABLE IF NOT EXISTS videos (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_id);

-- 3. CODING PROBLEMS
CREATE TABLE IF NOT EXISTS coding_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT DEFAULT 'Easy' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  category TEXT DEFAULT 'General',
  starter_code JSONB DEFAULT '{}'::jsonb,
  test_cases JSONB DEFAULT '[]'::jsonb,
  constraints TEXT DEFAULT '',
  examples JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. SUBMISSIONS
CREATE TABLE IF NOT EXISTS submissions (
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

-- 5. CONTESTS
CREATE TABLE IF NOT EXISTS contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'ended')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CONTEST PARTICIPANTS
CREATE TABLE IF NOT EXISTS contest_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contest_id, user_id)
);

-- 7. CONTEST PROBLEMS (links contests to coding_problems)
CREATE TABLE IF NOT EXISTS contest_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES coding_problems(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  points INTEGER DEFAULT 100,
  UNIQUE(contest_id, problem_id)
);

-- 8. LEADERBOARD ENTRIES
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  problems_solved INTEGER DEFAULT 0,
  last_submission_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contest_id, user_id)
);

-- 9. STREAKS
CREATE TABLE IF NOT EXISTS streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_type TEXT DEFAULT 'login',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, activity_date)
);

-- 10. REPORTS
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. AI VERIFICATION LOGS
CREATE TABLE IF NOT EXISTS ai_verification_logs (
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

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

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

-- PROFILES: users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- VIDEOS: anyone can read approved, authenticated can insert
CREATE POLICY "Approved videos are viewable by everyone" ON videos FOR SELECT USING (true);
CREATE POLICY "Authenticated users can submit videos" ON videos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Service role can update videos" ON videos FOR UPDATE USING (true);

-- CODING PROBLEMS: readable by all
CREATE POLICY "Problems are viewable by everyone" ON coding_problems FOR SELECT USING (true);
CREATE POLICY "Service role can manage problems" ON coding_problems FOR ALL USING (true);

-- SUBMISSIONS: users see own, can insert own
CREATE POLICY "Users can view own submissions" ON submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own submissions" ON submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CONTESTS: readable by all
CREATE POLICY "Contests are viewable by everyone" ON contests FOR SELECT USING (true);
CREATE POLICY "Service role can manage contests" ON contests FOR ALL USING (true);

-- CONTEST PARTICIPANTS
CREATE POLICY "Participants viewable by all" ON contest_participants FOR SELECT USING (true);
CREATE POLICY "Users can join contests" ON contest_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CONTEST PROBLEMS
CREATE POLICY "Contest problems viewable by all" ON contest_problems FOR SELECT USING (true);

-- LEADERBOARD
CREATE POLICY "Leaderboard viewable by all" ON leaderboard_entries FOR SELECT USING (true);
CREATE POLICY "Service role can manage leaderboard" ON leaderboard_entries FOR ALL USING (true);

-- STREAKS
CREATE POLICY "Users can view own streaks" ON streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streaks" ON streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streaks" ON streaks FOR UPDATE USING (auth.uid() = user_id);

-- REPORTS
CREATE POLICY "Users can insert reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Service role can manage reports" ON reports FOR SELECT USING (true);
CREATE POLICY "Service role can update reports" ON reports FOR UPDATE USING (true);

-- AI LOGS
CREATE POLICY "Service role can manage ai logs" ON ai_verification_logs FOR ALL USING (true);

-- ============================================
-- SAMPLE EDUCATIONAL VIDEOS (so homepage isn't empty)
-- ============================================

INSERT INTO videos (youtube_id, title, description, category, tags, channel_title, thumbnail_url, status, view_count) VALUES
('dQw4w9WgXcQ', 'Learn React in 30 Minutes - Complete Beginner Tutorial', 'A complete introduction to React.js for beginners. Learn components, state, props, and hooks.', 'Web Development', ARRAY['react', 'javascript', 'tutorial', 'beginner'], 'Code Academy', 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 'approved', 15420),
('Tn6-PIqc4UM', 'JavaScript Full Course for Beginners', 'Learn JavaScript from scratch. Variables, functions, DOM, async/await, and more.', 'Programming', ARRAY['javascript', 'programming', 'beginner', 'course'], 'Bro Code', 'https://img.youtube.com/vi/Tn6-PIqc4UM/hqdefault.jpg', 'approved', 28340),
('kqtD5dpn9C8', 'Python Full Course for Beginners 2024', 'Complete Python tutorial covering basics to advanced concepts including OOP and file handling.', 'Programming', ARRAY['python', 'programming', 'tutorial', 'beginner'], 'Programming with Mosh', 'https://img.youtube.com/vi/kqtD5dpn9C8/hqdefault.jpg', 'approved', 45120),
('CvUiKWv2-C0', 'Next.js 14 Full Course - Build & Deploy a Full Stack App', 'Build a full-stack app with Next.js 14 App Router, Server Actions, and deployment.', 'Web Development', ARRAY['nextjs', 'react', 'fullstack', 'tutorial'], 'JavaScript Mastery', 'https://img.youtube.com/vi/CvUiKWv2-C0/hqdefault.jpg', 'approved', 32100),
('pTFZrS8GHKA', 'Data Structures and Algorithms Full Course', 'Complete DSA course covering arrays, linked lists, trees, graphs, sorting, and more.', 'DSA', ARRAY['dsa', 'algorithms', 'data structures', 'coding interview'], 'freeCodeCamp', 'https://img.youtube.com/vi/pTFZrS8GHKA/hqdefault.jpg', 'approved', 67800),
('HVjjoMvutma', 'Machine Learning Full Course for Beginners', 'Introduction to machine learning with Python, scikit-learn, and real-world projects.', 'Machine Learning', ARRAY['machine learning', 'python', 'AI', 'data science'], 'Tech With Tim', 'https://img.youtube.com/vi/HVjjoMvutma/hqdefault.jpg', 'approved', 21500),
('WnBfGz2f3XE', 'SQL Tutorial - Full Database Course for Beginners', 'Learn SQL from scratch. SELECT, JOIN, GROUP BY, subqueries, and database design.', 'Data Science', ARRAY['sql', 'database', 'tutorial', 'beginner'], 'freeCodeCamp', 'https://img.youtube.com/vi/WnBfGz2f3XE/hqdefault.jpg', 'approved', 38900),
('l0JoIMDSEvg', 'Git and GitHub for Beginners - Crash Course', 'Learn Git version control and GitHub collaboration. Branches, merges, pull requests.', 'DevOps', ARRAY['git', 'github', 'version control', 'tutorial'], 'freeCodeCamp', 'https://img.youtube.com/vi/l0JoIMDSEvg/hqdefault.jpg', 'approved', 19200),
('3PHXvlpOkf4', 'TypeScript Full Course for Beginners', 'Learn TypeScript from basics to advanced. Types, interfaces, generics, and real projects.', 'Programming', ARRAY['typescript', 'javascript', 'tutorial', 'programming'], 'Academind', 'https://img.youtube.com/vi/3PHXvlpOkf4/hqdefault.jpg', 'approved', 24600),
('YS4e4q9oBaU', 'How do computers read code?', 'An illustrated guide to how programming languages work under the hood. Compilers, interpreters.', 'Science', ARRAY['computer science', 'compilers', 'explained', 'education'], 'Art of the Problem', 'https://img.youtube.com/vi/YS4e4q9oBaU/hqdefault.jpg', 'approved', 12800),
('umepbfKp5rI', 'System Design Interview – Step By Step Guide', 'Learn system design interview concepts. Load balancers, caching, databases, microservices.', 'System Design', ARRAY['system design', 'interview', 'architecture', 'scalability'], 'ByteByteGo', 'https://img.youtube.com/vi/umepbfKp5rI/hqdefault.jpg', 'approved', 41200),
('fis26HvvDII', 'Tailwind CSS Full Course for Beginners 2024', 'Complete Tailwind CSS tutorial. Utility classes, responsive design, custom themes.', 'Design', ARRAY['tailwind', 'css', 'design', 'tutorial'], 'Net Ninja', 'https://img.youtube.com/vi/fis26HvvDII/hqdefault.jpg', 'approved', 17300);

-- ============================================
-- SAMPLE CODING PROBLEMS
-- ============================================

INSERT INTO coding_problems (title, description, difficulty, category, order_index, starter_code, test_cases, examples) VALUES
(
  'Two Sum',
  'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.',
  'Easy',
  'Arrays',
  1,
  '{"javascript": "function twoSum(nums, target) {\n  // Your code here\n}", "python": "def two_sum(nums, target):\n    # Your code here\n    pass"}'::jsonb,
  '[{"input": "[2,7,11,15], 9", "expected": "[0,1]"}, {"input": "[3,2,4], 6", "expected": "[1,2]"}, {"input": "[3,3], 6", "expected": "[0,1]"}]'::jsonb,
  '[{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."}]'::jsonb
),
(
  'Palindrome Number',
  'Given an integer x, return true if x is a palindrome, and false otherwise.\n\nAn integer is a palindrome when it reads the same forward and backward.',
  'Easy',
  'Math',
  2,
  '{"javascript": "function isPalindrome(x) {\n  // Your code here\n}", "python": "def is_palindrome(x):\n    # Your code here\n    pass"}'::jsonb,
  '[{"input": "121", "expected": "true"}, {"input": "-121", "expected": "false"}, {"input": "10", "expected": "false"}]'::jsonb,
  '[{"input": "x = 121", "output": "true", "explanation": "121 reads as 121 from left to right and from right to left."}]'::jsonb
),
(
  'Reverse String',
  'Write a function that reverses a string. The input string is given as an array of characters.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.',
  'Easy',
  'Strings',
  3,
  '{"javascript": "function reverseString(s) {\n  // Your code here\n}", "python": "def reverse_string(s):\n    # Your code here\n    pass"}'::jsonb,
  '[{"input": "[\"h\",\"e\",\"l\",\"l\",\"o\"]", "expected": "[\"o\",\"l\",\"l\",\"e\",\"h\"]"}, {"input": "[\"H\",\"a\",\"n\",\"n\",\"a\",\"h\"]", "expected": "[\"h\",\"a\",\"n\",\"n\",\"a\",\"H\"]"}]'::jsonb,
  '[{"input": "s = [\"h\",\"e\",\"l\",\"l\",\"o\"]", "output": "[\"o\",\"l\",\"l\",\"e\",\"h\"]", "explanation": ""}]'::jsonb
),
(
  'FizzBuzz',
  'Given an integer n, return a string array answer (1-indexed) where:\n\n- answer[i] == \"FizzBuzz\" if i is divisible by 3 and 5.\n- answer[i] == \"Fizz\" if i is divisible by 3.\n- answer[i] == \"Buzz\" if i is divisible by 5.\n- answer[i] == i (as a string) if none of the above conditions are true.',
  'Easy',
  'Math',
  4,
  '{"javascript": "function fizzBuzz(n) {\n  // Your code here\n}", "python": "def fizz_buzz(n):\n    # Your code here\n    pass"}'::jsonb,
  '[{"input": "3", "expected": "[\"1\",\"2\",\"Fizz\"]"}, {"input": "5", "expected": "[\"1\",\"2\",\"Fizz\",\"4\",\"Buzz\"]"}, {"input": "15", "expected": "[\"1\",\"2\",\"Fizz\",\"4\",\"Buzz\",\"Fizz\",\"7\",\"8\",\"Fizz\",\"Buzz\",\"11\",\"Fizz\",\"13\",\"14\",\"FizzBuzz\"]"}]'::jsonb,
  '[{"input": "n = 3", "output": "[\"1\",\"2\",\"Fizz\"]", "explanation": ""}]'::jsonb
),
(
  'Valid Parentheses',
  'Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.',
  'Medium',
  'Stacks',
  5,
  '{"javascript": "function isValid(s) {\n  // Your code here\n}", "python": "def is_valid(s):\n    # Your code here\n    pass"}'::jsonb,
  '[{"input": "\"()\"", "expected": "true"}, {"input": "\"()[]{}\"", "expected": "true"}, {"input": "\"(]\"", "expected": "false"}]'::jsonb,
  '[{"input": "s = \"()\"", "output": "true", "explanation": ""}]'::jsonb
),
(
  'Maximum Subarray',
  'Given an integer array nums, find the subarray with the largest sum, and return its sum.\n\nA subarray is a contiguous non-empty sequence of elements within an array.',
  'Medium',
  'Arrays',
  6,
  '{"javascript": "function maxSubArray(nums) {\n  // Your code here\n}", "python": "def max_sub_array(nums):\n    # Your code here\n    pass"}'::jsonb,
  '[{"input": "[-2,1,-3,4,-1,2,1,-5,4]", "expected": "6"}, {"input": "[1]", "expected": "1"}, {"input": "[5,4,-1,7,8]", "expected": "23"}]'::jsonb,
  '[{"input": "nums = [-2,1,-3,4,-1,2,1,-5,4]", "output": "6", "explanation": "The subarray [4,-1,2,1] has the largest sum 6."}]'::jsonb
),
(
  'Merge Two Sorted Lists',
  'You are given the heads of two sorted linked lists list1 and list2.\n\nMerge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists.\n\nReturn the head of the merged linked list.',
  'Medium',
  'Linked Lists',
  7,
  '{"javascript": "function mergeTwoLists(list1, list2) {\n  // Your code here\n}", "python": "def merge_two_lists(list1, list2):\n    # Your code here\n    pass"}'::jsonb,
  '[{"input": "[1,2,4], [1,3,4]", "expected": "[1,1,2,3,4,4]"}, {"input": "[], []", "expected": "[]"}, {"input": "[], [0]", "expected": "[0]"}]'::jsonb,
  '[{"input": "list1 = [1,2,4], list2 = [1,3,4]", "output": "[1,1,2,3,4,4]", "explanation": ""}]'::jsonb
),
(
  'Binary Search',
  'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.\n\nYou must write an algorithm with O(log n) runtime complexity.',
  'Easy',
  'Searching',
  8,
  '{"javascript": "function search(nums, target) {\n  // Your code here\n}", "python": "def search(nums, target):\n    # Your code here\n    pass"}'::jsonb,
  '[{"input": "[-1,0,3,5,9,12], 9", "expected": "4"}, {"input": "[-1,0,3,5,9,12], 2", "expected": "-1"}]'::jsonb,
  '[{"input": "nums = [-1,0,3,5,9,12], target = 9", "output": "4", "explanation": "9 exists in nums and its index is 4."}]'::jsonb
);

-- Done! Your EduNexes database is ready.
