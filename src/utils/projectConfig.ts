// 项目配置解析 - 支持 AGENTS.md 行业标准格式

import fs from 'fs-extra';
import { join } from 'path';

export interface ProjectConfig {
  type?: string;
  language?: string;
  framework?: string;
  commands?: {
    build?: string;
    test?: string;
    dev?: string;
    lint?: string;
  };
  constraints?: string[];
  devTips?: string[];
  testingInstructions?: string;
  prInstructions?: string;
  codeStyle?: string[];
  rawContent?: string;
}

const CONFIG_FILE = 'AGENTS.md';

// 加载项目配置
export function loadProjectConfig(workspace: string): ProjectConfig | null {
  const filepath = join(workspace, CONFIG_FILE);
  if (fs.existsSync(filepath)) {
    const content = fs.readFileSync(filepath, 'utf-8');
    return parseMarkdownConfig(filepath, content);
  }
  return null;
}

// 解析Markdown格式配置（通用解析器）
function parseMarkdownConfig(filepath: string, content: string): ProjectConfig {
  const config: ProjectConfig = { rawContent: content };

  // 尝试匹配各种section标题
  const sections = extractAllSections(content);

  // Project / Overview
  const project = sections.find(s =>
    s.heading.match(/^(Project|Overview|About)/i)
  );
  if (project) {
    config.type = extractFieldValue(project.content, 'Type');
    config.language = extractFieldValue(project.content, 'Language');
    config.framework = extractFieldValue(project.content, 'Framework');

    // 兼容CLAUDE.md格式
    if (!config.type) {
      config.type = extractFieldValue(project.content, 'Project Type');
    }
  }

  // Dev / Setup / Commands
  const dev = sections.find(s =>
    s.heading.match(/^(Dev|Development|Setup|Commands|Environment)/i)
  );
  if (dev) {
    config.commands = {
      dev: extractCommand(dev.content),
      build: extractCommand(dev.content, 'build'),
      test: extractCommand(dev.content, 'test'),
      lint: extractCommand(dev.content, 'lint'),
    };
    config.devTips = extractList(dev.content);
  }

  // Build
  const build = sections.find(s => s.heading.match(/^Build/i));
  if (build && !config.commands?.build) {
    config.commands = { ...config.commands, build: extractCommand(build.content) };
  }

  // Test / Testing
  const test = sections.find(s => s.heading.match(/^Test/i));
  if (test) {
    if (!config.commands?.test) {
      config.commands = { ...config.commands, test: extractCommand(test.content) };
    }
    config.testingInstructions = test.content;
  }

  // Code Style / Style
  const style = sections.find(s => s.heading.match(/^(Code\s*Style|Style|Coding)/i));
  if (style) {
    config.codeStyle = extractList(style.content);
  }

  // Constraints / Rules
  const constraints = sections.find(s =>
    s.heading.match(/^(Constraints|Rules|Guidelines|Important)/i)
  );
  if (constraints) {
    config.constraints = extractList(constraints.content);
  }

  // PR / Commit
  const pr = sections.find(s => s.heading.match(/^(PR|Pull\s*Request|Commit)/i));
  if (pr) {
    config.prInstructions = pr.content;
  }

  return config;
}

// 提取所有sections
function extractAllSections(content: string): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = [];
  const lines = content.split('\n');

  let currentHeading = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      // 保存上一个section
      if (currentHeading && currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join('\n').trim(),
        });
      }
      currentHeading = headingMatch[1].trim();
      currentContent = [];
    } else if (currentHeading) {
      currentContent.push(line);
    }
  }

  // 保存最后一个section
  if (currentHeading && currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join('\n').trim(),
    });
  }

  return sections;
}

// 提取字段值（如 "- Type: Node.js"）
function extractFieldValue(section: string, field: string): string | undefined {
  const regex = new RegExp(`[-*]\\s+${field}:\\s*(.+)$`, 'im');
  const match = section.match(regex);
  return match ? match[1].trim().replace(/`([^`]+)`/, '$1') : undefined;
}

// 提取命令（如 "- Build: `npm run build`"）
function extractCommand(section: string, type?: string): string | undefined {
  // 尝试多种格式
  const patterns = [
    // - Build: `npm run build`
    new RegExp(`[-*]\\s+(?:${type || 'Build|Test|Dev|Start|Run|Lint'}):\\s*\\x60([^\\x60]+)\\x60`, 'i'),
    // - `npm run build`
    /[-*]\s+\x60([^\x60]+)\x60/,
    // npm run build（裸命令）
    new RegExp(`(?:${type || 'build|test|dev|lint'}):\\s*([^\n]+)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = section.match(pattern);
    if (match) return match[1].trim();
  }

  return undefined;
}

// 提取列表项
function extractList(section: string): string[] {
  return section
    .split('\n')
    .filter(line => line.match(/^[-*]\s+/))
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .filter(line => line.length > 0 && !line.match(/^`[^`]+`$/)); // 排除纯命令
}

// 自动检测项目类型
export function autoDetectProject(workspace: string): ProjectConfig {
  const config: ProjectConfig = {};

  // Node.js / TypeScript
  const pkgPath = join(workspace, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = fs.readJsonSync(pkgPath);

      config.type = 'Node.js';
      config.language = pkg.devDependencies?.typescript ? 'TypeScript' : 'JavaScript';

      config.commands = {
        build: pkg.scripts?.build || 'npm run build',
        test: pkg.scripts?.test || 'npm test',
        dev: pkg.scripts?.dev || 'npm run dev',
        lint: pkg.scripts?.lint || 'npm run lint',
      };

      // 检测框架
      const deps = pkg.dependencies || {};
      if (deps.next) config.framework = 'Next.js';
      else if (deps.react) config.framework = 'React';
      else if (deps.vue) config.framework = 'Vue';
      else if (deps.express) config.framework = 'Express';
      else if (deps.fastify) config.framework = 'Fastify';
      else if (deps.ink) config.framework = 'Ink (CLI)';
      else if (deps.svelte) config.framework = 'Svelte';

      return config;
    } catch {}
  }

  // Go
  const goModPath = join(workspace, 'go.mod');
  if (fs.existsSync(goModPath)) {
    return {
      type: 'Go',
      language: 'Go',
      commands: { build: 'go build', test: 'go test ./...', dev: 'go run .' },
    };
  }

  // Python
  const pyprojectPath = join(workspace, 'pyproject.toml');
  const requirementsPath = join(workspace, 'requirements.txt');
  if (fs.existsSync(pyprojectPath) || fs.existsSync(requirementsPath)) {
    return {
      type: 'Python',
      language: 'Python',
      commands: { test: 'pytest', dev: 'python main.py' },
    };
  }

  // Rust
  const cargoPath = join(workspace, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    return {
      type: 'Rust',
      language: 'Rust',
      commands: { build: 'cargo build', test: 'cargo test', dev: 'cargo run' },
    };
  }

  // Java/Kotlin
  const gradlePath = join(workspace, 'build.gradle');
  const mavenPath = join(workspace, 'pom.xml');
  if (fs.existsSync(gradlePath) || fs.existsSync(mavenPath)) {
    return {
      type: 'Java',
      language: fs.existsSync(gradlePath) ? 'Kotlin/Java' : 'Java',
      commands: { build: 'gradle build', test: 'gradle test' },
    };
  }

  return { type: 'Unknown', language: 'Unknown' };
}

// 生成 AGENTS.md
export function generateAgentsMd(config: ProjectConfig): string {
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
- Start: \` ${config.commands?.dev || 'npm run dev'}\`
`;

  if (config.commands?.build) {
    content += `
## Build
- Build: \` ${config.commands.build}\`
`;
  }

  content += `
## Testing
- Test: \` ${config.commands?.test || 'npm test'}\`
- Run tests before committing
`;

  if (config.commands?.lint) {
    content += `- Lint: \` ${config.commands.lint}\`\n`;
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

  return content;
}

// 创建 AGENTS.md 文件
export async function createAgentsMd(workspace: string): Promise<string> {
  const config = autoDetectProject(workspace);
  const content = generateAgentsMd(config);
  const filepath = join(workspace, 'AGENTS.md');

  await fs.writeFile(filepath, content);

  return filepath;
}