# 安全说明

## API Key 存储方式

**当前方案：本地文件存储（明文）**

```
~/.spica/config.json (权限: 0600)
```

---

## 安全措施

**已实施：**
- ✅ 文件权限 0600（仅用户可读）
- ✅ 目录权限 0700（仅用户可访问）
- ✅ 存储在用户目录（非项目目录）
- ✅ 不提交到 git（需添加到 .gitignore）

**风险说明：**
- ⚠️ **明文存储** - 本地文件未加密
- ⚠️ root 用户可读
- ⚠️ 文件系统备份可能泄露

---

## 安全建议

### 1. 添加到 .gitignore

在项目 `.gitignore` 中添加：
```
.spica/
```

### 2. 使用环境变量（更安全）

```bash
# 设置环境变量（不保存到文件）
export OPENAI_API_KEY=sk-xxx...

# spica-cli 会优先读取环境变量
./bin/spica mvp "build app"
```

### 3. 加密存储（未来功能）

未来版本考虑：
- 使用系统密钥环（keyring）
- 加密配置文件
- 支持 vault 集成

---

## 不要做

❌ 不要提交 `~/.spica/config.json` 到 git
❌ 不要在共享服务器存储真实 API key
❌ 不要在 CI/CD 中硬编码 API key

---

## 如果泄露

**立即处理：**
1. 删除泄露的 API key
2. 生成新 key
3. 更新配置：`spica providers set openai NEW_KEY`

---

## 对比其他工具

| 工具 | 存储方式 | 安全性 |
|------|----------|--------|
| **spica-cli** | ~/.spica/config.json (0600) | 中等 |
| **OpenCode** | 环境变量 | 高 |
| **Cursor** | 本地加密 | 高 |
| **Aider** | 环境变量 | 高 |

---

## 现在行动

**已自动修复：**
- 配置文件权限改为 0600 ✓

**需要手动：**
- 添加 `.spica/` 到项目 .gitignore
- 或使用环境变量（推荐）