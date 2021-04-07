import type {Lazy} from './function.js';
import {lazy} from './function.js';

// TODO validation?

interface ToEnvString {
	(key: string): string | undefined;
	(key: string, fallback: string | Lazy<string>): string;
}

export const toEnvString: ToEnvString = (key: string, fallback?: string | Lazy<string>) =>
	(key in process.env && process.env[key]) || ((fallback && lazy(fallback)) as string); // TODO fix type casting

interface ToEnvNumber {
	(key: string): number | undefined;
	(key: string, fallback: number | Lazy<number>): number;
}

export const toEnvNumber: ToEnvNumber = (key: string, fallback?: number | Lazy<number>) =>
	(key in process.env && Number(process.env[key])) || (fallback && (lazy(fallback) as any)); // TODO fix type casting
