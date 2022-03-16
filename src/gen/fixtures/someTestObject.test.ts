import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import Ajv from 'ajv';
import {Logger} from '@feltcoop/felt/util/log.js';
import {red} from 'kleur/colors';

import {SomeTestObjectSchema, SomeTestPrimitiveSchema} from './someTestObject.schema.js';
import type {SomeTestObject, SomeTestPrimitive} from './someTestObject.js';

const log = new Logger('test__someTestObject'); // TODO test logger?

const ajv = new Ajv();
ajv.addKeyword('tsType');
ajv.addKeyword('tsImport');

/* test__SomeTestObject */
const test__SomeTestObject = suite('SomeTestObject');

test__SomeTestObject('validate type SomeTestObject against SomeTestObjectSchema', () => {
	const validate = ajv.compile(SomeTestObjectSchema);
	const someTestObject: SomeTestObject = {a: 1, b: 'b'};
	const valid = validate(someTestObject);
	if (!valid) log.error(red('validation errors'), validate.errors);
	assert.ok(valid);
});

test__SomeTestObject('fail to validate with extra properties', () => {
	const validate = ajv.compile(SomeTestObjectSchema);
	// @ts-expect-error
	const someTestObject: SomeTestObject = {a: 1, b: 'b', b2: 'oh no!'};
	const valid = validate(someTestObject);
	assert.ok(!valid);
});

test__SomeTestObject.run();
/* test__SomeTestObject */

/* test__SomeTestPrimitive */
const test__SomeTestPrimitive = suite('SomeTestPrimitive');

test__SomeTestPrimitive('validate type SomeTestPrimitive against SomeTestPrimitiveSchema', () => {
	const validate = ajv.compile(SomeTestPrimitiveSchema);
	const someTestPrimitive: SomeTestPrimitive = 1;
	const valid = validate(someTestPrimitive);
	if (!valid) log.error(red('validation errors'), validate.errors);
	assert.ok(valid);
});

test__SomeTestPrimitive('fail to validate with the wrong type', () => {
	const validate = ajv.compile(SomeTestPrimitiveSchema);
	// @ts-expect-error
	const someTestPrimitive: SomeTestPrimitive = 'oh no!';
	const valid = validate(someTestPrimitive);
	assert.ok(!valid);
});

test__SomeTestPrimitive.run();
/* test__SomeTestPrimitive */
