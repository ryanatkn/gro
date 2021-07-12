import type {Flavored} from '@feltcoop/felt/util/types';

// TODO the `extensions` here do not have a leading dot, but elsewhere in Gro they do!

/*

This is a minimal set of MIME types
suitable for lightweight inclusion in the browser.
User code can call `add_mime_type_extension`
to add custom types to the global cache.

Most of the included types are widely supported in browsers
with the exception of some common types and media formats that Firefox supports.

Since 'application/octet-stream' is the default, we don't include it.

References:
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types
- https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Containers

*/

export type Mime_Type = Flavored<string, 'Mime_Type'>;
export type File_Extension = Flavored<string, 'File_Extension'>; // excluding leading `.`

// global cache
const mime_type_by_extension = new Map<File_Extension, Mime_Type>();
const extensions_by_mime_type = new Map<Mime_Type, File_Extension[]>();

export const get_mime_type_by_extension = (ext: File_Extension): Mime_Type | null =>
	mime_type_by_extension.get(ext) || null;

export const get_extensions_by_mime_type = (mime_type: Mime_Type): File_Extension[] | null =>
	extensions_by_mime_type.get(mime_type) || null;

export const get_extensions = () => mime_type_by_extension.keys();
export const get_mime_types = () => extensions_by_mime_type.keys();

// Overrides anything that might already be cached.
export const add_mime_type_extension = (mime_type: Mime_Type, extension: File_Extension): void => {
	const existing_mime_type = mime_type_by_extension.get(extension);
	if (existing_mime_type === mime_type) return;
	if (existing_mime_type) remove_mime_type_extension(extension);
	mime_type_by_extension.set(extension, mime_type);
	extensions_by_mime_type.set(
		mime_type,
		extensions_by_mime_type.get(mime_type)?.concat(extension) || [extension],
	);
};

// Returns a boolean indicating if the extension was removed for the mime type.
export const remove_mime_type_extension = (extension: File_Extension): boolean => {
	const mime_type = mime_type_by_extension.get(extension);
	if (!mime_type) return false;
	const new_extensions = extensions_by_mime_type.get(mime_type)!.filter((e) => e !== extension);
	if (new_extensions.length) {
		extensions_by_mime_type.set(mime_type, new_extensions);
	} else {
		extensions_by_mime_type.delete(mime_type);
	}
	mime_type_by_extension.delete(extension);
	return true;
};

(() => {
	const types: [Mime_Type, File_Extension[]][] = [
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
			add_mime_type_extension(mime_type, extension);
		}
	}
})();
