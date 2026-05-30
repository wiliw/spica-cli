import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../skillGate';

describe('classifyIntent', () => {
  describe('Tier 1 — explicit design/improvement questions', () => {
    it('returns brainstorming for "how to improve"', () => {
      expect(classifyIntent('how to improve error handling')).toBe('brainstorming');
    });
    it('returns brainstorming for "could we"', () => {
      expect(classifyIntent('could we add a cache layer')).toBe('brainstorming');
    });
    it('returns brainstorming for "should we"', () => {
      expect(classifyIntent('should we switch to postgres')).toBe('brainstorming');
    });
    it('returns brainstorming for "how to make better"', () => {
      expect(classifyIntent('how to make the login better')).toBe('brainstorming');
    });
    it('returns brainstorming for "what would you change"', () => {
      expect(classifyIntent('what would you change about the API')).toBe('brainstorming');
    });
  });

  describe('Tier 2 — creation keywords + target noun', () => {
    it('returns brainstorming for create + module', () => {
      expect(classifyIntent('create a login module')).toBe('brainstorming');
    });
    it('returns brainstorming for add + function', () => {
      expect(classifyIntent('add a helper function')).toBe('brainstorming');
    });
    it('returns brainstorming for build + component', () => {
      expect(classifyIntent('build a sidebar component')).toBe('brainstorming');
    });
    it('returns brainstorming for implement + system', () => {
      expect(classifyIntent('implement a caching system')).toBe('brainstorming');
    });
    it('returns brainstorming for write + file', () => {
      expect(classifyIntent('write a config file')).toBe('brainstorming');
    });
    it('returns brainstorming for make + class', () => {
      expect(classifyIntent('make a utility class')).toBe('brainstorming');
    });
    it('returns brainstorming for create with module keyword', () => {
      expect(classifyIntent('create something cool for the module')).toBe('brainstorming');
    });
  });

  describe('Tier 3 — bug/fix keywords', () => {
    it('returns systematic-debugging for fix', () => {
      expect(classifyIntent('fix the login bug')).toBe('systematic-debugging');
    });
    it('returns systematic-debugging for debug', () => {
      expect(classifyIntent('debug the connection timeout')).toBe('systematic-debugging');
    });
    it('returns systematic-debugging for broken', () => {
      expect(classifyIntent('the build is broken')).toBe('systematic-debugging');
    });
    it('returns systematic-debugging for not working', () => {
      expect(classifyIntent('tests are not working')).toBe('systematic-debugging');
    });
    it('returns systematic-debugging for error', () => {
      expect(classifyIntent('getting a type error')).toBe('systematic-debugging');
    });
    it('returns systematic-debugging for crash', () => {
      expect(classifyIntent('app crashes on startup')).toBe('systematic-debugging');
    });
    it('returns systematic-debugging for failing', () => {
      expect(classifyIntent('failing tests in CI')).toBe('systematic-debugging');
    });
  });

  describe('Tier 4 — review keywords', () => {
    it('returns requesting-code-review for review', () => {
      expect(classifyIntent('review my latest changes')).toBe('requesting-code-review');
    });
    it('returns requesting-code-review for check my code', () => {
      expect(classifyIntent('check my code for issues')).toBe('requesting-code-review');
    });
    it('returns requesting-code-review for look over', () => {
      expect(classifyIntent('look over this PR')).toBe('requesting-code-review');
    });
  });

  describe('Tier 5 — negative patterns', () => {
    it('returns null for what is', () => {
      expect(classifyIntent('what is a closure')).toBeNull();
    });
    it('returns null for how does', () => {
      expect(classifyIntent('how does promises work')).toBeNull();
    });
    it('returns null for explain', () => {
      expect(classifyIntent('explain the event loop')).toBeNull();
    });
    it('returns null for what is without creation/fix keywords', () => {
      expect(classifyIntent('what is a closure anyway')).toBeNull();
    });
  });

  describe('Fallback', () => {
    it('returns null for empty string', () => {
      expect(classifyIntent('')).toBeNull();
    });
    it('returns null for greeting', () => {
      expect(classifyIntent('hello')).toBeNull();
    });
    it('returns null for whitespace', () => {
      expect(classifyIntent('   ')).toBeNull();
    });
  });

  describe('Case insensitivity', () => {
    it('matches uppercase', () => {
      expect(classifyIntent('FIX THE BUG')).toBe('systematic-debugging');
    });
    it('matches mixed case', () => {
      expect(classifyIntent('How To Improve Performance')).toBe('brainstorming');
    });
  });

  describe('Tier priority', () => {
    it('Tier 1 beats Tier 3', () => {
      expect(classifyIntent('how to improve the broken login')).toBe('brainstorming');
    });
    it('Tier 2 overrides Tier 5', () => {
      expect(classifyIntent('explain how to create a module')).toBe('brainstorming');
    });
  });
});
