import {SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import {
	CompilationSource,
	Compiler,
	createCompiler,
	InitialOptions as CompilerInitialOptions,
} from './compiler.js';
import {createSwcCompiler, InitialOptions as SwcCompilerInitialOptions} from './swcCompiler.js';
import {
	createSvelteCompiler,
	InitialOptions as SvelteCompilerInitialOptions,
} from './svelteCompiler.js';
import {
	createExternalsCompiler,
	InitialOptions as ExternalsCompilerInitialOptions,
} from './externalsCompiler.js';

export const createDefaultCompiler = (
	swcCompilerOptions?: SwcCompilerInitialOptions,
	svelteCompilerOptions?: SvelteCompilerInitialOptions,
	externalsCompilerOptions?: ExternalsCompilerInitialOptions,
	compilerOptions?: CompilerInitialOptions,
): Compiler => {
	const swcCompiler = createSwcCompiler(swcCompilerOptions);
	const svelteCompiler = createSvelteCompiler(svelteCompilerOptions);
	const externalsCompiler = createExternalsCompiler(externalsCompilerOptions);

	if (!compilerOptions?.getCompiler) {
		compilerOptions = {
			...compilerOptions,
			getCompiler: (source: CompilationSource) => {
				if (source.sourceType === 'externals') {
					return externalsCompiler;
				}
				switch (source.extension) {
					case TS_EXTENSION:
						return swcCompiler;
					case SVELTE_EXTENSION:
						return svelteCompiler;
					default:
						return null;
				}
			},
		};
	}

	return createCompiler(compilerOptions);
};
