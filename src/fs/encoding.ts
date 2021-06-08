export type Encoding = 'utf8' | null; // `null` means binary buffer

const textExtensions = new Set<string>([
	'.ts',
	'.js',
	'.svelte',
	'.css',
	'.html',
	'.md',
	'.json',
	'.txt',
]);

export const infer_encoding = (extension: string): Encoding =>
	textExtensions.has(extension) ? 'utf8' : null;
