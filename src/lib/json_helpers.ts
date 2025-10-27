/**
 * Serializes a value to JSON with deterministic key ordering.
 * Recursively sorts object keys alphabetically for consistent hashing.
 * Arrays and primitives are serialized as-is.
 *
 * @param value Any JSON-serializable value
 * @returns Deterministic JSON string representation
 */
export const to_deterministic_json = (value: unknown): string =>
	JSON.stringify(value, (_key, val) => {
		if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
			const sorted: Record<string, any> = {};
			const keys = Object.keys(val).sort();
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				sorted[k] = val[k];
			}
			return sorted;
		}
		return val;
	});
