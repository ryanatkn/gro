/*

This is a minimal set of MIME types
suitable for lightweight inclusion in the browser.
User code can call `addMimeTypeExtension`
to add custom types to the global cache.

Most of the included types are widely supported in browsers
with the exception of some very common types and
media formats that Firefox supports.

Since 'application/octet-stream' is the default, we don't include it.

References:
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types
- https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Containers

*/

// global cache
const mimeTypeByExtension = new Map<string, string>();
const extensionsByMimeType = new Map<string, string[]>();

export const getMimeTypeByExtension = (ext: string): string | null =>
	mimeTypeByExtension.get(ext) || null;

export const getExtensionsByMimeType = (mimeType: string): string[] | null =>
	extensionsByMimeType.get(mimeType) || null;

// Overrides anything that might already be cached.
export const addMimeTypeExtension = (
	mimeType: string,
	extension: string,
): void => {
	const existingMimeType = mimeTypeByExtension.get(extension);
	if (existingMimeType === mimeType) return;
	if (existingMimeType) removeMimeTypeExtension(extension);
	mimeTypeByExtension.set(extension, mimeType);
	extensionsByMimeType.set(
		mimeType,
		extensionsByMimeType.get(mimeType)?.concat(extension) || [extension],
	);
};

// Returns a boolean indicating if the extension was removed for the mime type.
export const removeMimeTypeExtension = (extension: string): boolean => {
	const mimeType = mimeTypeByExtension.get(extension);
	if (!mimeType) return false;
	const newExts = extensionsByMimeType
		.get(mimeType)!
		.filter(e => e !== extension);
	if (newExts.length) {
		extensionsByMimeType.set(mimeType, newExts);
	} else {
		extensionsByMimeType.delete(mimeType);
	}
	mimeTypeByExtension.delete(extension);
	return true;
};

(() => {
	const types: [string, string[]][] = [
		// Since 'application/octet-stream' is the default, we don't include it.
		['application/json', ['json']],
		['application/ld+json', ['jsonld']],
		['application/xml', ['xml']],
		['application/xhtml+xml', ['xhtml']],
		['application/pdf', ['pdf']],
		['application/ogg', ['ogx']],
		['application/gzip', ['gz']],
		['application/zip', ['zip']],
		['application/epub+zip', ['epub']],

		['text/plain', ['txt', 'log']],
		['text/css', ['css']],
		['text/html', ['html', 'htm']],
		['text/javascript', ['js', 'mjs']],
		['text/csv', ['csv']],

		['audio/wav', ['wav']],
		['audio/webm', ['weba']],
		['audio/ogg', ['oga', 'ogg']],
		['audio/mpeg', ['mp3']],
		['audio/midi', ['mid', 'midi']],
		['audio/flac', ['flac']],
		['audio/mp4', ['m4a', 'mp4a']],

		['video/webm', ['webm']],
		['video/ogg', ['ogv']],
		['video/mpeg', ['mpeg']],
		['video/mp4', ['mp4', 'mp4v', 'mpg4']],

		['font/otf', ['otf']],
		['font/ttf', ['ttf']],
		['font/woff', ['woff']],
		['font/woff2', ['woff2']],
		['font/collection', ['ttc']],

		['image/apng', ['apng']],
		['image/bmp', ['bmp']],
		['image/gif', ['gif']],
		['image/x-icon', ['ico']],
		['image/jpeg', ['jpg', 'jpeg']],
		['image/png', ['png']],
		['image/svg+xml', ['svg']],
		['image/tiff', ['tif', 'tiff']],
		['image/webp', ['webp']],
	];
	for (const [mimeType, extensions] of types) {
		for (const extension of extensions) {
			addMimeTypeExtension(mimeType, extension);
		}
	}
})();
