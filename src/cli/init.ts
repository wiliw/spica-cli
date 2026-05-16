// /init 命令 - 分析代码库并创建/更新 AGENTS.md

import fs from 'fs-extra';
import { join } from 'path';
import { autoDetectProject, generateAgentsMd, ProjectConfig, loadProjectConfig } from '../utils/projectConfig';
import { LAIN_COLORS } from './ui/colors';

export interface InitOptions {
  force?: boolean;      // 强制完全覆盖（否则合并更新）
  verbose?: boolean;    // 详细输出
}

// 执行 init 命令
export async function runInit(workspace: string, options: InitOptions = {}): Promise<void> {
  console.log(LAIN_COLORS.primary('\n[INIT] Analyzing codebase...'));

  // 1. 检测项目基本信息
  const basicConfig = autoDetectProject(workspace);
  console.log(LAIN_COLORS.muted(`  Detected: ${basicConfig.type} / ${basicConfig.language}`));
  if (basicConfig.framework) {
    console.log(LAIN_COLORS.muted(`  Framework: ${basicConfig.framework}`));
  }

  // 2. 分析代码架构
  const architecture = await analyzeArchitecture(workspace);
  if (architecture.mainEntry) {
    console.log(LAIN_COLORS.muted(`  Entry: ${architecture.mainEntry}`));
  }
  if (architecture.modules.length > 0) {
    console.log(LAIN_COLORS.muted(`  Modules: ${architecture.modules.slice(0, 5).join(', ')}`));
  }
  if (architecture.patterns.length > 0) {
    console.log(LAIN_COLORS.muted(`  Patterns: ${architecture.patterns.join(', ')}`));
  }

  // 3. 加载现有配置
  const existingConfig = loadProjectConfig(workspace);
  const agentsPath = join(workspace, 'AGENTS.md');
  const exists = fs.existsSync(agentsPath);

  // 4. 合并配置
  const finalConfig: ProjectConfig = {
    type: basicConfig.type || existingConfig?.type,
    language: basicConfig.language || existingConfig?.language,
    framework: basicConfig.framework || existingConfig?.framework,
    commands: {
      ...existingConfig?.commands,
      ...basicConfig.commands,
    },
    constraints: existingConfig?.constraints,
    devTips: existingConfig?.devTips,
    codeStyle: existingConfig?.codeStyle,
  };

  // 5. 生成内容
  const content = buildAgentsContent(finalConfig, architecture, workspace);

  // 6. 写入文件
  await fs.writeFile(agentsPath, content);

  const action = exists ? (options.force ? 'Overwritten' : 'Updated') : 'Created';
  console.log(LAIN_COLORS.success(`\n[OK] ${action} AGENTS.md`));
  console.log(LAIN_COLORS.muted(`  Path: ${agentsPath}`));

  // 默认显示内容摘要
  const lines = content.split('\n');
  console.log(LAIN_COLORS.muted(`  Lines: ${lines.length}`));
  console.log(LAIN_COLORS.primary('\n--- Content preview ---'));
  console.log(content);
}

// 分析代码架构
async function analyzeArchitecture(workspace: string): Promise<{
  mainEntry?: string;
  keyFiles: string[];
  modules: string[];
  patterns: string[];
}> {
  const result: {
    mainEntry?: string;
    keyFiles: string[];
    modules: string[];
    patterns: string[];
  } = {
    mainEntry: undefined,
    keyFiles: [],
    modules: [],
    patterns: [],
  };

  // 查找入口文件
  const entryFiles = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js', 'main.go', 'main.py', 'main.rs', 'app.py'];
  for (const entry of entryFiles) {
    if (fs.existsSync(join(workspace, entry))) {
      result.mainEntry = entry;
      break;
    }
  }

  // 分析 src 目录结构
  const srcPath = join(workspace, 'src');
  if (fs.existsSync(srcPath)) {
    try {
      const dirs = await fs.readdir(srcPath);
      result.modules = dirs.filter(d => {
        const fullPath = join(srcPath, d);
        return fs.statSync(fullPath).isDirectory() && !d.startsWith('_') && !d.startsWith('.');
      });
    } catch {}
  }

  // 检测常见模式
  const patterns: Array<{ name: string; files: string[] }> = [
    { name: 'EventEmitter pattern', files: ['agent.ts', 'client.ts'] },
    { name: 'Provider pattern', files: ['providers/', 'provider.ts'] },
    { name: 'Plugin system', files: ['plugins/', 'mcp/', 'hooks/'] },
    { name: 'CLI tool', files: ['cli/', 'commands/'] },
    { name: 'Tools system', files: ['tools/', 'tool.ts'] },
    { name: 'Skills system', files: ['skills/', 'skill.ts'] },
  ];

  for (const p of patterns) {
    const found = p.files.some(f => {
      const path = join(workspace, 'src', f);
      return fs.existsSync(path);
    });
    if (found) {
      result.patterns.push(p.name);
    }
  }

  // 查找关键配置文件
  const keyConfigs = ['CLAUDE.md', 'README.md', 'tsconfig.json', 'vitest.config.ts', 'jest.config.js', '.eslintrc.js'];
  result.keyFiles = keyConfigs.filter(f => fs.existsSync(join(workspace, f)));

  return result;
}

// 构建 AGENTS.md 内容
function buildAgentsContent(config: ProjectConfig, architecture: Awaited<ReturnType<typeof analyzeArchitecture>>, workspace: string): string {
  let content = `# AGENTS.md

## Project
- Type: ${config.type || 'Unknown'}
- Language: ${config.language || 'Unknown'}
`;

  if (config.framework) {
    content += `- Framework: ${config.framework}\n`;
  }

  content += `
## Dev environment
`;

  if (config.commands?.dev) {
    content += `- Start: \` ${config.commands.dev}\`\n`;
  }

  if (config.commands?.build) {
    content += `
## Build
- Build: \` ${config.commands.build}\`
`;
  }

  content += `
## Testing
`;

  if (config.commands?.test) {
    content += `- Test: \` ${config.commands.test}\`\n`;
  }

  content += `- Run tests before committing\n`;

  if (config.commands?.lint) {
    content += `- Lint: \` ${config.commands.lint}\`\n`;
  }

  if (architecture.mainEntry) {
    content += `
## Architecture
- Entry: \` ${architecture.mainEntry}\`
`;

    if (architecture.modules.length > 0) {
      content += `- Modules: ${architecture.modules.join(', ')}\n`;
    }

    if (architecture.patterns.length > 0) {
      content += `- Patterns: ${architecture.patterns.join(', ')}\n`;
    }

    if (architecture.keyFiles.length > 0) {
      content += `- Key files: ${architecture.keyFiles.join(', ')}\n`;
    }
  }

  content += `
## Code style
- No comments unless explicitly requested
- Prefer concise, readable code
`;

  if (config.constraints?.length) {
    content += `
## Constraints
${config.constraints.map(c => `- ${c}`).join('\n')}
`;
  }

  if (config.devTips?.length) {
    content += `
## Tips
${config.devTips.map(t => `- ${t}`).join('\n')}
`;
  }

  return content;
}