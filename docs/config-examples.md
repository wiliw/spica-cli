# OpenAI API Configuration Example

## Standard OpenAI

```bash
spica config set openai.apiKey sk-xxxxxx
spica config set openai.model gpt-4
spica config set openai.baseUrl https://api.openai.com/v1
```

## Local Models (llama, etc.)

```bash
# Using llama.cpp or similar
spica config set openai.apiKey dummy-key
spica config set openai.model llama-3-70b
spica config set openai.baseUrl http://localhost:8000/v1
```

## Azure OpenAI

```bash
spica config set openai.apiKey YOUR_AZURE_KEY
spica config set openai.model gpt-4
spica config set openai.baseUrl https://your-resource.openai.azure.com/openai/deployments/your-deployment
```

## Other OpenAI-compatible APIs

```bash
# Anthropic (if using OpenAI-compatible endpoint)
spica config set openai.apiKey YOUR_ANTHROPIC_KEY
spica config set openai.model claude-3-opus
spica config set openai.baseUrl https://api.anthropic.com/v1

# Other providers
spica config set openai.baseUrl https://your-provider.com/v1
```

## View Configuration

```bash
spica config list
```

Output:
```json
{
  "openai": {
    "apiKey": "sk-xxxxxx",
    "model": "gpt-4",
    "baseUrl": "https://api.openai.com/v1"
  }
}
```