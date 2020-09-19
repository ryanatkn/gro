import prettier from 'prettier';
import {extname} from 'path';

import {getPackageJson} from '../project/pkg.js';

export const formatFile = (id: string, contents: string): string => {
	const parser = inferParser(id);
	if (!parser) return contents;
	const config = getPackageJson().prettier as Obj;
	return prettier.format(contents, {...config, parser});
};

// This is a lot faster than `prettier.getFileInfo`
// because it doesn't have to look at the filesystem.
const inferParser = (id: string): prettier.BuiltInParserName | null => {
	const extension = extname(id).slice(1);
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
