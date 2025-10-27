/**
 * Serializes a value to JSON with deterministic key ordering.
 * Recursively sorts object keys alphabetically for consistent hashing.
 * Arrays and primitives are serialized as-is.
 *
 * @param value Any JSON-serializable value
 * @returns Deterministic JSON string representation
 */
export const to_deterministic_json = (value: unknown): string =>
	JSON.stringify(value, (_key, val) =>
		val !== null && typeof val === 'object' && !Array.isArray(val)
			? Object.keys(val)
					.sort()
					.reduce<Record<string, any>>((sorted, k) => {
						sorted[k] = val[k];
						return sorted;
					}, {})
			: val,
	);
