// Pick-lists for onboarding. Interest tags use the same words as activity tags,
// so what you pick here feeds the deck ranking and the matcher directly.
import { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export const INTERESTS: { tag: string; label: string; icon: IconName }[] = [
  { tag: 'quiet focus', label: 'Quiet focus', icon: 'headset' },
  { tag: 'library', label: 'Library', icon: 'library' },
  { tag: 'lofi', label: 'Lofi', icon: 'musical-notes' },
  { tag: 'night owl', label: 'Night owl', icon: 'moon' },
  { tag: 'problem solving', label: 'Puzzles', icon: 'extension-puzzle' },
  { tag: 'pair programming', label: 'Pair coding', icon: 'git-branch' },
  { tag: 'boba', label: 'Boba', icon: 'ice-cream' },
  { tag: 'matcha', label: 'Matcha', icon: 'leaf' },
  { tag: 'chill', label: 'Chill', icon: 'cafe' },
  { tag: 'reading', label: 'Reading', icon: 'book' },
  { tag: 'social', label: 'Social', icon: 'people' },
  { tag: 'board games', label: 'Board games', icon: 'dice' },
  { tag: 'trivia', label: 'Trivia', icon: 'help-circle' },
  { tag: 'anime', label: 'Anime', icon: 'tv' },
  { tag: 'art', label: 'Art', icon: 'brush' },
  { tag: 'photography', label: 'Photos', icon: 'camera' },
  { tag: 'language', label: 'Languages', icon: 'chatbubbles' },
  { tag: 'outdoors', label: 'Outdoors', icon: 'sunny' },
  { tag: 'running', label: 'Running', icon: 'walk' },
  { tag: 'gym', label: 'Gym', icon: 'barbell' },
  { tag: 'badminton', label: 'Badminton', icon: 'tennisball' },
  { tag: 'climbing', label: 'Climbing', icon: 'fitness' },
  { tag: 'sport', label: 'Sport', icon: 'football' },
  { tag: 'internships', label: 'Internships', icon: 'briefcase' },
  { tag: 'coding interview', label: 'LeetCode', icon: 'terminal' },
  { tag: 'startups', label: 'Startups', icon: 'bulb' },
  { tag: 'hackathon', label: 'Hackathons', icon: 'rocket' },
  { tag: 'building', label: 'Making things', icon: 'construct' },
  { tag: 'gaming', label: 'Gaming', icon: 'game-controller' },
  { tag: 'music', label: 'Music', icon: 'musical-note' },
  { tag: 'cooking', label: 'Cooking', icon: 'restaurant' },
  { tag: 'volunteering', label: 'Volunteering', icon: 'heart' },
];

// Onboarding shows hobbies in these sections.
export const INTEREST_GROUPS: { label: string; icon: IconName; tags: string[] }[] = [
  { label: 'Study vibe', icon: 'library', tags: ['quiet focus', 'library', 'lofi', 'night owl', 'problem solving', 'pair programming'] },
  { label: 'Food & chill', icon: 'cafe', tags: ['boba', 'matcha', 'chill', 'reading', 'cooking'] },
  { label: 'Social & creative', icon: 'people', tags: ['social', 'board games', 'trivia', 'gaming', 'anime', 'music', 'art', 'photography', 'language'] },
  { label: 'Active', icon: 'fitness', tags: ['outdoors', 'running', 'gym', 'badminton', 'climbing', 'sport'] },
  { label: 'Career & building', icon: 'briefcase', tags: ['internships', 'coding interview', 'startups', 'hackathon', 'building', 'volunteering'] },
];

export const DEGREES: { label: string; short: string; icon: IconName }[] = [
  { label: 'Computer Science', short: 'CS', icon: 'laptop' },
  { label: 'Software Engineering', short: 'SENG', icon: 'code-slash' },
  { label: 'Data Science', short: 'DS', icon: 'analytics' },
  { label: 'Engineering', short: 'ENG', icon: 'construct' },
  { label: 'Commerce', short: 'COMM', icon: 'briefcase' },
  { label: 'Science', short: 'SCI', icon: 'flask' },
  { label: 'Medicine', short: 'MED', icon: 'medkit' },
  { label: 'Law', short: 'LAW', icon: 'document-text' },
  { label: 'Design', short: 'DESN', icon: 'color-palette' },
  { label: 'Arts', short: 'ARTS', icon: 'brush' },
  { label: 'Psychology', short: 'PSYC', icon: 'happy' },
  { label: 'Something else', short: 'Uni', icon: 'school' },
];

// Courses grouped by faculty, then by 4-letter subject prefix. Not exhaustive —
// any valid code (e.g. PHYS1131) can be typed in.
export const FACULTIES: {
  key: string;
  label: string;
  icon: IconName;
  subjects: { prefix: string; label: string; courses: string[] }[];
}[] = [
  {
    key: 'eng', label: 'Engineering', icon: 'construct',
    subjects: [
      { prefix: 'COMP', label: 'Computing', courses: ['COMP1511', 'COMP1521', 'COMP1531', 'COMP2511', 'COMP2521', 'COMP3311', 'COMP3900'] },
      { prefix: 'ENGG', label: 'Engineering', courses: ['ENGG1000', 'ENGG1300', 'ENGG1811'] },
      { prefix: 'DESN', label: 'Design', courses: ['DESN1000', 'DESN2000'] },
    ],
  },
  {
    key: 'sci', label: 'Science', icon: 'flask',
    subjects: [
      { prefix: 'MATH', label: 'Maths', courses: ['MATH1081', 'MATH1131', 'MATH1141', 'MATH1231', 'MATH1241', 'MATH2089'] },
      { prefix: 'PHYS', label: 'Physics', courses: ['PHYS1121', 'PHYS1131'] },
      { prefix: 'CHEM', label: 'Chemistry', courses: ['CHEM1011', 'CHEM1031'] },
      { prefix: 'BABS', label: 'Biotech', courses: ['BABS1201', 'BABS1202'] },
      { prefix: 'PSYC', label: 'Psychology', courses: ['PSYC1001', 'PSYC1011'] },
    ],
  },
  {
    key: 'bus', label: 'Business', icon: 'briefcase',
    subjects: [
      { prefix: 'ECON', label: 'Economics', courses: ['ECON1101', 'ECON1102', 'ECON1203'] },
      { prefix: 'ACCT', label: 'Accounting', courses: ['ACCT1501', 'ACCT1511'] },
      { prefix: 'FINS', label: 'Finance', courses: ['FINS1612', 'FINS1613'] },
      { prefix: 'MGMT', label: 'Management', courses: ['MGMT1001'] },
      { prefix: 'MARK', label: 'Marketing', courses: ['MARK1012'] },
    ],
  },
  {
    key: 'ada', label: 'Arts & Design', icon: 'color-palette',
    subjects: [
      { prefix: 'ARTS', label: 'Arts', courses: ['ARTS1090', 'ARTS1360'] },
      { prefix: 'MDIA', label: 'Media', courses: ['MDIA1002'] },
    ],
  },
  {
    key: 'law', label: 'Law', icon: 'document-text',
    subjects: [{ prefix: 'LAWS', label: 'Law', courses: ['LAWS1052', 'LAWS1061'] }],
  },
  {
    key: 'med', label: 'Medicine & Health', icon: 'medkit',
    subjects: [
      { prefix: 'HESC', label: 'Health science', courses: ['HESC1501'] },
      { prefix: 'PHSL', label: 'Physiology', courses: ['PHSL2101'] },
    ],
  },
];

export const ALL_COURSES = FACULTIES.flatMap((f) => f.subjects.flatMap((s) => s.courses));

// Free-time blocks (Sydney time). Adjacent picks on the same day are merged into one window.
export const TIME_BLOCKS: { key: string; label: string; start: number; end: number; icon: IconName }[] = [
  { key: 'am', label: 'Morning', start: 9, end: 12, icon: 'sunny-outline' },
  { key: 'pm', label: 'Arvo', start: 12, end: 17, icon: 'partly-sunny-outline' },
  { key: 'eve', label: 'Evening', start: 17, end: 21, icon: 'moon-outline' },
];

// Mon → Sun, as Postgres day-of-week numbers (0 = Sunday)
export const WEEK: { dow: number; label: string }[] = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
  { dow: 0, label: 'Sun' },
];

export const GROUP_PREFS: { key: 'one' | 'small' | 'any'; label: string; sub: string; icon: IconName }[] = [
  { key: 'one', label: '1-on-1', sub: 'Just one person', icon: 'person' },
  { key: 'small', label: 'Small group', sub: '3–4 people', icon: 'people' },
  { key: 'any', label: 'Either', sub: 'Surprise me', icon: 'shuffle' },
];
