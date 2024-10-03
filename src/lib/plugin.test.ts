import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {replace_plugin} from './plugin.js';

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
	assert.is(p[0], a2);
	assert.is(p[1], b);
	assert.is(p[2], c);
	p = replace_plugin(p, b2);
	assert.is(p[0], a2);
	assert.is(p[1], b2);
	assert.is(p[2], c);
	// allows duplicate names in the array
	p = replace_plugin(p, c2, 'a');
	assert.is(p[0], c2);
	assert.is(p[1], b2);
	assert.is(p[2], c);
	p = replace_plugin(p, a2, 'c');
	assert.is(p[0], a2);
	assert.is(p[1], b2);
	assert.is(p[2], c);
	p = replace_plugin(p, c2);
	assert.is(p[0], a2);
	assert.is(p[1], b2);
	assert.is(p[2], c2);
});

test('replace_plugin without an array', () => {
	const a = {name: 'a'};
	const a2 = {name: 'a'};
	const p = replace_plugin([a], a2);
	assert.is(p[0], a2);
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
	if (!err) assert.unreachable('should have failed');
});

test.run();
