import React from 'react';
interface Props {
    config: Record<string, any>;
    onSave: (key: string, value: string) => void;
    onExit: () => void;
}
export declare function ConfigTUI({ config, onSave, onExit }: Props): React.JSX.Element;
export declare function runConfigTUI(): Promise<void>;
export {};
//# sourceMappingURL=config-tui.d.ts.map