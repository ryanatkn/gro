import {round} from './mathUtils';

export const timeTracker = (decimals = 2) => {
	let start = process.hrtime.bigint();
	return (reset = true): number => {
		const end = process.hrtime.bigint();
		const elapsed = round(Number(end - start) / 1_000_000, decimals);
		if (reset) start = end;
		return elapsed;
	};
};
