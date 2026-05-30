// Test session truncation
import { saveSession, loadSession } from '../../utils/session';
import type { ChatMessage } from '../../llm/providers/BaseProvider';
import fs from 'fs-extra';

describe('Session Truncation', () => {
  const testWorkspace = '/tmp/test-session';

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testWorkspace)) {
      fs.removeSync(testWorkspace);
    }
    fs.ensureDirSync(testWorkspace);
  });

  it('should truncate messages to max 50', () => {
    // Create 100 messages
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 100; i++) {
      messages.push({ role: 'user', content: `Message ${i}` });
      messages.push({ role: 'assistant', content: `Response ${i}` });
    }

    saveSession(testWorkspace, messages);
    const loaded = loadSession(testWorkspace);

    // Should only have 50 messages (last 50)
    expect(loaded!.messages.length).toBe(50);
    // First message should be message 75 (index 150-150)
    expect(loaded!.messages[0].content).toContain('75');
  });

  it('should truncate long messages to 2000 chars', () => {
    const longContent = 'A'.repeat(5000);
    const messages: ChatMessage[] = [
      { role: 'user', content: longContent },
      { role: 'assistant', content: 'short' }
    ];

    saveSession(testWorkspace, messages);
    const loaded = loadSession(testWorkspace);

    // Long message should be truncated to ~2000 chars + "...[truncated]" suffix
    // "...[truncated]" is 14 chars, total = 2014 chars max
    expect(loaded!.messages[0].content.length).toBeLessThanOrEqual(2014);
    expect(loaded!.messages[0].content).toContain('[truncated]');
    expect(loaded!.messages[0].content.startsWith('A')).toBe(true);
  });

  });
});