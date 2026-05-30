export declare const LAIN_COLORS: {
    primary: import("chalk").ChalkInstance;
    secondary: import("chalk").ChalkInstance;
    accent: import("chalk").ChalkInstance;
    success: import("chalk").ChalkInstance;
    error: import("chalk").ChalkInstance;
    warning: import("chalk").ChalkInstance;
    border: import("chalk").ChalkInstance;
    prompt: import("chalk").ChalkInstance;
    muted: import("chalk").ChalkInstance;
    dim: import("chalk").ChalkInstance;
    reasoning: import("chalk").ChalkInstance;
    tool: import("chalk").ChalkInstance;
    file: import("chalk").ChalkInstance;
    diffAdd: import("chalk").ChalkInstance;
    diffRemove: import("chalk").ChalkInstance;
    permissionBorder: import("chalk").ChalkInstance;
    permissionTitle: import("chalk").ChalkInstance;
    permissionText: import("chalk").ChalkInstance;
    bypass: import("chalk").ChalkInstance;
    bypassAuto: import("chalk").ChalkInstance;
    subAgent: import("chalk").ChalkInstance;
    bg: import("chalk").ChalkInstance;
    bgAlt: import("chalk").ChalkInstance;
    bgBorder: import("chalk").ChalkInstance;
};
export declare const BG: {
    _bannerStopSignal: boolean;
    _compressStopSignal: boolean;
    banner: () => Promise<void>;
    stopBanner: () => void;
    compressSpinner: () => Promise<void>;
    stopCompress: () => void;
};
export declare const format: {
    prompt: () => string;
    success: (text: string) => string;
    error: (text: string) => string;
    warning: (text: string) => string;
    toolCall: (name: string) => string;
    toolResult: (name: string, success: boolean, output: string) => string;
    reasoning: (content: string) => string;
    diffFile: (path: string) => string;
    diffAdd: (line: string) => string;
    diffRemove: (line: string) => string;
    permissionBox: (reason: string) => string;
    status: (bypass: boolean, msgs: number, workspace: string) => string;
    muted: (text: string) => string;
    dim: (text: string) => string;
    tableRow: (columns: string[], widths: number[]) => string;
    statusTable: (items: Array<{
        label: string;
        value: string;
    }>) => string;
};
//# sourceMappingURL=colors.d.ts.map