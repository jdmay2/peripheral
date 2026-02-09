/**
 * Gesture Sequencer — detects ordered sequences of gestures.
 *
 * Enables compound gestures like "tap → flick → shake" by tracking
 * recognition results and advancing through sequence steps. Standalone
 * class — consumers opt in by feeding it accepted recognition results.
 *
 * @example
 * ```ts
 * const sequencer = new GestureSequencer();
 * sequencer.registerSequence({
 *   id: 'unlock',
 *   name: 'Unlock Sequence',
 *   steps: ['tap', 'shake', 'flick'],
 *   timeoutMs: 3000,
 * });
 *
 * sequencer.on('sequenceRecognized', (event) => {
 *   console.log(`Sequence ${event.sequenceName} completed!`);
 * });
 *
 * // Feed accepted gesture results from the engine
 * engine.on('gesture', (result) => sequencer.feedGesture(result));
 * ```
 */

import { EventEmitter } from '../utils/event-emitter';
import type { RecognitionResult } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Definition of a gesture sequence. */
export interface GestureSequenceDef {
  /** Unique sequence identifier. */
  id: string;
  /** Human-readable sequence name. */
  name: string;
  /** Ordered list of gesture IDs that must be recognized in order. */
  steps: string[];
  /** Max time between consecutive steps in ms. Default: 3000. */
  timeoutMs?: number;
  /** Max total time from first step to last step in ms. Optional. */
  totalTimeoutMs?: number;
}

/** Emitted when a full sequence is recognized. */
export interface SequenceRecognizedEvent {
  /** Sequence definition ID. */
  sequenceId: string;
  /** Sequence name. */
  sequenceName: string;
  /** Recognition results for each completed step. */
  steps: RecognitionResult[];
  /** Total duration from first to last step in ms. */
  totalDuration: number;
}

/** Emitted when a sequence advances to the next step. */
export interface SequenceProgressEvent {
  /** Sequence definition ID. */
  sequenceId: string;
  /** Sequence name. */
  sequenceName: string;
  /** Current step index (0-based, just completed). */
  completedStep: number;
  /** Total number of steps. */
  totalSteps: number;
  /** The gesture that completed this step. */
  gestureResult: RecognitionResult;
}

/** Emitted when a sequence times out mid-progress. */
export interface SequenceTimeoutEvent {
  /** Sequence definition ID. */
  sequenceId: string;
  /** Sequence name. */
  sequenceName: string;
  /** How many steps were completed before timeout. */
  completedSteps: number;
  /** Total number of steps. */
  totalSteps: number;
}

export interface GestureSequencerEvents {
  sequenceRecognized: SequenceRecognizedEvent;
  sequenceProgress: SequenceProgressEvent;
  sequenceTimeout: SequenceTimeoutEvent;
}

// ─── Internal state ─────────────────────────────────────────────────────────

interface ActiveSequenceState {
  /** Current step index (next step to match). */
  currentStep: number;
  /** Timestamps + results for completed steps. */
  completedResults: RecognitionResult[];
  /** Timestamp of the last matched step. */
  lastStepTime: number;
  /** Timeout timer handle. */
  timer: ReturnType<typeof setTimeout> | null;
}

// ─── Sequencer ──────────────────────────────────────────────────────────────

export class GestureSequencer extends EventEmitter<GestureSequencerEvents> {
  private sequences = new Map<string, GestureSequenceDef>();
  private activeStates = new Map<string, ActiveSequenceState>();

  /** Register a gesture sequence definition. */
  registerSequence(def: GestureSequenceDef): void {
    if (def.steps.length < 2) {
      throw new Error(`Sequence "${def.id}" must have at least 2 steps`);
    }
    this.sequences.set(def.id, def);
    // Clear any active state for this sequence
    this.resetSequence(def.id);
  }

  /** Unregister a gesture sequence. */
  unregisterSequence(id: string): void {
    this.sequences.delete(id);
    this.clearActiveState(id);
  }

  /** Get all registered sequence definitions. */
  getSequences(): GestureSequenceDef[] {
    return Array.from(this.sequences.values());
  }

  /**
   * Feed a recognized gesture result into the sequencer.
   *
   * Call this for every accepted gesture from the engine. The sequencer
   * will advance matching sequences and emit events as appropriate.
   */
  feedGesture(result: RecognitionResult): void {
    if (!result.gestureId || !result.accepted) return;

    for (const [seqId, def] of this.sequences) {
      this.advanceSequence(seqId, def, result);
    }
  }

  /** Reset all active sequence state. */
  reset(): void {
    for (const id of this.activeStates.keys()) {
      this.clearActiveState(id);
    }
    this.activeStates.clear();
  }

  /** Reset a specific sequence's progress. */
  resetSequence(id: string): void {
    this.clearActiveState(id);
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private advanceSequence(
    seqId: string,
    def: GestureSequenceDef,
    result: RecognitionResult,
  ): void {
    let state = this.activeStates.get(seqId);
    const expectedStep = state ? state.currentStep : 0;
    const expectedGestureId = def.steps[expectedStep];

    if (result.gestureId !== expectedGestureId) {
      // Check if this gesture matches the FIRST step (restart sequence)
      if (result.gestureId === def.steps[0]) {
        this.clearActiveState(seqId);
        state = this.createActiveState(seqId, def, result);
        return;
      }
      // Doesn't match — if we had a partial sequence, it's broken
      if (state && state.currentStep > 0) {
        this.clearActiveState(seqId);
      }
      return;
    }

    if (!state) {
      // First step matched
      state = this.createActiveState(seqId, def, result);
      return;
    }

    // Check total timeout (if configured)
    if (def.totalTimeoutMs && state.completedResults.length > 0) {
      const firstStepTime = state.completedResults[0]!.timestamp;
      if (result.timestamp - firstStepTime > def.totalTimeoutMs) {
        this.emitTimeout(seqId, def, state.currentStep);
        this.clearActiveState(seqId);
        // Try restarting if this matches step 0
        if (result.gestureId === def.steps[0]) {
          this.createActiveState(seqId, def, result);
        }
        return;
      }
    }

    // Matched expected step — advance
    state.completedResults.push(result);
    state.lastStepTime = result.timestamp;
    state.currentStep++;

    // Clear and reset step timeout
    if (state.timer) clearTimeout(state.timer);

    // Check if sequence is complete
    if (state.currentStep >= def.steps.length) {
      const firstTime = state.completedResults[0]!.timestamp;
      const lastTime = result.timestamp;

      this.emit('sequenceRecognized', {
        sequenceId: seqId,
        sequenceName: def.name,
        steps: [...state.completedResults],
        totalDuration: lastTime - firstTime,
      });

      this.clearActiveState(seqId);
      return;
    }

    // Emit progress
    this.emit('sequenceProgress', {
      sequenceId: seqId,
      sequenceName: def.name,
      completedStep: state.currentStep - 1,
      totalSteps: def.steps.length,
      gestureResult: result,
    });

    // Set timeout for next step
    this.setStepTimeout(seqId, def, state);
  }

  private createActiveState(
    seqId: string,
    def: GestureSequenceDef,
    firstResult: RecognitionResult,
  ): ActiveSequenceState {
    const state: ActiveSequenceState = {
      currentStep: 1,
      completedResults: [firstResult],
      lastStepTime: firstResult.timestamp,
      timer: null,
    };
    this.activeStates.set(seqId, state);

    // Emit progress for step 0
    this.emit('sequenceProgress', {
      sequenceId: seqId,
      sequenceName: def.name,
      completedStep: 0,
      totalSteps: def.steps.length,
      gestureResult: firstResult,
    });

    // Set timeout for next step
    this.setStepTimeout(seqId, def, state);
    return state;
  }

  private setStepTimeout(
    seqId: string,
    def: GestureSequenceDef,
    state: ActiveSequenceState,
  ): void {
    const timeoutMs = def.timeoutMs ?? 3000;
    state.timer = setTimeout(() => {
      const currentState = this.activeStates.get(seqId);
      if (currentState) {
        this.emitTimeout(seqId, def, currentState.currentStep);
        this.clearActiveState(seqId);
      }
    }, timeoutMs);
  }

  private emitTimeout(
    seqId: string,
    def: GestureSequenceDef,
    completedSteps: number,
  ): void {
    this.emit('sequenceTimeout', {
      sequenceId: seqId,
      sequenceName: def.name,
      completedSteps,
      totalSteps: def.steps.length,
    });
  }

  private clearActiveState(id: string): void {
    const state = this.activeStates.get(id);
    if (state?.timer) clearTimeout(state.timer);
    this.activeStates.delete(id);
  }
}
