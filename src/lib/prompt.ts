import {readFileSync} from 'node:fs';
import {extname} from 'node:path';
import {paths} from '@ryanatkn/gro/paths.js';

export class Prompt_Builder {
	contents: string[] = [];

	add(text: string): this {
		this.contents.push(this.filter_text(text));
		return this;
	}

	// TODO unwieldy API, maybe a `fenced` option? we're also forcing the inline of `.md` atm
	add_file_inline(path: string): this {
		const text = readFileSync(path, 'utf8');
		return this.add(text);
	}

	// TODO objects with properties as labels, summary, etc
	add_file(path: string, filetype = extname(path).substring(1)): this {
		if (filetype === 'md') {
			return this.add_file_inline(path);
		}
		const text = readFileSync(path, 'utf8');
		const fence = detect_fence(text);
		this.add(`

[prompt metadata: inlined file starting on the next fenced block at path ${path}]

${fence}${filetype}

${text}

${fence}

`);
		return this;
	}

	add_text(text: string, label: string): this {
		const fence = detect_fence(text);
		this.add(`

[prompt metadata: inlined text starting on the next fenced block with label ${label}]

${fence}

${text}

${fence}

`);
		return this;
	}

	toString(): string {
		return this.contents.join('\n');
	}

	filter_text(text: string): string {
		// fast path
		if (!stack_matcher.test(text)) {
			return text;
		}
		// filter each line
		return text
			.split('\n')
			.filter((line) => {
				if (stack_matcher.test(line) && !line.includes(paths.source)) {
					return false;
				}
				// TODO customization
				return true;
			})
			.join('\n');
	}
}

const stack_matcher = /^\s* at /;

const detect_fence = (text: string): string => {
	let fence = '```';
	while (text.includes(fence)) {
		fence += '`';
	}
	return fence;
};
