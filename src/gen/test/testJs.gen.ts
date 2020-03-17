import {Gen} from '../gen.js';

export const gen: Gen = () => {
	const message = 'oh hi!';
	return `console.log('${message}')`;
};
