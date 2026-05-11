export class StateMachine {
    currentState;
    transitions;
    history = [];
    constructor(initialState, transitions) {
        this.currentState = initialState;
        this.transitions = transitions;
        this.history.push(initialState);
    }
    getState() {
        return this.currentState;
    }
    transition(event) {
        const transition = this.transitions.find(t => t.from === this.currentState && t.event === event);
        if (!transition) {
            throw new Error(`Invalid transition: ${this.currentState} -> ${event}`);
        }
        if (transition.condition && !transition.condition()) {
            throw new Error('Condition not met');
        }
        this.currentState = transition.to;
        this.history.push(this.currentState);
    }
    canTransition(event) {
        return this.transitions.some(t => t.from === this.currentState && t.event === event);
    }
    getAvailableEvents() {
        return this.transitions
            .filter(t => t.from === this.currentState)
            .map(t => t.event);
    }
    getHistory() {
        return [...this.history];
    }
    reset() {
        this.currentState = this.history[0];
        this.history = [this.currentState];
    }
}
//# sourceMappingURL=StateMachine.js.map