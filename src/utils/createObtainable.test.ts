import {test, t} from '../oki/oki.js';

import {createObtainable} from './createObtainable.js';

test('createObtainable()', () => {
	test('unobtain out of order', async () => {
		let thing: Symbol | undefined;
		let isUnobtained = false;
		const obtainThing = createObtainable(
			() => {
				t.is(thing, undefined);
				thing = Symbol();
				return thing;
			},
			(thingUnobtained) => {
				isUnobtained = true;
				t.is(thingUnobtained, thing);
			},
		);

		const [thing1, unobtain1] = obtainThing();
		t.is(thing1, thing);
		t.ok(!isUnobtained);

		const [thing2, unobtain2] = obtainThing();
		t.is(thing2, thing);
		t.ok(!isUnobtained);
		t.isNot(unobtain1, unobtain2); // unobtain function refs should not be the same

		const [thing3, unobtain3] = obtainThing();
		t.is(thing3, thing);
		t.ok(!isUnobtained);

		const unobtainPromise2 = unobtain2();
		t.ok(!isUnobtained);
		t.ok(unobtainPromise2 instanceof Promise);

		const unobtainPromise3 = unobtain3();
		unobtain3(); // call unobtain additional times to make sure it's idempotent
		unobtain3();
		unobtain3();
		t.ok(!isUnobtained);
		t.ok(unobtainPromise3 instanceof Promise);

		const unobtainPromise1 = unobtain1();
		t.ok(isUnobtained);
		t.ok(unobtainPromise1 instanceof Promise);
		await unobtainPromise1; // this will hang if never resolved

		const originalThing = thing;
		thing = undefined;
		isUnobtained = false;
		const [thing4, unobtain4] = obtainThing();
		t.ok(thing4);
		t.is(thing4, thing);
		t.isNot(thing4, originalThing);
		t.ok(!isUnobtained);
		const unobtainPromise4 = unobtain4();
		t.ok(isUnobtained);
		t.ok(unobtainPromise4 instanceof Promise);
		t.isNot(unobtainPromise4, unobtainPromise1);
		await unobtainPromise4; // this will hang if never resolved
	});

	// This is a complicated corner case that probably should not happen
	// because it would normally cause a stack overflow in user code,
	// but we're covering it just in case.
	test('obtain is called during unobtain', () => {
		let shouldObtainDuringUnobtain = true;
		let thing: Symbol | undefined;
		let isUnobtained = false;
		const obtainThing = createObtainable(
			() => {
				t.is(thing, undefined);
				isUnobtained = false;
				thing = Symbol();
				return thing;
			},
			(thingUnobtained) => {
				isUnobtained = true;
				t.is(thingUnobtained, thing);
				thing = undefined;

				if (!shouldObtainDuringUnobtain) return; // prevent stack overflow
				shouldObtainDuringUnobtain = false;
				const [thing3, unobtain3] = obtainThing();
				t.ok(thing3);
				t.is(thing3, thing);
				t.isNot(thing3, thingUnobtained);
				t.ok(!isUnobtained);
				unobtain3();
				t.ok(isUnobtained);
				t.is(thing, undefined);
			},
		);

		const [thing1, unobtain1] = obtainThing();
		t.is(thing1, thing);
		t.ok(!isUnobtained);

		const [thing2, unobtain2] = obtainThing();
		t.is(thing2, thing);
		t.ok(!isUnobtained);

		unobtain2();
		t.ok(!isUnobtained);

		unobtain1();
		t.ok(isUnobtained);
	});

	test('cannot obtain undefined', () => {
		const obtainThing = createObtainable(
			() => undefined,
			() => {},
		);
		t.throws(() => obtainThing());
	});
});
