export interface ScreenState {
    inputBuffer: string[];
    cursorCol: number;
    terminalHeight: number;
    terminalWidth: number;
    inputLines: number;
    statusRow: number;
    scrollBottom: number;
    statusText: string;
    completer: ((line: string) => string[]) | null;
    shownCompletionList: boolean;
    lastCompletionLine: string;
    cursorInScrollArea: boolean;
    isStreaming: boolean;
    onVerboseToggle?: () => void;
}
export declare class ScreenManager {
    state: ScreenState;
    constructor();
    private isCJKChar;
    private getCharDisplayWidth;
    private getStringDisplayWidth;
    private calcInputLines;
    private updateLayout;
    setStreaming(streaming: boolean): void;
    start(): void;
    end(): void;
    appendScroll(text: string): void;
    refreshStatus(): void;
    private drawStatus;
    private formatInputContent;
    refreshInput(): void;
    restoreCursor(): void;
    refreshInputAndKeepCursor(): void;
    getDisplayCol(line: string, col: number): number;
    handleInput(data: string): boolean;
    handleAnsi(seq: string): void;
    handleTab(): void;
    handlePaste(data: string): void;
    getContent(): string;
    clear(): void;
    setCompleter(fn: (line: string) => string[]): void;
    setVerboseToggleCallback(fn: () => void): void;
    setStatus(text: string): void;
}
export declare function getScreenManager(): ScreenManager;
//# sourceMappingURL=screenManager.d.ts.map