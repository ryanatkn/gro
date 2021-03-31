import type {Lazy} from './lazy.js';
import {lazy} from './lazy.js';

// TODO validation?

interface StringFromEnv {
	(key: string): string | undefined;
	(key: string, fallback: string | Lazy<string>): string;
}

export const stringFromEnv: StringFromEnv = (key: string, fallback?: string | Lazy<string>) =>
	(key in process.env && process.env[key]) || ((fallback && lazy(fallback)) as string); // TODO fix type casting

interface NumberFromEnv {
	(key: string): number | undefined;
	(key: string, fallback: number | Lazy<number>): number;
}

export const numberFromEnv: NumberFromEnv = (key: string, fallback?: number | Lazy<number>) =>
	(key in process.env && Number(process.env[key])) || (fallback && (lazy(fallback) as any)); // TODO fix type casting
