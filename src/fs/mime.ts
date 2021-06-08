import type {Flavored} from '@feltcoop/felt/util/types';

/*

This is a minimal set of MIME types
suitable for lightweight inclusion in the browser.
User code can call `addMimeTypeExtension`
to add custom types to the global cache.

Most of the included types are widely supported in browsers
with the exception of some common types and media formats that Firefox supports.

Since 'application/octet-stream' is the default, we don't include it.

References:
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types
- https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Containers

*/

export type MimeType = Flavored<string, 'MimeType'>;
export type FileExtension = Flavored<string, 'FileExtension'>; // excluding leading `.`

// global cache
const mime_typeByExtension = new Map<FileExtension, MimeType>();
const extensionsByMimeType = new Map<MimeType, FileExtension[]>();

export const get_mime_type_by_extension = (ext: FileExtension): MimeType | null =>
	mime_typeByExtension.get(ext) || null;

export const get_extensionsByMimeType = (mime_type: MimeType): FileExtension[] | null =>
	extensionsByMimeType.get(mime_type) || null;

export const get_extensions = () => mime_typeByExtension.keys();
export const getMimeTypes = () => extensionsByMimeType.keys();

// Overrides anything that might already be cached.
export const addMimeTypeExtension = (mime_type: MimeType, extension: FileExtension): void => {
	const existingMimeType = mime_typeByExtension.get(extension);
	if (existingMimeType === mime_type) return;
	if (existingMimeType) removeMimeTypeExtension(extension);
	mime_typeByExtension.set(extension, mime_type);
	extensionsByMimeType.set(
		mime_type,
		extensionsByMimeType.get(mime_type)?.concat(extension) || [extension],
	);
};

// Returns a boolean indicating if the extension was removed for the mime type.
export const removeMimeTypeExtension = (extension: FileExtension): boolean => {
	const mime_type = mime_typeByExtension.get(extension);
	if (!mime_type) return false;
	const newExtensions = extensionsByMimeType.get(mime_type)!.filter((e) => e !== extension);
	if (newExtensions.length) {
		extensionsByMimeType.set(mime_type, newExtensions);
	} else {
		extensionsByMimeType.delete(mime_type);
	}
	mime_typeByExtension.delete(extension);
	return true;
};

(() => {
	const types: [MimeType, FileExtension[]][] = [
		// Since 'application/octet-stream' is the default, we don't include it.
		['application/json', ['json', 'map']],
		['application/schema+json', ['json']],
		['application/schema-instance+json', ['json']],
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
	// Iterate in reverse order so the first declaration of each extension supercedes later ones.
	for (let i = types.length - 1; i >= 0; i--) {
		const [mime_type, extensions] = types[i];
		for (const extension of extensions) {
			addMimeTypeExtension(mime_type, extension);
		}
	}
})();
