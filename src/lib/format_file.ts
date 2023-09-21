import prettier from 'prettier';
import {extname} from 'node:path';

import {load_package_json} from './package_json.js';

export const format_file = async (id: string, content: string): Promise<string> => {
	const parser = infer_parser(id);
	if (!parser) return content;
	const config = (await load_package_json()).prettier as Record<string, any>;
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
		case 'svelte':
		case 'xml': {
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
