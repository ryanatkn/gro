declare global {
	interface ImportMeta {
		env: {
			DEV: boolean;
			SSR: boolean;
		};
	}
}

export const dev = import.meta.env.DEV;

export const ssr = import.meta.env.SSR;
