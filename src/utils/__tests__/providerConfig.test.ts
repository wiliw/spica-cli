import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import {
  setProviderConfig,
  getProviderConfig,
  listProviders,
  setDefaultProvider,
} from '../settings';

const TEST_DIR = '/tmp/test-provider-config';

describe('Provider Configuration', () => {
  beforeEach(async () => {
    await fs.ensureDir(TEST_DIR);
    process.env.SPICA_GLOBAL_DIR = TEST_DIR;
  });

  afterEach(async () => {
    await fs.remove(TEST_DIR);
    delete process.env.SPICA_GLOBAL_DIR;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SPICA_DEEPSEEK_API_KEY;
  });

  it('should configure any provider with url and model', async () => {
    await setProviderConfig(
      'deepseek',
      'test-api-key',
      'https://api.deepseek.com/v1',
      'deepseek-chat'
    );
    process.env.SPICA_DEEPSEEK_API_KEY = 'test-api-key';
    const config = await getProviderConfig('deepseek');
    expect(config.apiKey).toBe('test-api-key');
    expect(config.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(config.model).toBe('deepseek-chat');
    delete process.env.SPICA_DEEPSEEK_API_KEY;
  });

  it('should configure custom provider', async () => {
    await setProviderConfig(
      'my-custom',
      'custom-api-key',
      'https://my-api.com/v1',
      'custom-model'
    );
    process.env.SPICA_MY_CUSTOM_API_KEY = 'custom-api-key';
    const config = await getProviderConfig('my-custom');
    expect(config.apiKey).toBe('custom-api-key');
    expect(config.baseUrl).toBe('https://my-api.com/v1');
    expect(config.model).toBe('custom-model');
    delete process.env.SPICA_MY_CUSTOM_API_KEY;
  });

  it('should list configured providers', async () => {
    await setProviderConfig('deepseek', 'key1', 'https://api.deepseek.com/v1', 'model1');
    await setProviderConfig('openai', 'key2', 'https://api.openai.com/v1', 'model2');
    const providers = await listProviders();
    expect(providers).toContain('deepseek');
    expect(providers).toContain('openai');
  });

  it('should set default provider', async () => {
    await setProviderConfig('deepseek', 'test-key', 'https://api.deepseek.com/v1', 'model');
    await setDefaultProvider('deepseek');
    process.env.SPICA_DEEPSEEK_API_KEY = 'test-key';
    const config = await getProviderConfig();
    expect(config.apiKey).toBe('test-key');
    delete process.env.SPICA_DEEPSEEK_API_KEY;
  });

  it('should use default base url if not provided', async () => {
    await setProviderConfig('test', 'key', undefined, 'model');
    process.env.SPICA_TEST_API_KEY = 'key';
    const config = await getProviderConfig('test');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    delete process.env.SPICA_TEST_API_KEY;
  });

  it('should throw error if provider not configured', async () => {
    await expect(getProviderConfig('nonexistent')).rejects.toThrow('not configured');
  });
});