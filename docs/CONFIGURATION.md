# spica-cli 配置指南

---

## 快速配置

```bash
# 配置 provider（OpenAI兼容API）
spica set <name> <url> <apiKey> <model>

# 切换默认 provider
spica use <name>

# 列出所有 provider
spica list

# 查看 provider 详情
spica show [name]

# 删除 provider
spica remove <name...>
spica remove --all
```

示例：
```bash
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat
spica set aliyun https://coding.dashscope.aliyuncs.com/v1 sk-xxx glm-5
spica use deepseek
spica list
```

---

## 配置文件位置

### 全局配置

| 文件 | 位置 | 用途 |
|------|------|------|
| `settings.json` | `~/.spica/settings.json` | 统一配置（providers, mcp, skills, hooks） |

### 项目配置

| 文件 | 位置 | 用途 |
|------|------|------|
| `session.json` | `.spica/session.json` | 会话历史 |
| `state.json` | `.spica/state.json` | 项目状态 |

---

## API提供商配置

### CLI配置

```bash
# 添加/更新 provider
spica set <name> <url> <apiKey> <model>

# 切换默认
spica use <name>

# 删除
spica remove <name>
```

### 配置文件格式

`~/.spica/settings.json`:

```json
{
  "defaultProvider": "deepseek",
  "providers": {
    "deepseek": {
      "name": "deepseek",
      "apiKey": "sk-xxx...",
      "baseUrl": "https://api.deepseek.com/v1",
      "model": "deepseek-chat"
    },
    "aliyun": {
      "name": "aliyun",
      "apiKey": "sk-xxx...",
      "baseUrl": "https://coding.dashscope.aliyuncs.com/v1",
      "model": "glm-5"
    }
  }
}
```

---

## Skills配置

### 配置位置

- 全局: `~/.spica/settings.json` 的 `skills` 字段

### 使用

在交互模式中：

```
/review src/auth.ts
/fix src/utils/helper.ts
```

---

## MCP配置

### 配置位置

`~/.spica/settings.json` 的 `mcp.servers` 字段

### CLI管理

```bash
spica mcp
spica mcp list
spica mcp tools
```

---

## Hooks配置

### 配置位置

`~/.spica/settings.json` 的 `hooks` 字段

---

## 配置优先级

从高到低：

1. **环境变量** - 最高优先级
2. **命令行参数** - `-p/--provider`
3. **全局配置** - `~/.spica/settings.json`

---

## 安全性

```bash
chmod 700 ~/.spica/
chmod 600 ~/.spica/settings.json
```

`.gitignore` 应包含：

```
.spica/
```

---

## 常见问题

### Q: 如何查看当前配置？

```bash
spica list
spica show
```

### Q: 配置文件在哪里？

全局: `~/.spica/settings.json`

### Q: 如何切换提供商？

```bash
spica use <name>
```

### Q: 如何清空配置？

```bash
spica remove --all
```

---

## 相关文档

- [MANUAL.md](./MANUAL.md) - 完整用户手册
- [STORAGE.md](./STORAGE.md) - 存储位置详解