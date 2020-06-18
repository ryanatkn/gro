declare module 'mri';

declare module 'kleur/colors' {
	type Colorize = (s: unknown) => string;

	export const $: {
		enabled: boolean;
	};

	// modifiers
	export const reset: Colorize;
	export const bold: Colorize;
	export const dim: Colorize;
	export const italic: Colorize;
	export const underline: Colorize;
	export const inverse: Colorize;
	export const hidden: Colorize;
	export const strikethrough: Colorize;

	// colors
	export const black: Colorize;
	export const red: Colorize;
	export const green: Colorize;
	export const yellow: Colorize;
	export const blue: Colorize;
	export const magenta: Colorize;
	export const cyan: Colorize;
	export const white: Colorize;
	export const gray: Colorize;
	export const grey: Colorize;

	// background colors
	export const bgBlack: Colorize;
	export const bgRed: Colorize;
	export const bgGreen: Colorize;
	export const bgYellow: Colorize;
	export const bgBlue: Colorize;
	export const bgMagenta: Colorize;
	export const bgCyan: Colorize;
	export const bgWhite: Colorize;
}
