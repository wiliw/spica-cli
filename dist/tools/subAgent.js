// 子Agent类型定义和配置
export const SUB_AGENT_CONFIGS = {
    explore: {
        allowedTools: ['glob', 'grep', 'file_read', 'directory_list', 'file_exists'],
        timeout: 30000,
        description: '快速只读探索，定位文件和代码',
    },
    review: {
        allowedTools: ['glob', 'grep', 'file_read', 'directory_list', 'lint', 'file_exists'],
        timeout: 60000,
        description: '代码审查，找问题',
    },
    fix: {
        allowedTools: ['file_read', 'file_edit', 'bash', 'lint'],
        timeout: 120000,
        description: '修复特定问题，最小改动',
    },
    build: {
        allowedTools: '*', // 所有工具
        timeout: 180000,
        description: '完整实现功能',
    },
};
// 获取子agent配置
export function getSubAgentConfig(type) {
    if (!type) {
        // 默认为完整权限
        return {
            allowedTools: '*',
            timeout: 120000,
            description: '通用子agent',
        };
    }
    return SUB_AGENT_CONFIGS[type];
}
// 检查工具是否允许
export function isToolAllowed(toolName, config) {
    if (config.allowedTools === '*')
        return true;
    if (!config.allowedTools)
        return false; // 保护
    return config.allowedTools.includes(toolName);
}
// 摘要结果
export function summarizeResult(result, maxLength = 300) {
    if (!result || result.length <= maxLength)
        return result || '';
    // 提取关键信息
    const lines = result.split('\n');
    const keyLines = lines.filter(l => l.includes('✓') ||
        l.includes('✗') ||
        l.includes('完成') ||
        l.includes('成功') ||
        l.includes('失败') ||
        l.includes('Error'));
    if (keyLines.length > 0) {
        return keyLines.slice(0, 5).join('\n').slice(0, maxLength);
    }
    return result.slice(0, maxLength) + '...';
}
//# sourceMappingURL=subAgent.js.map