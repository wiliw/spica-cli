const TIER_1_PATTERNS = [
  'how to improve',
  'how to make better',
  'could we',
  'should we',
  'what would you change',
];

const TIER_2_VERBS = ['create', 'add', 'build', 'make', 'implement', 'write'];
const TIER_2_NOUNS = ['feature', 'component', 'module', 'system', 'function', 'class', 'file'];

const TIER_3_KEYWORDS = ['fix', 'debug', 'bug', 'error', 'broken', 'not working', 'failing', 'crash'];

const TIER_4_PATTERNS = ['review', 'check my code', 'look over'];

const TIER_5_PREFIXES = ['what is', 'how does', 'explain'];

export function classifyIntent(text: string): string | null {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;

  // Tier 1 — explicit design/improvement questions
  if (TIER_1_PATTERNS.some(p => lower.includes(p))) {
    return 'brainstorming';
  }

  // Tier 2 — creation keywords + target noun
  const hasCreationVerb = TIER_2_VERBS.some(v => lower.includes(v));
  const hasTargetNoun = TIER_2_NOUNS.some(n => lower.includes(n));
  if (hasCreationVerb && hasTargetNoun) {
    return 'brainstorming';
  }

  // Tier 3 — bug/fix keywords
  if (TIER_3_KEYWORDS.some(k => lower.includes(k))) {
    return 'systematic-debugging';
  }

  // Tier 4 — review keywords
  if (TIER_4_PATTERNS.some(p => lower.includes(p))) {
    return 'requesting-code-review';
  }

  // Tier 5 — negative patterns (pure info questions)
  const hasCreationOrFix = [...TIER_2_VERBS, ...TIER_3_KEYWORDS].some(k => lower.includes(k));
  if (TIER_5_PREFIXES.some(p => lower.startsWith(p)) && !hasCreationOrFix) {
    return null;
  }

  return null;
}
