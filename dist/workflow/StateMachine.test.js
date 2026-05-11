import { describe, it, expect } from 'vitest';
import { StateMachine } from './StateMachine';
describe('StateMachine', () => {
    const transitions = [
        { from: 'idle', to: 'running', event: 'start' },
        { from: 'running', to: 'paused', event: 'pause' },
        { from: 'paused', to: 'running', event: 'resume' },
        { from: 'running', to: 'completed', event: 'finish' },
        { from: 'paused', to: 'completed', event: 'cancel' },
    ];
    it('should start with initial state', () => {
        const sm = new StateMachine('idle', transitions);
        expect(sm.getState()).toBe('idle');
    });
    it('should transition on valid event', () => {
        const sm = new StateMachine('idle', transitions);
        sm.transition('start');
        expect(sm.getState()).toBe('running');
    });
    it('should throw on invalid transition', () => {
        const sm = new StateMachine('idle', transitions);
        expect(() => sm.transition('pause')).toThrow('Invalid transition');
    });
    it('should check if can transition', () => {
        const sm = new StateMachine('idle', transitions);
        expect(sm.canTransition('start')).toBe(true);
        expect(sm.canTransition('pause')).toBe(false);
    });
    it('should get available events', () => {
        const sm = new StateMachine('running', transitions);
        const events = sm.getAvailableEvents();
        expect(events).toContain('pause');
        expect(events).toContain('finish');
        expect(events).toHaveLength(2);
    });
    it('should track history', () => {
        const sm = new StateMachine('idle', transitions);
        sm.transition('start');
        sm.transition('pause');
        sm.transition('resume');
        const history = sm.getHistory();
        expect(history).toEqual(['idle', 'running', 'paused', 'running']);
    });
    it('should support conditional transitions', () => {
        const transitionsWithCondition = [
            { from: 'idle', to: 'running', event: 'start', condition: () => true },
            { from: 'running', to: 'completed', event: 'finish', condition: () => false },
        ];
        const sm = new StateMachine('idle', transitionsWithCondition);
        sm.transition('start');
        expect(sm.getState()).toBe('running');
        expect(() => sm.transition('finish')).toThrow('Condition not met');
    });
    it('should reset to initial state', () => {
        const sm = new StateMachine('idle', transitions);
        sm.transition('start');
        sm.reset();
        expect(sm.getState()).toBe('idle');
        expect(sm.getHistory()).toHaveLength(1);
    });
});
//# sourceMappingURL=StateMachine.test.js.map