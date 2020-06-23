export {arraysEqual} from './deepEqual.js';

export const EMPTY_ARRAY = Object.freeze([]);

export const last = <T>(array: T[]): T | undefined => array[array.length - 1];
