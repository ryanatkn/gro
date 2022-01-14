import prettier from 'prettier';
import {extname} from 'path';

import {loadPackageJson} from '../utils/packageJson.js';
import {type Filesystem} from '../fs/filesystem.js';

export const formatFile = async (fs: Filesystem, id: string, content: string): Promise<string> => {
	const parser = inferParser(id);
	if (!parser) return content;
	const config = (await loadPackageJson(fs)).prettier as Record<string, any>;
	return prettier.format(content, {...config, parser});
};

// This is a lot faster than `prettier.getFileInfo`
// because it doesn't have to look at the filesystem.
const inferParser = (id: string): prettier.BuiltInParserName | null => {
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
