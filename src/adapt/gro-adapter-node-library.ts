import {printSpawnResult, spawn} from '@feltjs/util/process.js';
import {EMPTY_OBJECT} from '@feltjs/util/object.js';

import type {Adapter} from './adapt.js';
import {TaskError} from '../task/task.js';
import {NODE_LIBRARY_BUILD_NAME} from '../build/buildConfigDefaults.js';
import type {BuildName} from '../build/buildConfig.js';
import type {PackageJson} from '../utils/packageJson.js';
import {printCommandArgs, serializeArgs, toForwardedArgs} from '../utils/args.js';

const name = '@feltjs/gro-adapter-node-library';

// TODO maybe add a `files` option to explicitly include source files,
// and fall back to inferring from the build config
// (it should probably accept the normal include/exclude filters from @rollup/pluginutils)

export interface Options {
	buildName: BuildName; // defaults to 'library'
	packageJson: string; // defaults to 'package.json'
}

export interface AdapterArgs {} // eslint-disable-line @typescript-eslint/no-empty-interface

export const createAdapter = ({
	buildName = NODE_LIBRARY_BUILD_NAME,
	packageJson = 'package.json',
}: Partial<Options> = EMPTY_OBJECT): Adapter<AdapterArgs> => {
	return {
		name,
		adapt: async ({config, fs, log, timings}) => {
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
