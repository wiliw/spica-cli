interface InputOptions {
    onUp?: () => void;
    onDown?: () => void;
    onEnter?: () => void;
    onTab?: () => void;
    onEscape?: () => void;
    onQuit?: () => void;
    onChar?: (char: string) => void;
    enabled?: boolean;
}
export declare function useKeyboardInput(options: InputOptions): void;
export {};
//# sourceMappingURL=useInput.d.ts.map