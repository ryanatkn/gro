export interface Lock<TKey = any> {
	has(key: TKey): boolean;
	peek(): TKey | null;
	tryToObtain(key: TKey): boolean;
	tryToRelease(key: TKey): boolean;
}

// TODO look at `Obtainable`
// TODO maybe this is a good usecase for xstate? or is that a little much?
export const createLock = <TKey>(initialKey: TKey | null = null): Lock<TKey> => {
	let lockedKey: TKey | null = initialKey;
	const has = (key: TKey): boolean => key === lockedKey;
	const peek = (): TKey | null => lockedKey;
	const tryToObtain = (key: TKey): boolean => {
		if (Object.is(lockedKey, key)) return true;
		if (lockedKey === null) {
			lockedKey = key;
			return true;
		}
		return false;
	};
	const tryToRelease = (key: TKey): boolean => {
		if (lockedKey === key) {
			lockedKey = null;
			return true;
		}
		return false;
	};
	return {has, tryToObtain, tryToRelease, peek};
};
