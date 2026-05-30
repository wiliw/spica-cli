export interface TUIInputResult {
    content: string;
    shouldProcess: boolean;
    shouldExit: boolean;
    isInterrupt: boolean;
}
export declare class TUIInputHandler {
    private screen;
    private lastEscTime;
    private interruptCount;
    getScreen(): import("./screenManager").ScreenManager;
    start(): void;
    end(): void;
    handleStdin(data: string, permissionDialogActive: boolean): TUIInputResult;
}
//# sourceMappingURL=tuiInput.d.ts.map