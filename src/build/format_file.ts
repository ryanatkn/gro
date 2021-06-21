import prettier from 'prettier';
import {extname} from 'path';

import {load_package_json} from '../utils/package_json.js';
import type {Filesystem} from '../fs/filesystem.js';

export const format_file = async (fs: Filesystem, id: string, content: string): Promise<string> => {
	const parser = infer_parser(id);
	if (!parser) return content;
	const config = (await load_package_json(fs)).prettier as Record<string, any>;
	return prettier.format(content, {...config, parser});
};

// This is a lot faster than `prettier.getFileInfo`
// because it doesn't have to look at the filesystem.
const infer_parser = (id: string): prettier.BuiltInParserName | null => {
	const extension = extname(id).substring(1);
	switch (extension) {
		case 'ts':
		case 'js': {
			return 'typescript';
		}
		case 'json':
		case 'html':
		case 'css': {
			return extension;
		}
		case 'svelte': {
			return extension as any;
		}
		case 'md': {
			return 'markdown';
		}
		case 'yml': {
			return 'yaml';
		}
		default: {
			return null;
		}
	}
};
