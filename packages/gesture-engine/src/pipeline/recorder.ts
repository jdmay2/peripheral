/**
 * Gesture recorder for template collection.
 *
 * 5-step recording workflow:
 * 1. Name the gesture
 * 2. Watch animated demonstration
 * 3. 3-2-1 countdown + record (2–3 seconds per rep)
 * 4. Quality review (overlaid waveforms + consistency score)
 * 5. Assign action
 *
 * Records IMU data into GestureTemplates, computes DTW-based
 * consistency scores, and requires ≥70% consistency to accept.
 */

import type {
  IMUSample,
  IMUAxes,
  GestureTemplate,
  GestureClass,
  GestureDefinition,
  RecordingSession,
} from '../types';
import { DTWClassifier } from '../classifiers/dtw';
import { extractFeatures } from '../features';
import { EventEmitter } from '../utils/event-emitter';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface RecorderConfig {
  /** Duration of each recording in seconds. Default: 2.5. */
  recordingDuration: number;
  /** Number of repetitions to record. Default: 5. */
  targetRepetitions: number;
  /** Minimum repetitions required to save. Default: 3. */
  minRepetitions: number;
  /** Minimum consistency score to accept (0–1). Default: 0.7. */
  minConsistency: number;
  /** Countdown duration in seconds. Default: 3. */
  countdownDuration: number;
  /** Sample rate of incoming data. Default: 50. */
  sampleRate: number;
  /** Number of axes. Default: 6. */
  axes: IMUAxes;
  /** Auto-detect gesture boundaries (trim silence). Default: true. */
  autoTrim: boolean;
  /** SMA threshold for auto-trim. Default: 1.0. */
  trimThreshold: number;
}

const DEFAULT_RECORDER_CONFIG: RecorderConfig = {
  recordingDuration: 2.5,
  targetRepetitions: 5,
  minRepetitions: 3,
  minConsistency: 0.7,
  countdownDuration: 3,
  sampleRate: 50,
  axes: 6,
  autoTrim: true,
  trimThreshold: 1.0,
};

// ─── Events ──────────────────────────────────────────────────────────────────

export interface RecorderEvents {
  /** Recording phase changed. */
  phaseChanged: RecorderPhase;
  /** Countdown tick (seconds remaining). */
  countdownTick: number;
  /** Recording started for a repetition. */
  recordingStarted: { index: number; total: number };
  /** Recording completed for a repetition. */
  recordingCompleted: {
    index: number;
    total: number;
    template: GestureTemplate;
    duration: number;
  };
  /** All recordings finished, consistency computed. */
  sessionCompleted: {
    session: RecordingSession;
    gestureClass: GestureClass | null;
  };
  /** A single repetition was discarded (too short, no motion). */
  repetitionDiscarded: { index: number; reason: string };
  /** Error during recording. */
  error: Error;
}

export type RecorderPhase =
  | 'idle'
  | 'countdown'
  | 'recording'
  | 'processing'
  | 'review'
  | 'complete';

// ─── Recorder ────────────────────────────────────────────────────────────────

export class GestureRecorder extends EventEmitter<RecorderEvents> {
  private config: RecorderConfig;
  private dtw = new DTWClassifier({ rotationInvariant: true });

  private phase: RecorderPhase = 'idle';
  private currentGestureId: string | null = null;
  private currentGestureName: string | null = null;

  private recordingBuffer: IMUSample[] = [];
  private recordedTemplates: GestureTemplate[] = [];
  private currentRepIndex = 0;
  private isCapturing = false;

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private recordingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config?: Partial<RecorderConfig>) {
    super();
    this.config = { ...DEFAULT_RECORDER_CONFIG, ...config };
  }

  /** Get current recorder phase. */
  getPhase(): RecorderPhase {
    return this.phase;
  }

  /** Get current recording session state. */
  getSession(): RecordingSession | null {
    if (!this.currentGestureId) return null;
    return {
      gestureId: this.currentGestureId,
      templates: [...this.recordedTemplates],
      targetCount: this.config.targetRepetitions,
      currentIndex: this.currentRepIndex,
      isRecording: this.isCapturing,
      consistencyScore: this.computeCurrentConsistency(),
    };
  }

  /**
   * Start a new recording session for a gesture.
   * Begins with countdown before first recording.
   */
  startSession(gestureId: string, gestureName: string): void {
    this.stopSession();

    this.currentGestureId = gestureId;
    this.currentGestureName = gestureName;
    this.recordedTemplates = [];
    this.currentRepIndex = 0;

    this.startNextRecording();
  }

  /**
   * Feed IMU samples during recording.
   * Call this continuously while the session is active.
   */
  feedSamples(samples: IMUSample[]): void {
    if (!this.isCapturing) return;
    this.recordingBuffer.push(...samples);
  }

  /**
   * Manually trigger end of current recording (instead of waiting for timer).
   */
  endCurrentRecording(): void {
    if (!this.isCapturing) return;
    this.finishRecording();
  }

  /**
   * Discard the most recently recorded repetition.
   */
  discardLastRepetition(): void {
    if (this.recordedTemplates.length > 0) {
      this.recordedTemplates.pop();
      this.currentRepIndex = this.recordedTemplates.length;
    }
  }

  /**
   * Record another repetition (after review / discard).
   */
  recordAnother(): void {
    if (this.phase === 'review' || this.phase === 'processing') {
      this.startNextRecording();
    }
  }

  /**
   * Finalize the session and return the gesture class.
   * Returns null if consistency is too low.
   */
  finalizeSession(definition?: GestureDefinition): GestureClass | null {
    const session = this.getSession();
    if (!session || session.templates.length < this.config.minRepetitions) {
      return null;
    }

    const consistency = this.computeCurrentConsistency();

    const gestureClass: GestureClass = {
      definition: definition ?? {
        id: this.currentGestureId!,
        name: this.currentGestureName!,
      },
      templates: [...this.recordedTemplates],
      isReady: (consistency ?? 0) >= this.config.minConsistency,
      minTemplates: this.config.minRepetitions,
    };

    this.setPhase('complete');
    this.emit('sessionCompleted', {
      session: { ...session, consistencyScore: consistency },
      gestureClass: gestureClass.isReady ? gestureClass : null,
    });

    return gestureClass.isReady ? gestureClass : null;
  }

  /** Cancel and reset the recording session. */
  stopSession(): void {
    this.clearTimers();
    this.isCapturing = false;
    this.recordingBuffer = [];
    this.recordedTemplates = [];
    this.currentGestureId = null;
    this.currentGestureName = null;
    this.currentRepIndex = 0;
    this.setPhase('idle');
  }

  // ─── Recording flow ──────────────────────────────────────────────────

  private startNextRecording(): void {
    // Countdown phase
    this.setPhase('countdown');
    let remaining = this.config.countdownDuration;
    this.emit('countdownTick', remaining);

    this.countdownTimer = setInterval(() => {
      remaining--;
      this.emit('countdownTick', remaining);

      if (remaining <= 0) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.beginCapture();
      }
    }, 1000);
  }

  private beginCapture(): void {
    this.isCapturing = true;
    this.recordingBuffer = [];
    this.setPhase('recording');

    this.emit('recordingStarted', {
      index: this.currentRepIndex,
      total: this.config.targetRepetitions,
    });

    // Auto-stop after recording duration
    this.recordingTimer = setTimeout(() => {
      this.finishRecording();
    }, this.config.recordingDuration * 1000);
  }

  private finishRecording(): void {
    if (this.recordingTimer) clearTimeout(this.recordingTimer);
    this.recordingTimer = null;
    this.isCapturing = false;
    this.setPhase('processing');

    const samples = [...this.recordingBuffer];
    this.recordingBuffer = [];

    // Validate recording
    if (samples.length < 10) {
      this.emit('repetitionDiscarded', {
        index: this.currentRepIndex,
        reason: 'too_few_samples',
      });
      this.proceedAfterRecording();
      return;
    }

    // Auto-trim silence
    const trimmed = this.config.autoTrim
      ? this.trimSilence(samples)
      : samples;

    if (trimmed.length < 10) {
      this.emit('repetitionDiscarded', {
        index: this.currentRepIndex,
        reason: 'no_motion_detected',
      });
      this.proceedAfterRecording();
      return;
    }

    // Build template
    const template: GestureTemplate = {
      gestureId: this.currentGestureId!,
      samples: trimmed,
      features: extractFeatures(
        {
          samples: trimmed,
          startTime: trimmed[0]!.timestamp,
          endTime: trimmed[trimmed.length - 1]!.timestamp,
          sampleRate: this.config.sampleRate,
          axes: this.config.axes,
        },
        false,
      ),
      magnitudeSeries: trimmed.map((s) =>
        Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az),
      ),
      recordedAt: Date.now(),
      duration: trimmed[trimmed.length - 1]!.timestamp - trimmed[0]!.timestamp,
      sampleRate: this.config.sampleRate,
    };

    this.recordedTemplates.push(template);

    this.emit('recordingCompleted', {
      index: this.currentRepIndex,
      total: this.config.targetRepetitions,
      template,
      duration: template.duration,
    });

    this.currentRepIndex++;
    this.proceedAfterRecording();
  }

  private proceedAfterRecording(): void {
    if (this.currentRepIndex < this.config.targetRepetitions) {
      // More recordings needed
      this.startNextRecording();
    } else {
      // All recordings done — move to review
      this.setPhase('review');
    }
  }

  // ─── Auto-trim ──────────────────────────────────────────────────────

  private trimSilence(samples: IMUSample[]): IMUSample[] {
    const threshold = this.config.trimThreshold;
    let firstActive = -1;
    let lastActive = -1;

    for (let i = 0; i < samples.length; i++) {
      const sma =
        Math.abs(samples[i]!.ax) +
        Math.abs(samples[i]!.ay) +
        Math.abs(samples[i]!.az);
      if (sma > threshold) {
        if (firstActive === -1) firstActive = i;
        lastActive = i;
      }
    }

    if (firstActive === -1) return [];

    // Pad 50ms on each side for context
    const padSamples = Math.round(this.config.sampleRate * 0.05);
    const start = Math.max(0, firstActive - padSamples);
    const end = Math.min(samples.length - 1, lastActive + padSamples);

    return samples.slice(start, end + 1);
  }

  // ─── Consistency scoring ────────────────────────────────────────────

  private computeCurrentConsistency(): number | null {
    if (this.recordedTemplates.length < 2) return null;
    return this.dtw.computeConsistency(this.recordedTemplates);
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private setPhase(phase: RecorderPhase): void {
    this.phase = phase;
    this.emit('phaseChanged', phase);
  }

  private clearTimers(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }
  }
}
