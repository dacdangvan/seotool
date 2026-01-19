/**
 * Autonomous SEO Agent v1.0
 * 
 * Meta-agent that orchestrates SEO agents v0.2-v0.6
 * 
 * Key Features:
 * - Goal interpretation and objective generation
 * - Multi-agent observation aggregation
 * - AI-powered reasoning and analysis
 * - Prioritized action planning
 * - Human-in-the-loop approval workflow
 * - Safe, controlled execution
 * - Learning from past outcomes
 */

// Main agent
export { AutonomousSEOAgent, default } from './main';

// Core components
export { GoalInterpreter } from './goal_interpreter';
export { ObservationAggregator } from './observation_aggregator';
export { ReasoningEngine } from './reasoning_engine';
export { ActionPlanner } from './action_planner';
export { ExecutionCoordinator } from './execution_coordinator';
export { MemoryStore } from './memory_store';
export { SafetyGate } from './safety_gate';

// Types
export * from './models';
