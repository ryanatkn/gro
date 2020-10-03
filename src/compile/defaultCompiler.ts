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

export const createDefaultCompiler = (
	swcCompilerOptions?: SwcCompilerInitialOptions,
	svelteCompilerOptions?: SvelteCompilerInitialOptions,
	compilerOptions?: CompilerInitialOptions,
): Compiler => {
	const swcCompiler = createSwcCompiler(swcCompilerOptions);
	const svelteCompiler = createSvelteCompiler(svelteCompilerOptions);

	if (!compilerOptions?.getCompiler) {
		compilerOptions = {
			...compilerOptions,
			getCompiler: (source: CompilationSource) => {
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
