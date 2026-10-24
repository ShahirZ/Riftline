/**
 * Fixed-timestep accumulator. Turns variable real frame times into a whole number of fixed
 * simulation steps plus an interpolation factor for rendering between the last two sim states.
 *
 * Long stalls (tab switches, breakpoints) are clamped so the sim never tries to catch up on
 * seconds of backlog in one frame.
 */
export class FixedStepper {
  /** Interpolation factor in [0, 1): how far real time is past the latest sim tick. */
  alpha = 0;
  /** Steps discarded so far because a frame exceeded maxStepsPerFrame. */
  droppedSteps = 0;
  private accumulator = 0;

  constructor(
    readonly dt: number,
    readonly maxStepsPerFrame: number,
    readonly maxFrameTime = 0.25,
  ) {}

  /** Feeds real elapsed seconds and returns how many fixed steps to run this frame. */
  advance(elapsedSeconds: number): number {
    const elapsed = Math.min(Math.max(elapsedSeconds, 0), this.maxFrameTime);
    this.accumulator += elapsed;
    // The epsilon absorbs float error, e.g. six frames of 1/360 s must yield exactly one step.
    let steps = Math.floor(this.accumulator / this.dt + 1e-7);
    this.accumulator = Math.max(this.accumulator - steps * this.dt, 0);
    if (steps > this.maxStepsPerFrame) {
      this.droppedSteps += steps - this.maxStepsPerFrame;
      steps = this.maxStepsPerFrame;
    }
    this.alpha = Math.min(this.accumulator / this.dt, 0.999999);
    return steps;
  }

  reset(): void {
    this.accumulator = 0;
    this.alpha = 0;
  }
}
