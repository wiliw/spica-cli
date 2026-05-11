export declare function useLog(logFile?: string): {
    lines: string[];
    isWatching: boolean;
    addLine: (line: string) => void;
    clear: () => void;
};
export declare function useStdoutLog(): {
    lines: string[];
    clear: () => void;
};
//# sourceMappingURL=useLog.d.ts.map