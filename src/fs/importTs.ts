import {paths} from '../paths.js';
import {randomInt} from '../utils/random.js';

const randomTempDir = (): string => `${paths.build}temp${randomInt(0, Number.MAX_SAFE_INTEGER)}`;

/*

This helper takes a path to a TypeScript source file,
compiles it and all of its dependencies to JavaScript,
writes them out to a temp directory on the filesystem,
imports the entry module and returns it,
and then deletes the temporary directory.

It's motivated by the need to bootstrap a project's builds by reading its TypeScript config,
without resorting to heavy solutions like `ts-node` or relying on config defined in JS or JSON.
In this use case, the returned config includes `BuildConfig`s
which are then used to properly compile the project according to its needs.

Note that if the imported modules rely on non-standard behavior, they will fail to run as expected.
For example, consider a project with a Gro config with a custom compiler
that injects globals, replace some values at build time, and `import`s CSS files -
none of this will work.

For now, this has caused no issues, but users may find their custom code breaks in surprising ways.
We can deal with those issues as they come up.
See the GitHub issues to report any problems: https://github.com/feltcoop/gro/issues

*/
export const importTs = (sourceId: string, tempDir = randomTempDir()): Promise<any> => {
	console.log('import typescript...', sourceId);
	console.log('tempDir', tempDir);
	return import(sourceId);
};
