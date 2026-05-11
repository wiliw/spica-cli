# Secure API Key Storage Design

Date: 2026-05-10
Status: Draft

## Problem

当前 API key 明文存储在 `~/.spica/config.json`，存在安全风险：
- Root/备份可读
- 误 commit 到 git
- 多进程可见

## Solution: System Keyring + Config File

### Architecture

```
环境变量（临时，最高优先级）
  ↓
系统密钥环（持久化，加密）
  ↓  
配置文件（持久化，非敏感）
```

### Storage Structure

**配置文件** (`~/.spica/config.json`)
```json
{
  "provider": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4"
}
```

**系统密钥环**（加密）
```
Service: spica
Account: openai
Password: [ENCRYPTED_API_KEY]
```

### Components

**1. KeyringManager**

跨平台密钥环访问：
- macOS: Keychain Services
- Linux: gnome-keyring / kwallet
- Windows: Credential Manager

**2. Config Priority**

```typescript
async getProviderConfig() {
  // 1. 环境变量（临时）
  if (process.env.OPENAI_API_KEY) return env;
  
  // 2. 系统密钥环（持久化）
  const keyring = await keytar.getPassword('spica', 'openai');
  if (keyring) return keyring + config.baseUrl/model;
  
  // 3. 报错：未配置
  throw new Error('API key not found');
}
```

**3. TUI Options**

用户可选择：
- ✓ Save to system keyring（推荐）
- ○ Environment variable only（临时）

### Security Benefits

| 方案 | 加密 | 仅用户可访问 | 无需password | 跨平台 |
|------|------|--------------|--------------|--------|
| **密钥环** | ✓ OS级别 | ✓ | ✓ | ✓ |
| 加密文件 | ✓ 应用级别 | ⚠️ | ❌ | ✓ |
| 环境变量 | ❌ | ❌ | ✓ | ✓ |

### Implementation

**Phase 1: Core**
- Add keytar dependency
- Implement KeyringManager
- Modify config.ts priority

**Phase 2: TUI**
- Add keyring checkbox
- Show security options
- Display storage location

**Phase 3: Testing**
- Test keyring save/load
- Test fallback (env fallback)
- Test Linux/macOS/Windows

**Phase 4: Docs**
- Update README
- Add security guide
- Explain keyring fallback

### Error Handling

**密钥环不可用时**：
```typescript
try {
  await keytar.setPassword('spica', 'openai', apiKey);
} catch (error) {
  // Fallback: 环境变量提示
  console.log('⚠️ Keyring not available');
  console.log('Use: export OPENAI_API_KEY=...');
}
```

### Migration

**从旧配置迁移**：
```typescript
// 读取旧的 config.json（明文）
const oldConfig = await loadConfig();

// 迁移 API key 到密钥环
await keytar.setPassword('spica', oldConfig.provider, oldConfig.apiKey);

// 更新 config.json（移除 API key）
delete oldConfig.apiKey;
await saveConfig(oldConfig);
```

### Questions

1. ✅ 用户选择了系统密钥环方案
2. ✅ 存储架构已确定
3. ✅ 优先级已确定（env > keyring > config）

### Next Steps

- 实现核心代码
- 测试密钥环功能
- 更新文档