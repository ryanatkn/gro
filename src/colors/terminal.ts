import kleur from 'kleur';

// TODO esm
// we're re-exporting `kleur` only because node ES modules don't support named exports yet - change when they're ready!
// see https://nodejs.org/api/esm.html

// colors
export const red = kleur.red;
export const yellow = kleur.yellow;
export const green = kleur.green;
export const cyan = kleur.cyan;
export const blue = kleur.blue;
export const magenta = kleur.magenta;
export const white = kleur.white;
export const gray = kleur.gray;
export const black = kleur.black;

// backgrounds
export const bgRed = kleur.bgRed;
export const bgYellow = kleur.bgYellow;
export const bgGreen = kleur.bgGreen;
export const bgCyan = kleur.bgCyan;
export const bgBlue = kleur.bgBlue;
export const bgMagenta = kleur.bgMagenta;
export const bgWhite = kleur.bgWhite;
export const bgBlack = kleur.bgBlack;

// modifiers
export const reset = kleur.reset;
export const bold = kleur.bold;
export const dim = kleur.dim;
export const italic = kleur.italic;
export const underline = kleur.underline;
export const inverse = kleur.inverse;
export const hidden = kleur.hidden;
export const strikethrough = kleur.strikethrough;

// custom stuff

export const colors = [red, yellow, green, cyan, blue, magenta];

export const rainbow = (str: string): string =>
	str
		.split('')
		.map((char, i) => colors[i % colors.length](char))
		.join('');
