// mirrors what SvelteKit does
declare global {
	interface ImportMeta {
		env: {
			DEV: boolean;
			// SSR: boolean;
		};
	}
}

export const dev = import.meta.env.DEV;

// export const ssr = import.meta.SSR; // default to not-SSR.. BSR?
