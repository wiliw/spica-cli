export * from './types';
export { FileReadCapability } from './FileRead';
export { FileWriteCapability } from './FileWrite';
export { FileEditCapability } from './FileEdit';
export { FileSearchCapability } from './FileSearch';
export { BashRunnerCapability } from './BashRunner';
export { BashMonitorCapability } from './BashMonitor';
export { GitOperationsCapability } from './GitOperations';
export { WebFetchCapability } from './WebFetch';
export { BuildRunnerCapability } from './BuildRunner';
export { TestRunnerCapability } from './TestRunner';
import { GitOperationsCapability } from './GitOperations';
import { Capability } from './types';
export interface CapabilityRegistry {
    [name: string]: Capability<any, any>;
}
export declare function createCapabilityRegistry(): CapabilityRegistry;
export declare function createGitCapability(): GitOperationsCapability;
export declare const ALL_CAPABILITIES: {
    name: string;
    description: string;
}[];
//# sourceMappingURL=index.d.ts.map