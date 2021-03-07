import lexer from 'es-module-lexer';

import {paths, TS_EXTENSION} from '../paths.js';
import {randomInt} from '../utils/random.js';
import {createSwcBuilder} from '../build/swcBuilder.js';
import {BuildConfig} from '../config/buildConfig.js';
import type {BuildContext, TextBuildSource} from '../build/builder.js';
import {DEFAULT_ECMA_SCRIPT_TARGET} from '../build/tsBuildHelpers.js';
import {outputFile, readFile, remove} from './nodeFs.js';
import {basename, dirname, join} from 'path';
import {stripStart} from '../utils/string.js';
import {isExternalNodeModule} from '../utils/module.js';
import {replaceExtension} from '../utils/path.js';
import {SystemLogger} from '../utils/log.js';
import {cyan} from '../colors/terminal.js';

/*

This helper takes a path to a TypeScript source file,
compiles it and all of its dependencies to JavaScript,
writes them out to a temp directory on the filesystem,
imports the entry module,
deletes the temporary directory,
and returns the imported module.

It's motivated by the need to bootstrap a project's builds by reading its TypeScript config,
without resorting to heavy solutions like `ts-node` or relying on config defined in JS or JSON.
In this use case, the returned config includes `BuildConfig`s
which are then used to properly compile the project according to its needs.

Note that if the imported modules rely on non-standard behavior, they will fail to run as expected.
For example, consider a project with a Gro config with a custom builder
that injects globals and `import`s CSS files -
because `importTs` performs a straight translation of TS to JS, this behavior will not work.

For now, this has caused no issues, but users may find their custom code breaks in surprising ways.
We can deal with those issues as they come up.
Most can probably be worked around by splitting modules apart.
See the GitHub issues to report any problems: https://github.com/feltcoop/gro/issues

*/
export const importTs = async (
	sourceId: string,
	buildConfig: BuildConfig,
	tempDir = randomTempDir(),
): Promise<any> => {
	await lexer.init;

	const ctx: BuildContext = {
		log: new SystemLogger([cyan('[importTs]')]),
		buildRootDir: tempDir,
		dev: true,
		sourceMap: false,
		target: DEFAULT_ECMA_SCRIPT_TARGET,
		// TODO these last two aren't needed, maybe the swc compiler's type should explicitly choose which options it uses?
		servedDirs: [],
		state: {},
		buildingSourceFiles: new Set(),
	};
	const buildId = await compileFileAndImports(sourceId, buildConfig, ctx);
	const mod = await import(buildId);
	await remove(tempDir);
	return mod;
};

const compileFileAndImports = async (
	sourceId: string,
	buildConfig: BuildConfig,
	ctx: BuildContext,
): Promise<any> => {
	const dir = dirname(sourceId) + '/'; // TODO hack - see Filer for similar problem
	const source: TextBuildSource = {
		buildable: true,
		encoding: 'utf8',
		contents: await readFile(sourceId, 'utf8'),
		id: sourceId,
		filename: basename(sourceId),
		dir,
		dirBasePath: stripStart(dir, paths.source),
		extension: TS_EXTENSION,
	};
	const builder = createSwcBuilder();
	const {
		builds: [build],
	} = await builder.build(source, buildConfig, ctx);

	const deps = extractDeps(build.contents);
	const internalDeps = deps.filter((dep) => !isExternalNodeModule(dep));
	const internalDepSourceIds = internalDeps.map((dep) =>
		replaceExtension(join(dir, dep), TS_EXTENSION),
	);

	// write the result and compile depdencies in parallel
	await Promise.all([
		outputFile(build.id, build.contents),
		Promise.all(internalDepSourceIds.map((id) => compileFileAndImports(id, buildConfig, ctx))),
	]);

	return build.id;
};

const extractDeps = (contents: string): string[] => {
	const deps: string[] = [];
	const [imports] = lexer.parse(contents);
	for (const {s, e, d} of imports) {
		const start = d > -1 ? s + 1 : s;
		const end = d > -1 ? e - 1 : e;
		const moduleName = contents.substring(start, end);
		if (moduleName === 'import.meta') continue;
		deps.push(moduleName);
	}
	return deps;
};

const randomTempDir = (): string => `${paths.build}temp${randomInt(0, Number.MAX_SAFE_INTEGER)}`;
