// ============================================================
// Application-wide constants
// ============================================================

export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

export const VIDEO = {
  REPORT_THRESHOLD: 10,
  STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    UNPUBLISHED: 'unpublished',
  },
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 50,
};

export const CODING = {
  DIFFICULTY: { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' },
  LANGUAGES: [
    { id: 'javascript', name: 'JavaScript' },
    { id: 'python', name: 'Python' },
    { id: 'java', name: 'Java' },
    { id: 'cpp', name: 'C++' },
    { id: 'c', name: 'C' },
  ],
  SUBMISSION_STATUS: {
    PENDING: 'pending',
    RUNNING: 'running',
    ACCEPTED: 'accepted',
    WRONG_ANSWER: 'wrong_answer',
    TIME_LIMIT: 'time_limit_exceeded',
    RUNTIME_ERROR: 'runtime_error',
    COMPILATION_ERROR: 'compilation_error',
  },
  CONTEST_STATUS: { UPCOMING: 'upcoming', LIVE: 'live', ENDED: 'ended' },
  DEFAULT_PAGE_SIZE: 20,
};

export const BADGES = {
  FIRST_SOLVE:   { id: 'first_solve',   name: 'First Blood',      description: 'Solved your first coding problem', icon: '🎯' },
  STREAK_7:      { id: 'streak_7',      name: 'Week Warrior',     description: '7-day streak maintained',          icon: '🔥' },
  STREAK_30:     { id: 'streak_30',     name: 'Monthly Master',   description: '30-day streak maintained',         icon: '💎' },
  STREAK_100:    { id: 'streak_100',    name: 'Centurion',        description: '100-day streak maintained',        icon: '👑' },
  PROBLEMS_10:   { id: 'problems_10',   name: 'Problem Solver',   description: 'Solved 10 coding problems',       icon: '⚡' },
  PROBLEMS_50:   { id: 'problems_50',   name: 'Code Ninja',       description: 'Solved 50 coding problems',       icon: '🥷' },
  PROBLEMS_100:  { id: 'problems_100',  name: 'Algorithm King',   description: 'Solved 100 coding problems',      icon: '🏆' },
  CONTEST_WIN:   { id: 'contest_win',   name: 'Champion',         description: 'Won a coding contest',            icon: '🏅' },
  CONTEST_TOP10: { id: 'contest_top10', name: 'Elite Coder',      description: 'Finished in top 10 of a contest', icon: '🌟' },
  HELPFUL_REPORTER: { id: 'helpful_reporter', name: 'Guardian',   description: 'Reported 5 non-educational videos', icon: '🛡️' },
};

export const ALL_BADGES = Object.values(BADGES);
BADGES.ALL = ALL_BADGES;

export const CATEGORIES = [
  'All', 'Programming', 'Web Development', 'Data Science',
  'Machine Learning', 'Mathematics', 'Science', 'DSA',
  'System Design', 'DevOps', 'Design', 'Business',
];
