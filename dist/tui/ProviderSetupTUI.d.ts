import React from 'react';
interface ProviderConfig {
    provider: string;
    apiKey: string;
    baseUrl: string;
    model: string;
}
interface Props {
    onComplete: (config?: ProviderConfig) => void;
    sessionOnly?: boolean;
}
export declare function ProviderSetupTUI({ onComplete, sessionOnly }: Props): React.JSX.Element;
export declare function runProviderSetupTUI(): Promise<void>;
export {};
//# sourceMappingURL=ProviderSetupTUI.d.ts.map