/** Fixed-size rolling window of samples with mean and max. Allocation-free after construction. */
export class RollingStat {
  private readonly samples: Float64Array;
  private index = 0;
  private count = 0;

  constructor(size: number) {
    this.samples = new Float64Array(size);
  }

  push(value: number): void {
    this.samples[this.index] = value;
    this.index = (this.index + 1) % this.samples.length;
    if (this.count < this.samples.length) this.count++;
  }

  mean(): number {
    if (this.count === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.count; i++) sum += this.samples[i] ?? 0;
    return sum / this.count;
  }

  max(): number {
    let max = 0;
    for (let i = 0; i < this.count; i++) max = Math.max(max, this.samples[i] ?? 0);
    return max;
  }

  get size(): number {
    return this.count;
  }
}
