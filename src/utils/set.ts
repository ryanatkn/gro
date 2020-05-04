// Two sets containing deeply equal objects, but different references,
// are considered not equal to each other.
export const setsEqual = (a: Set<unknown>, b: Set<unknown>): boolean => {
	if (a.size !== b.size) return false;
	for (const aVal of a) {
		if (!b.has(aVal)) return false;
	}
	return true;
};
