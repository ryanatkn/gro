import {type Gen} from '../gen.js';

export interface SomeTestObject {
	a: number;
	b: string;
	c?: Gen;
}

export type SomeTestPrimitive = number;
