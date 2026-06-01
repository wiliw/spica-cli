# spica-cli Provider 配置

## 设计原则

spica-cli 使用 **OpenAI API 兼容格式**，支持所有第三方模型服务。

**无内置 provider** - 用户需要自己配置 API。

---

## 配置方式

### 添加 Provider

```bash
spica set <name> <url> <apiKey> <model>
```

示例：
```bash
spica set deepseek https://api.deepseek.com/v1 sk-xxx deepseek-chat
spica set aliyun https://coding.dashscope.aliyuncs.com/v1 sk-xxx glm-5
spica set together https://api.together.xyz/v1 xxx llama-3-70b
spica set local http://localhost:8000/v1 dummy llama-3
```

### 切换 Provider

```bash
spica use <name>
```

### 查看 Provider

```bash
spica list        # 列出所有
spica show [name] # 详情
```

### 删除 Provider

```bash
spica remove <name...>
spica remove --all
```

---

## 常见服务配置

| 服务 | URL | 模型示例 |
|------|-----|---------|
| DeepSeek | https://api.deepseek.com/v1 | deepseek-chat |
| 阿里云 GLM | https://coding.dashscope.aliyuncs.com/v1 | glm-5 |
| Together AI | https://api.together.xyz/v1 | llama-3-70b |
| Groq | https://api.groq.com/openai/v1 | llama-3-70b |
| OpenAI | https://api.openai.com/v1 | gpt-4o |
| 本地 | http://localhost:8000/v1 | llama-3 |

---

## 本地模型

### llama.cpp

```bash
llama-server -m llama-3.gguf --port 8000
spica set local http://localhost:8000/v1 dummy llama-3
```

### Ollama

```bash
ollama serve
spica set local http://localhost:11434/v1 dummy llama3
```

---

## 配置文件

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
    }
  }
}
```

---

## 环境变量（可选）

```bash
export OPENAI_API_KEY=sk-xxx
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_MODEL=gpt-4o
```

---

## 临时切换

```bash
spica run "任务" -p <name>
spica -p <name>
```