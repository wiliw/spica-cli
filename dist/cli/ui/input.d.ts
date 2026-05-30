export declare function getStringWidth(str: string): number;
export declare function createInputHandler(onSubmit: (text: string) => void, onInterrupt: () => void): {
    cleanup: () => void;
    getBuffer: () => string;
    clearBuffer: () => void;
    render: () => void;
};
export declare function createStableREPL(onSubmit: (text: string) => Promise<void>): {
    interrupt: () => void;
    cleanup: () => void;
    getBuffer: () => string;
    clearBuffer: () => void;
    render: () => void;
};
//# sourceMappingURL=input.d.ts.map