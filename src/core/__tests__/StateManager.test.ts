import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import { StateManager } from '../StateManager';

const TEST_STATE_DIR = '/tmp/spica-test-state';

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(async () => {
    await fs.ensureDir(TEST_STATE_DIR);
    stateManager = new StateManager(TEST_STATE_DIR);
  });

  afterEach(async () => {
    await fs.remove(TEST_STATE_DIR);
  });

  describe('save and load state', () => {
    it('saves and loads state by key', async () => {
      const state = { foo: 'bar', count: 42 };
      await stateManager.save('test-key', state);

      const loaded = await stateManager.load('test-key');
      expect(loaded).toEqual(state);
    });

    it('returns undefined for non-existent key', async () => {
      const loaded = await stateManager.load('nonexistent');
      expect(loaded).toBeUndefined();
    });

    it('overwrites existing state', async () => {
      await stateManager.save('key', { version: 1 });
      await stateManager.save('key', { version: 2 });

      const loaded = await stateManager.load('key');
      expect(loaded).toEqual({ version: 2 });
    });
  });

  describe('update', () => {
    it('merges updates with existing state', async () => {
      await stateManager.save('config', { theme: 'dark', lang: 'en' });
      await stateManager.update('config', { theme: 'light' });

      const loaded = await stateManager.load('config');
      expect(loaded).toEqual({ theme: 'light', lang: 'en' });
    });

    it('creates new state if not exists', async () => {
      await stateManager.update('new-key', { value: 'test' });

      const loaded = await stateManager.load('new-key');
      expect(loaded).toEqual({ value: 'test' });
    });
  });

  describe('delete', () => {
    it('deletes state by key', async () => {
      await stateManager.save('to-delete', { data: 'test' });
      await stateManager.delete('to-delete');

      const loaded = await stateManager.load('to-delete');
      expect(loaded).toBeUndefined();
    });

    it('handles deleting non-existent key', async () => {
      await expect(stateManager.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('lists all state keys', async () => {
      await stateManager.save('key1', { a: 1 });
      await stateManager.save('key2', { b: 2 });
      await stateManager.save('key3', { c: 3 });

      const keys = await stateManager.list();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('returns empty array when no states', async () => {
      const keys = await stateManager.list();
      expect(keys).toEqual([]);
    });
  });

  describe('clear', () => {
    it('clears all states', async () => {
      await stateManager.save('key1', {});
      await stateManager.save('key2', {});

      await stateManager.clear();

      const keys = await stateManager.list();
      expect(keys).toEqual([]);
    });
  });
});