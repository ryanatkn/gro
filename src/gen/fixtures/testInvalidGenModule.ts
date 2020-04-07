import {Gen} from '../gen.js';

interface InvalidGenModule {
	gen: Gen;
}

export const gen: InvalidGenModule = {
	gen: () => {
		const message = 'oh hi!';
		return `console.log('${message}')`;
	},
};
