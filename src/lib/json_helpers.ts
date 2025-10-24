/**
 * Serializes a value to JSON with deterministic key ordering.
 * Recursively sorts object keys alphabetically for consistent hashing.
 * Arrays and primitives are serialized as-is.
 *
 * @param value Any JSON-serializable value
 * @returns Deterministic JSON string representation
 */
export const to_deterministic_json = (value: unknown): string => {
	return JSON.stringify(value, (_key, val) => {
		if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
			// Sort object keys alphabetically for deterministic output
			return Object.keys(val)
				.sort()
				.reduce<Record<string, any>>((sorted, k) => {
					sorted[k] = val[k];
					return sorted;
				}, {});
		}
		return val;
	});
};
