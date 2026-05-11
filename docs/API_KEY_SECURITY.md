# API Key 安全分析

## 当前方案的安全风险

---

## 方案对比

| 方案 | 风险等级 | 问题 |
|------|----------|------|
| **环境变量** | ⚠️ **高** | shell history、进程列表、子进程可见 |
| **配置文件** | ⚠️ **中** | 明文存储、root/备份可读 |
| **硬编码代码** | ❌ **极高** | git 泄露、完全暴露 |

---

## 具体风险分析

### 1. 环境变量暴露

**问题：**

```bash
# 在 shell 中输入
export OPENAI_API_KEY=sk-proj-xxx...

# 立即暴露在多个地方：
```

**暴露位置：**

a) **Shell History（永久）**
```bash
cat ~/.bash_history
# 输出：
export OPENAI_API_KEY=sk-proj-xxx...  # ← 明文！
export OPENAI_BASE_URL=https://api.together.xyz/v1
export OPENAI_MODEL=llama-3-70b
```

b) **进程列表（临时）**
```bash
ps aux
# 输出：
zison  1234  ...  OPENAI_API_KEY=sk-proj-xxx...  # ← 明文！
```

c) **子进程继承**
```bash
# 所有子进程都能读取
node src/index.ts  # process.env.OPENAI_API_KEY 可见
```

d) **Shell 配置文件（如果写在 .bashrc）**
```bash
cat ~/.bashrc
# 输出：
export OPENAI_API_KEY=sk-proj-xxx...  # ← 永久暴露！
```

---

### 2. 配置文件暴露

**当前方案：**
```bash
~/.spica/config.json (权限: 0600)
```

**风险：**

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-proj-xxx..."  // ← 明文！
    }
  }
}
```

**暴露位置：**

a) **Root 用户可读**
```bash
sudo cat ~/.spica/config.json  # ← root 可读
```

b) **文件系统备份**
```bash
# 备份软件可能备份此文件
tar czf backup.tar.gz ~/.spica/
# API key 进入备份文件（明文）
```

c) **文件系统快照**
```bash
# LVM/Btrfs 快照包含此文件
# 时间点备份包含 API key
```

d) **误提交 git**
```bash
# 如果忘记 .gitignore
git add .
git push  # API key 泄露到远程仓库
```

---

### 3. 项目中的存储方式

**当前 spica-cli：**

**方式 1：环境变量（不存储）**
```typescript
// src/utils/config.ts
const apiKey = process.env.OPENAI_API_KEY;  // ← 运行时读取
// 不写入文件
```

**方式 2：配置文件（存储）**
```typescript
// src/utils/config.ts
await fs.writeJson(CONFIG_FILE, {
  providers: {
    openai: {
      apiKey: "sk-proj-xxx..."  // ← 明文写入
    }
  }
});

await fs.chmod(CONFIG_FILE, 0o600);  // ← 权限保护（但不够）
```

---

## 更安全的方案

### 方案 1：不存储，每次输入（最安全）

**实现：**
```bash
# 每次运行时输入
./bin/spica mvp "build app"
# 提示：Enter API key: _
# 输入后不保存，仅内存中使用
```

**优点：**
- ✅ 不存储在任何文件
- ✅ 不进入 shell history
- ✅ 不进入配置文件
- ✅ 进程结束后清除

**缺点：**
- ⚠️ 每次都要输入
- ⚠️ 不方便

---

### 方案 2：临时环境变量（session 内）

**实现：**
```bash
# 启动 spica TUI
./bin/spica

# 在 TUI 内输入配置（不进入 shell history）
# 保存在内存中，退出后清除
```

**优点：**
- ✅ 不存储到文件
- ✅ 不进入 shell history
- ✅ 仅当前 session 有效

**缺点：**
- ⚠️ 每次 session 需要输入

---

### 方案 3：系统密钥环（推荐）

**实现：**
```bash
# Linux: gnome-keyring / kwallet
# macOS: Keychain
# Windows: Credential Manager

# 配置时保存到密钥环
./bin/spica providers set openai YOUR_KEY
# API key 存入系统密钥环（加密）

# 运行时从密钥环读取
./bin/spica mvp "build app"
```

**优点：**
- ✅ 加密存储
- ✅ 仅用户可访问
- ✅ 不暴露在文件/进程
- ✅ 长期保存，无需每次输入

**缺点：**
- ⚠️ 需要密钥环服务
- ⚠️ 实现复杂

---

### 方案 4：加密配置文件

**实现：**
```bash
# 加密配置文件
~/.spica/config.json.enc

# 运行时解密（需要 master password）
./bin/spica mvp "build app"
# Enter master password: _
```

**优点：**
- ✅ 加密存储
- ✅ 文件权限 + 加密双重保护

**缺点：**
- ⚠️ 需要每次输入 master password
- ⚠️ 加密实现复杂

---

### 方案 5：.env 文件（不提交 git）

**实现：**
```bash
# 项目目录下 .env（不提交）
.env

# 内容：
OPENAI_API_KEY=sk-proj-xxx...

# .gitignore:
.env

# 运行时读取
./bin/spica mvp "build app"
```

**优点：**
- ✅ 不提交到 git（如果正确配置 .gitignore）
- ✅ 项目级别隔离

**缺点：**
- ⚠️ **仍然明文**
- ⚠️ 项目目录可见
- ⚠️ 误提交风险高
- ⚠️ 项目切换需重新配置

---

## 实际安全建议

### 生产环境

**推荐方案：密钥环 + 环境变量（session）**

```bash
# 1. TUI 配置时保存到密钥环
./bin/spica
# 按 S 设置
# API key → 密钥环存储

# 2. CLI 使用时从密钥环读取
./bin/spica mvp "build app"
# 自动从密钥环读取，无需每次输入
```

---

### CI/CD 环境

**推荐方案：临时环境变量（注入）**

```yaml
# GitHub Actions
env:
  OPENAI_API_KEY: ${​{ secrets.OPENAI_API_KEY }}
  OPENAI_MODEL: llama-3-70b

run: |
  ./bin/spica mvp "build app"
```

**不使用配置文件，仅注入环境变量。**

---

### 开发环境

**推荐方案：TUI 配置（session 内）**

```bash
# 启动 TUI
./bin/spica

# 在 TUI 内输入配置
# 不进入 shell history
# 仅当前 session 有效
```

---

## spica-cli 应该实现的方案

**当前：**
- ❌ 环境变量（shell history 暴露）
- ❌ 配置文件（明文）

**改进：**

### 立即改进（低成本）

**1. TUI 配置不存储（session only）**
```typescript
// 在 TUI 内输入 API key
// 仅保存在 React state（内存）
// 退出后清除
```

**2. .env 文件模板（明确警告）**
```bash
# .env.example
OPENAI_API_KEY=your-key-here
# WARNING: Never commit this file to git!
```

---

### 未来改进（高安全性）

**3. 系统密钥环集成**
```typescript
import keytar from 'keytar';

// 存储
await keytar.setPassword('spica', 'openai', apiKey);

// 读取
const apiKey = await keytar.getPassword('spica', 'openai');
```

**4. 加密配置文件**
```typescript
import crypto from 'crypto';

// 加密
const encrypted = encrypt(apiKey, masterPassword);

// 解密
const apiKey = decrypt(encrypted, masterPassword);
```

---

## 其他工具如何处理

| 工具 | 存储方式 | 安全性 |
|------|----------|--------|
| **aider** | 环境变量 | ⚠️ 中（history 暴露） |
| **cursor** | 本地加密 | ✅ 高（加密存储） |
| **opencode** | 环境变量 | ⚠️ 中（history 暴露） |
| **github copilot** | OAuth | ✅ 高（无 key 存储） |

---

## 总结

**当前 spica-cli：**
- ⚠️ 环境变量 - **shell history 暴露**
- ⚠️ 配置文件 - **明文存储**

**改进方案：**

**短期（立即可做）：**
1. TUI 配置不存储（session only）
2. 清晰的安全警告
3. .env.example 模板

**长期（更好安全）：**
1. 系统密钥环集成（推荐）
2. 加密配置文件
3. OAuth/Session-based 认证

---

**你的担心完全正确。API key 安全是严重问题。**

**建议：先实现 TUI session-only 配置（不存储），未来集成密钥环。**