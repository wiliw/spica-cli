export type TransitionEvent = string;
export type State = string;
export interface Transition {
    from: State;
    to: State;
    event: TransitionEvent;
    condition?: () => boolean;
}
export declare class StateMachine {
    private currentState;
    private transitions;
    private history;
    constructor(initialState: State, transitions: Transition[]);
    getState(): State;
    transition(event: TransitionEvent): void;
    canTransition(event: TransitionEvent): boolean;
    getAvailableEvents(): TransitionEvent[];
    getHistory(): State[];
    reset(): void;
}
//# sourceMappingURL=StateMachine.d.ts.map