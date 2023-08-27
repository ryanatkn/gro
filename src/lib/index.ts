export type {Task, TaskContext} from './task/task.js';
export type {Args, ArgSchema} from './task/args.js';
export type {Gen, GenContext} from './gen/gen.js';

export * from './util/schema.js';

// export all of the main config helpers and types
export {loadConfig, toConfig} from './config/config.js';
export type {
	GroConfig,
	GroConfigPartial,
	GroConfigModule,
	GroConfigCreator,
	GroConfigCreatorOptions,
} from './config/config.js';
// also export the build config stuff
export {normalizeBuildConfigs, validateBuildConfigs} from './build/buildConfig.js';
export type {BuildConfig, BuildName, BuildConfigPartial} from './build/buildConfig.js';

// these seem useful and generic enough to export to users
export {TaskError} from './task/task.js';
export {loadPackageJson} from './util/packageJson.js';
