import { useState, useRef, useEffect, useCallback } from 'react';
import { SpicaAgent } from '../../agent';
import { loadProjectContext } from '../../utils/projectState';
import { associateEvents } from '../utils/associateEvents';
import type { MessageWithContext } from '../types';

interface EventItem {
  type: 'message' | 'tool_call' | 'reasoning' | 'stream_chunk';
  content: string;
  toolName?: string;
  toolStatus?: 'running' | 'success' | 'error';
  role?: 'user' | 'assistant';
  timestamp: Date;
}

export interface SubAgentState {
  taskId: string;
  description: string;
  status: 'running' | 'completed';
  events: any[]; // 独立的events数组
  currentStream: string;
  currentReasoning: string;
  result?: string;
  startTime: number;
  scrollOffset: number; // 独立滚动位置
}

export interface AgentState {
  isRunning: boolean;
  events: any[];
  messages: MessageWithContext[];
  currentStream: string;
  currentReasoning: string;
  error: string | null;
  sessionStart: Date | null;
  taskCount: number;
  subAgents: Map<string, SubAgentState>;
  showSplitView: boolean;
}

export function useAgent() {
  const [state, setState] = useState<AgentState>({
    isRunning: false,
    events: [],
    messages: [],
    currentStream: '',
    currentReasoning: '',
    error: null,
    sessionStart: null,
    taskCount: 0,
    subAgents: new Map(),
    showSplitView: false,
  });

const agentRef = useRef<SpicaAgent | null>(null);
  const agentInitializedRef = useRef(false);
  const streamBufferRef = useRef<string>('');
  const reasoningBufferRef = useRef<string>('');
  const reasoningTimestampRef = useRef<Date | null>(null);
  const taskQueueRef = useRef<Array<string>>([]);
  const isProcessingRef = useRef(false);
  const interruptFlagRef = useRef(false);
  
  const pendingUpdateRef = useRef<{stream?: boolean; reasoning?: boolean}>({});
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const flushDisplay = useCallback(() => {
    if (flushTimerRef.current) return;
    
    flushTimerRef.current = setTimeout(() => {
      const updates = pendingUpdateRef.current;
      pendingUpdateRef.current = {};
      flushTimerRef.current = null;
      
      setState(prev => {
        const newEvents = [...prev.events];
        
        if (updates.stream) {
        }
        
        if (updates.reasoning && reasoningBufferRef.current.trim()) {
          const existingReasoning = newEvents.find(e => 
            e.type === 'reasoning' && e.timestamp === reasoningTimestampRef.current
          );
          
          if (existingReasoning) {
            existingReasoning.content = reasoningBufferRef.current;
          } else {
            newEvents.push({
              type: 'reasoning',
              content: reasoningBufferRef.current,
              timestamp: reasoningTimestampRef.current || new Date(),
            });
          }
        }
        
        return {
          ...prev,
          events: newEvents,
          messages: associateEvents(newEvents),
          currentStream: updates.stream ? streamBufferRef.current : prev.currentStream,
          currentReasoning: updates.reasoning ? reasoningBufferRef.current : prev.currentReasoning,
        };
      });
    }, 100);
  }, []);

  const processQueue = async () => {
    if (isProcessingRef.current || taskQueueRef.current.length === 0) return;
    if (!agentInitializedRef.current) return;
    
    isProcessingRef.current = true;
    const task = taskQueueRef.current.shift();
    if (!task) {
      isProcessingRef.current = false;
      return;
    }
    
streamBufferRef.current = '';
        reasoningBufferRef.current = '';
        reasoningTimestampRef.current = null;

    setState(prev => ({
      ...prev,
      isRunning: true,
      currentStream: '',
      currentReasoning: '',
      error: null,
    }));

    const agent = agentRef.current;
    if (!agent) {
      isProcessingRef.current = false;
      return;
    }

    try {
      interruptFlagRef.current = false;
      await agent.runLoop(task);
      console.error(`[TASK_COMPLETE] "${task}"`);
      setState(prev => ({ ...prev, isRunning: false }));
    } catch (error: any) {
      console.error(`[TASK_ERROR] ${error.message}`);
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: error.message,
      }));
    }

    isProcessingRef.current = false;
    
    if (interruptFlagRef.current) {
      console.error(`[INTERRUPTED]`);
      return;
    }
    
    if (taskQueueRef.current.length > 0) {
      console.error(`[NEXT_IN_QUEUE]`);
      processQueue();
    }
  };

useEffect(() => {
    if (!agentRef.current) {
      const agent = new SpicaAgent(undefined, process.cwd());
      agentRef.current = agent;
      
      agent.on('stream', (data: any) => {
        streamBufferRef.current += data.chunk;
        pendingUpdateRef.current.stream = true;
        flushDisplay();
      });

      agent.on('reasoning', (data: any) => {
        if (!reasoningTimestampRef.current) {
          reasoningTimestampRef.current = new Date();
        }
        reasoningBufferRef.current += data.content;
        pendingUpdateRef.current.reasoning = true;
        flushDisplay();
      });

      agent.on('message', (msg: any) => {
        const timestamp = new Date();
        
        if (msg.role === 'assistant') {
          const finalStream = streamBufferRef.current;
          const finalReasoning = reasoningBufferRef.current;
          
          streamBufferRef.current = '';
          reasoningBufferRef.current = '';
          
          setState(prev => {
            const newEvents = [...prev.events];
            
            if (msg.content || finalStream) {
              newEvents.push({
                type: 'message',
                role: 'assistant',
                content: msg.content || finalStream,
                timestamp: new Date(),
              });
            }
            
            return {
              ...prev,
              events: newEvents,
              messages: associateEvents(newEvents),
              currentStream: '',
              currentReasoning: '',
            };
          });
        } else if (msg.role === 'user') {
          setState(prev => {
            const newEvents = [...prev.events, { 
              type: 'message', 
              role: 'user', 
              content: msg.content, 
              timestamp: new Date(),
            }];
            return {
              ...prev,
              events: newEvents,
              messages: associateEvents(newEvents),
            };
          });
        }
      });

      agent.on('tool_call', (data: any) => {
        setState(prev => {
          const newEvents = [...prev.events, { 
            type: 'tool_call', 
            toolName: data.name, 
            toolArguments: data.arguments,
            toolStatus: 'running', 
            content: '', 
            timestamp: new Date(),
          }];
          return {
            ...prev,
            events: newEvents,
            messages: associateEvents(newEvents),
          };
        });
      });

      agent.on('tool_result', (data: any) => {
        setState(prev => {
          const newEvents = prev.events.map(e => 
            e.type === 'tool_call' && e.toolName === data.name && e.toolStatus === 'running'
              ? { ...e, toolStatus: data.success ? 'success' : 'error', content: data.output || data.error || '' }
              : e
          );
          return {
            ...prev,
            events: newEvents,
            messages: associateEvents(newEvents),
          };
        });
      });

      agent.on('error', (data: any) => {
        setState(prev => ({ ...prev, error: data.message }));
      });

      agent.init().then(() => {
        agentInitializedRef.current = true;
        const projectContext = loadProjectContext(agent.getWorkspacePath());
        const historyEvents = projectContext
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({
            type: 'message',
            role: m.role,
            content: m.content,
            timestamp: new Date(),
          }));
        
        const newEvents = historyEvents.length > 0 
          ? [...historyEvents, { type: 'message', role: 'assistant', content: '✓ Ready', timestamp: new Date() }]
          : [{ type: 'message', role: 'assistant', content: '✓ Ready', timestamp: new Date() }];
        
        setState(prev => ({
          ...prev,
          sessionStart: new Date(),
          events: newEvents,
          messages: associateEvents(newEvents),
        }));
        
        if (taskQueueRef.current.length > 0) {
          processQueue();
        }
      }).catch((error) => {
        setState(prev => ({
          ...prev,
          error: `Init failed: ${error.message}`,
        }));
      });
    }
    
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      if (agentRef.current) {
        agentRef.current.removeAllListeners();
      }
    };
  }, []);

const interrupt = () => {
    interruptFlagRef.current = true;
    if (agentRef.current) {
      agentRef.current.interrupt();
    }
  };

  const startTask = async (request: string) => {
    taskQueueRef.current.push(request);
    
    setState(prev => ({
      ...prev,
      taskCount: prev.taskCount + 1,
    }));
    
    processQueue();
  };

  return { state, startTask, interrupt };
}