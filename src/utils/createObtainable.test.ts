import {test, t} from '../oki/oki.js';

import {createObtainable} from './createObtainable.js';

test('createObtainable()', () => {
	test('release out of order', () => {
		let thing: Symbol | undefined;
		let isReleased = false;
		const obtainThing = createObtainable(
			() => {
				t.is(thing, undefined);
				thing = Symbol();
				return thing;
			},
			thingReleased => {
				isReleased = true;
				t.is(thingReleased, thing);
			},
		);

		const [thing1, release1] = obtainThing();
		t.is(thing1, thing);
		t.ok(!isReleased);

		const [thing2, release2] = obtainThing();
		t.is(thing2, thing);
		t.ok(!isReleased);
		t.is(release1, release2); // release function refs should be the same

		const [thing3, release3] = obtainThing();
		t.is(thing3, thing);
		t.ok(!isReleased);

		release2();
		t.ok(!isReleased);

		release3();
		t.ok(!isReleased);

		release1();
		t.ok(isReleased);

		const originalThing = thing;
		thing = undefined;
		isReleased = false;
		const [thing4, release4] = obtainThing();
		t.isNot(thing4, originalThing);
		t.ok(!isReleased);
		release4();
		t.ok(isReleased);
	});

	// This is a complicated corner case that probably should not happen
	// because it would normally cause a stack overflow in user code,
	// but we're covering it just in case.
	test('obtain is called during release', () => {
		let shouldObtainDuringRelease = true;
		let thing: Symbol | undefined;
		let isReleased = false;
		const obtainThing = createObtainable(
			() => {
				t.is(thing, undefined);
				isReleased = false;
				thing = Symbol();
				return thing;
			},
			thingReleased => {
				isReleased = true;
				t.is(thingReleased, thing);
				thing = undefined;

				if (!shouldObtainDuringRelease) return; // prevent stack overflow
				shouldObtainDuringRelease = false;
				const [thing3, release3] = obtainThing();
				t.ok(thing3);
				t.is(thing3, thing);
				t.isNot(thing3, thingReleased);
				t.ok(!isReleased);
				release3();
				t.ok(isReleased);
				t.is(thing, undefined);
			},
		);

		const [thing1, release1] = obtainThing();
		t.is(thing1, thing);
		t.ok(!isReleased);

		const [thing2, release2] = obtainThing();
		t.is(thing2, thing);
		t.ok(!isReleased);

		release2();
		t.ok(!isReleased);

		release1();
		t.ok(isReleased);
	});

	test('cannot obtain undefined', () => {
		const obtainThing = createObtainable(
			() => undefined,
			() => {},
		);
		t.throws(() => obtainThing());
	});
});
