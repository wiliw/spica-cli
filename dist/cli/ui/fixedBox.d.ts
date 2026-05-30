export declare function enableScrollRegion(): void;
export declare function disableScrollRegion(): void;
export declare function clearScreen(): void;
export declare function moveToInputBox(): void;
export declare function clearInputBox(): void;
export declare function showSeparator(): void;
export declare function showStatus(status: {
    model?: string;
    processing?: boolean;
    queue?: number;
    mode?: 'bypass' | 'strict';
    message?: string;
}): void;
export declare function showPrompt(prompt?: string): void;
export declare function showInputContent(content: string): void;
export declare function writeToScrollArea(content: string): void;
export declare function writeLineToScrollArea(content: string): void;
export declare function initFixedInputBox(initialStatus?: {
    model?: string;
    mode?: 'bypass' | 'strict';
}): void;
export declare function handleResize(status?: any): void;
export declare function watchResize(getStatus: () => any): void;
export declare function cleanup(): void;
//# sourceMappingURL=fixedBox.d.ts.map