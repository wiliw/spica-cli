export interface DiffLine {
    type: 'add' | 'remove' | 'context';
    content: string;
    oldLine?: number;
    newLine?: number;
}
export declare function computeDiff(oldContent: string, newContent: string): DiffLine[];
export declare function formatDiff(diff: DiffLine[], contextLines?: number): string;
export declare function formatDiffSummary(diff: DiffLine[]): string;
export declare function generateEditDiff(oldString: string, newString: string): string;
//# sourceMappingURL=diff.d.ts.map