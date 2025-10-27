import {describe, test, expect} from 'vitest';

import {replace_plugin} from '../lib/plugin.js';

describe('replace_plugin', () => {
	test('replace_plugin', () => {
		const a = {name: 'a'};
		const b = {name: 'b'};
		const c = {name: 'c'};
		const plugins = [a, b, c];
		const a2 = {name: 'a'};
		const b2 = {name: 'b'};
		const c2 = {name: 'c'};
		let p = plugins;
		p = replace_plugin(p, a2);
		expect(p[0]).toBe(a2);
		expect(p[1]).toBe(b);
		expect(p[2]).toBe(c);
		p = replace_plugin(p, b2);
		expect(p[0]).toBe(a2);
		expect(p[1]).toBe(b2);
		expect(p[2]).toBe(c);
		// allows duplicate names in the array
		p = replace_plugin(p, c2, 'a');
		expect(p[0]).toBe(c2);
		expect(p[1]).toBe(b2);
		expect(p[2]).toBe(c);
		p = replace_plugin(p, a2, 'c');
		expect(p[0]).toBe(a2);
		expect(p[1]).toBe(b2);
		expect(p[2]).toBe(c);
		p = replace_plugin(p, c2);
		expect(p[0]).toBe(a2);
		expect(p[1]).toBe(b2);
		expect(p[2]).toBe(c2);
	});

	test('replace_plugin without an array', () => {
		const a = {name: 'a'};
		const a2 = {name: 'a'};
		const p = replace_plugin([a], a2);
		expect(p[0]).toBe(a2);
	});

	test('replace_plugin throws if it cannot find the given name', () => {
		const a = {name: 'a'};
		const plugins = [a];
		let err;
		try {
			replace_plugin(plugins, {name: 'b'});
		} catch (_err) {
			err = _err;
		}
		expect(err).toBeTruthy();
	});
});
