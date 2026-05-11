import React from 'react';
import { WorkflowState } from '../hooks/useAgent';
interface Props {
    currentState: WorkflowState | null;
    onSelect: (state: WorkflowState) => void;
    enabled: boolean;
}
export declare function StatePane({ currentState, onSelect, enabled }: Props): React.JSX.Element;
export {};
//# sourceMappingURL=StatePane.d.ts.map