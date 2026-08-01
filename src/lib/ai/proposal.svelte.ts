/**
 * Proposal state: the gate between AI output and the document.
 *
 * `state.svelte.ts` enforces one invariant — every write to the diagram goes
 * through its update functions. AI output must not bypass that, and it must not
 * silently overwrite work the user can't get back. So a task writes here, and
 * only `acceptProposal` calls `updateCode`. That gives accept/reject, a
 * before/after preview, and a single place to cancel an in-flight request.
 */

import { updateCode, validatedState } from '../util/state.svelte';
import type { TaskProgress, TaskResult } from './tasks';

export type ProposalStatus = 'error' | 'idle' | 'ready' | 'running';

export interface ProposalState {
  /** Attempt number of the running task; >1 means a parse retry is underway. */
  attempt: number;
  /** Diagram source as it stood before the task started, for diffing/undo. */
  baseline: string;
  /** Proposed source: streaming while running, final once ready. */
  code: string;
  error?: string;
  phase?: TaskProgress['phase'];
  status: ProposalStatus;
}

const initial: ProposalState = { attempt: 0, baseline: '', code: '', status: 'idle' };

let current = $state.raw<ProposalState>(initial);
let controller: AbortController | undefined;

export const proposal = {
  get current(): ProposalState {
    return current;
  },
  /** True while a task is streaming or retrying. */
  get isRunning(): boolean {
    return current.status === 'running';
  }
};

/**
 * Runs an AI task, streaming its output into the proposal.
 *
 * Any task already in flight is cancelled first, so a second request can never
 * interleave its deltas with the first.
 */
export const runProposal = async (
  task: (options: {
    onProgress: (progress: TaskProgress) => void;
    signal: AbortSignal;
  }) => Promise<TaskResult>
): Promise<void> => {
  cancelProposal();
  controller = new AbortController();
  const { signal } = controller;
  const baseline = validatedState.current.code;
  current = { attempt: 1, baseline, code: '', phase: 'streaming', status: 'running' };

  try {
    const result = await task({
      onProgress: ({ attempt, code, phase }) => {
        if (signal.aborted) {
          return;
        }
        current = { ...current, attempt, code, phase };
      },
      signal
    });
    if (signal.aborted) {
      return;
    }
    current = {
      attempt: result.attempts,
      baseline,
      code: result.code,
      error: result.error,
      // A diagram that never parsed is still offered, since a near-miss is
      // usually easier to fix by hand than to re-prompt.
      status: result.error ? 'error' : 'ready'
    };
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    current = {
      ...current,
      error: error instanceof Error ? error.message : String(error),
      status: 'error'
    };
  } finally {
    if (controller?.signal === signal) {
      controller = undefined;
    }
  }
};

/** Commits the proposal — the only path from AI output into the document. */
export const acceptProposal = (): void => {
  if (!current.code || current.status === 'running') {
    return;
  }
  updateCode(current.code, { updateDiagram: true });
  current = initial;
};

/** Restores the pre-task diagram after an accept. */
export const undoProposal = (baseline: string): void => {
  updateCode(baseline, { updateDiagram: true });
};

export const dismissProposal = (): void => {
  cancelProposal();
  current = initial;
};

export const cancelProposal = (): void => {
  controller?.abort();
  controller = undefined;
  if (current.status === 'running') {
    current = { ...current, status: 'idle' };
  }
};
