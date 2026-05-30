import { describe, it, expect } from 'vitest';

function findSkillReferences(content: string, skillNames: string[], excludeName: string): string[] {
  const found: string[] = [];
  const lower = content.toLowerCase();
  for (const name of skillNames) {
    if (name === excludeName) continue;
    if (
      lower.includes(`superpowers:${name}`) ||
      lower.includes(`skill(name="${name}")`) ||
      lower.includes(`skill(name='${name}')`) ||
      lower.includes(`use the \`${name}\` skill`) ||
      lower.includes(`use ${name}`) ||
      lower.includes(`invoke ${name}`)
    ) {
      found.push(name);
    }
  }
  return [...new Set(found)];
}

describe('Skill Chain Enforcement', () => {
  const allSkills = ['brainstorming', 'systematic-debugging', 'test-driven-development', 'writing-plans', 'verification-before-completion', 'finishing-a-development-branch'];

  describe('findSkillReferences', () => {
    it('finds superpowers:xxx references', () => {
      const content = 'Use the superpowers:test-driven-development skill for writing proper failing tests';
      const refs = findSkillReferences(content, allSkills, 'systematic-debugging');
      expect(refs).toContain('test-driven-development');
    });

    it('finds skill(name="xxx") references', () => {
      const content = 'invoke skill(name="test-driven-development"). Do NOT skip.';
      const refs = findSkillReferences(content, allSkills, 'systematic-debugging');
      expect(refs).toContain('test-driven-development');
    });

    it('does not find the skill itself', () => {
      const content = 'systematic-debugging is the current skill';
      const refs = findSkillReferences(content, allSkills, 'systematic-debugging');
      expect(refs).not.toContain('systematic-debugging');
    });

    it('finds multiple references', () => {
      const content = 'Use test-driven-development. Also use verification-before-completion.';
      const refs = findSkillReferences(content, allSkills, 'writing-plans');
      expect(refs).toContain('test-driven-development');
      expect(refs).toContain('verification-before-completion');
    });

    it('returns empty for no references', () => {
      const content = 'Just some text with no skill names.';
      const refs = findSkillReferences(content, allSkills, 'brainstorming');
      expect(refs).toEqual([]);
    });
  });
});
