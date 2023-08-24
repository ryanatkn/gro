import {printSpawnResult, spawn} from '@feltjs/util/process.js';
import {EMPTY_OBJECT} from '@feltjs/util/object.js';
import {replaceExtension, stripTrailingSlash} from '@feltjs/util/path.js';
import {stripStart} from '@feltjs/util/string.js';
import {identity} from '@feltjs/util/function.js';
import esbuild from 'esbuild';

import type {Adapter} from './adapt.js';
import {TaskError} from '../task/task.js';
import {copyDist} from './utils.js';
import {
	sourceIdToBasePath,
	toBuildExtension,
	toImportId,
	TS_TYPEMAP_EXTENSION,
	TS_TYPE_EXTENSION,
	DIST_DIRNAME,
	LIB_DIR,
} from '../paths.js';
import {NODE_LIBRARY_BUILD_NAME} from '../build/buildConfigDefaults.js';
import {type BuildName, printBuildConfigLabel, toInputFiles} from '../build/buildConfig.js';
import type {PathStats} from '../fs/pathData.js';
import type {PackageJson} from '../utils/packageJson.js';
import type {Filesystem} from '../fs/filesystem.js';
import {toDefaultEsbuildBundleOptions} from '../build/groBuilderEsbuildUtils.js';
import {printCommandArgs, serializeArgs, toForwardedArgs} from '../utils/args.js';

const name = '@feltjs/gro-adapter-node-library';

// In normal circumstances, this adapter expects to handle
// only code scoped to `src/lib`, following SvelteKit conventions.
// It also supports Gro's current usecase that doesn't put anything under `lib/`,
// but that functionality may be removed to have one hardcoded happy path.
// In the normal case, the final package is flattened to the root directory,
// so `src/lib/index.ts` becomes `index.ts`.
// Import paths are *not* remapped by the adapter,
// but Gro's build process does map `$lib/` and `src/` to relative paths.
// This means all library modules must be under `src/lib` to work without additional transformation.
// This function converts the build config's source file ids to the flattened base paths:
const sourceIdToLibraryBasePath = (sourceId: string, libraryRebasePath: string): string => {
	const basePath = sourceIdToBasePath(sourceId);
	if (!basePath.startsWith(libraryRebasePath)) {
		throw Error(
			`Source file does not start with libraryRebasePath ${libraryRebasePath}: ${basePath}`,
		);
	}
	return stripStart(toBuildExtension(basePath, false), libraryRebasePath);
};

// TODO maybe add a `files` option to explicitly include source files,
// and fall back to inferring from the build config
// (it should probably accept the normal include/exclude filters from @rollup/pluginutils)

export interface Options {
	buildName: BuildName; // defaults to 'library'
	dir: string; // defaults to `dist/${buildName}`
	packageJson: string; // defaults to 'package.json'
	pack: boolean; // TODO temp hack for Gro's build -- treat the dist as a package to be published - defaults to true
	libraryRebasePath: string; // defaults to 'lib/', pass '' to avoid remapping -- TODO do we want to remove this after Gro follows SvelteKit conventions?
	bundle: boolean; // defaults to `false`
	mapBundleOptions: (options: esbuild.BuildOptions) => esbuild.BuildOptions;
}

export interface AdapterArgs {} // eslint-disable-line @typescript-eslint/no-empty-interface

export const createAdapter = ({
	buildName = NODE_LIBRARY_BUILD_NAME,
	dir = `${DIST_DIRNAME}/${buildName}`,
	libraryRebasePath = LIB_DIR,
	packageJson = 'package.json',
	pack = true,
	bundle = false,
	mapBundleOptions = identity,
}: Partial<Options> = EMPTY_OBJECT): Adapter<AdapterArgs> => {
	const outputDir = stripTrailingSlash(dir);
	return {
		name,
		adapt: async ({config, fs, dev, log, timings}) => {
			const buildConfig = config.builds.find((b) => b.name === buildName);
			if (!buildConfig) {
				throw Error(`Unknown build config: ${buildName}`);
			}

			// TODO BLOCK use `svelte-kit package`
			const serializedArgs = [
				'svelte-kit',
				'package',
				...serializeArgs(toForwardedArgs('svelte-kit')),
			];
			log.info(printCommandArgs(serializedArgs));
			await spawn('npx', serializedArgs);

			// TODO BLOCK try to move Gro's dist to `.gro` to resolve the conflict

			// const files = toInputFiles(buildConfig.input);

			// if (bundle) {
			// 	const timingToBundle = timings.start('bundle with rollup');
			// 	// TODO use `filters` to select the others..right?
			// 	if (!files.length) {
			// 		log.debug('no input files in', printBuildConfigLabel(buildConfig));
			// 		return;
			// 	}
			// 	const input = files.map((sourceId) => toImportId(sourceId, dev, buildConfig.name));
			// 	log.info('bundling', printBuildConfigLabel(buildConfig), outputDir, files);
			// 	await esbuild.build(
			// 		mapBundleOptions({
			// 			...toDefaultEsbuildBundleOptions(dev, config.target, config.sourcemap),
			// 			bundle: true,
			// 			entryPoints: input,
			// 			outfile: outputDir + '/index.js',
			// 		}),
			// 	);
			// 	timingToBundle();
			// }

			// const timingToCopyDist = timings.start('copy build to dist');
			// const filter = bundle ? bundledDistFilter : undefined;
			// await copyDist(fs, buildConfig, dev, outputDir, log, filter, pack, libraryRebasePath);
			// timingToCopyDist();

			let pkg: PackageJson;
			try {
				pkg = JSON.parse(await fs.readFile(packageJson, 'utf8'));
			} catch (err) {
				throw Error(`Adapter ${name} failed to load packageJson at path ${packageJson}: ${err}`);
			}

			// If the output is treated as a package, it needs some special handling to get it ready.
			// if (pack) {
			// 	const timingToPackDist = timings.start('pack dist');
			// 	// copy files from the project root to the dist, but don't overwrite anything in the build
			// 	await Promise.all(
			// 		(
			// 			await fs.readDir('.')
			// 		)
			// 			.map((path): null | Promise<void> => {
			// 				if (PACKAGE_FILES.has(path) || OTHER_PACKAGE_FILES.has(path)) {
			// 					return fs.copy(path, `${outputDir}/${path}`, {overwrite: false});
			// 				}
			// 				return null;
			// 			})
			// 			.filter(Boolean),
			// 	);

			// 	// update package.json with computed values
			// 	pkg.files = await toPkgFiles(fs, outputDir);
			// 	pkg.main = toPkgMain(pkg);
			// 	if (files.find((f) => f.endsWith('.svelte'))) {
			// 		pkg.svelte = pkg.main;
			// 	}
			// 	pkg.types = replaceExtension(pkg.main, TS_TYPE_EXTENSION);
			// 	pkg.exports = toPkgExports(pkg.main, files, libraryRebasePath);

			// 	// write the new package.json
			// 	await fs.writeFile(`${outputDir}/package.json`, JSON.stringify(pkg, null, 2), 'utf8');

			// 	timingToPackDist();
			// }

			// `npm link`
			if (pkg.bin) {
				const timingToNpmLink = timings.start('npm link');
				await Promise.all(
					Object.values(pkg.bin).map(async (binPath) => {
						const chmodResult = await spawn('chmod', ['+x', binPath]);
						if (!chmodResult.ok) log.error(`CLI chmod failed with code ${chmodResult.code}`);
					}),
				);
				log.info(`linking`);
				const linkResult = await spawn('npm', ['link', '-f']);
				if (!linkResult.ok) {
					throw new TaskError(`Failed to link. ${printSpawnResult(linkResult)}`);
				}
				timingToNpmLink();
			}
		},
	};
};

const bundledDistFilter = (id: string, stats: PathStats): boolean =>
	stats.isDirectory() ? true : id.endsWith(TS_TYPE_EXTENSION) || id.endsWith(TS_TYPEMAP_EXTENSION);

// these can be any case and optionally end with `.md`
const toPossibleFilenames = (paths: string[]): string[] =>
	paths.flatMap((path) => {
		const lower = path.toLowerCase();
		const upper = path.toUpperCase();
		return [lower, `${lower}.md`, upper, `${upper}.md`];
	});

// these are a subset of the files npm includes by default --
// unlike npm, the only extension we support is `.md`
const PACKAGE_FILES = new Set(['package.json'].concat(toPossibleFilenames(['readme', 'license'])));
const OTHER_PACKAGE_FILES = new Set(
	toPossibleFilenames(['changelog', 'contributing', 'governance', 'tsconfig.json']),
);

const toPkgFiles = async (fs: Filesystem, dir: string): Promise<string[]> => {
	const pkgFiles: string[] = [];
	const dirPaths = await fs.readDir(dir);
	for (const path of dirPaths) {
		if (!PACKAGE_FILES.has(path)) {
			pkgFiles.push(path);
		}
	}
	return pkgFiles;
};

const toPkgMain = (pkg: PackageJson): string => {
	const pkgMain = pkg.main;
	if (!pkgMain) {
		return './index.js';
	}
	if (!pkgMain.startsWith('./')) {
		// this isn't needed for `pkg.main`, but it is for `pkg.exports`, so just normalize
		return `./${pkgMain}`;
	}
	return pkgMain;
};

const toPkgExports = (
	pkgMain: string,
	files: string[],
	libraryRebasePath: string,
): PackageJson['exports'] => {
	const pkgExports: PackageJson['exports'] = {
		'.': pkgMain,
		'./package.json': './package.json',
	};
	for (const sourceId of files) {
		const path = `./${sourceIdToLibraryBasePath(sourceId, libraryRebasePath)}`;
		pkgExports[path] = path;
	}
	return pkgExports;
};
