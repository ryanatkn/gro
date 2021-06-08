export type Encoding = 'utf8' | null; // `null` means binary buffer

const text_extensions = new Set<string>([
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
	text_extensions.has(extension) ? 'utf8' : null;
