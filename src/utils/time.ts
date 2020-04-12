import {round} from './math.js';

export interface Stopwatch {
	(reset?: boolean): number;
}

// tracks elapsed time in milliseconds
export const createStopwatch = (decimals = 2): Stopwatch => {
	let start = process.hrtime.bigint();
	return (reset = false) => {
		const end = process.hrtime.bigint();
		const elapsed = round(Number(end - start) / 1_000_000, decimals);
		if (reset) start = end;
		return elapsed;
	};
};

const DEFAULT_KEY = Symbol();

export class Timings {
	private readonly timings = new Map<any, number>();
	private readonly stopwatches = new Map<any, Stopwatch>();

	constructor(public readonly decimals?: number) {}

	start(
		key: any = DEFAULT_KEY,
		replace = false,
		decimals = this.decimals,
	): void {
		if (!replace && this.stopwatches.has(key)) {
			throw Error(`Timing key is already in use: ${key}`);
		}
		this.stopwatches.set(key, createStopwatch(decimals));
	}
	stop(key: any = DEFAULT_KEY): number {
		const stopwatch = this.stopwatches.get(key);
		if (!stopwatch) {
			throw Error(`Unknown timing key cannot be stopped: ${key}`);
		}
		this.stopwatches.delete(key);
		const timing = stopwatch();
		this.timings.set(key, timing);
		return timing;
	}
	get(key: any = DEFAULT_KEY): number {
		const timing = this.timings.get(key);
		if (timing === undefined) {
			throw new Error(`Timing key not found: ${key}`);
		}
		return timing;
	}
	// clear(): void {
	// 	this.stopwatches.clear();
	// 	this.timings.clear();
	// }
	// toJSON() {} ?????
}
