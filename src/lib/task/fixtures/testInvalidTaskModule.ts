// Tasks must conform to the `Task` interface, and this one does not.
// Mabybe we want to support a shorthand task notation using just a function?
// If so, we'll update this test fixture.
export const task = async (): Promise<void> => {
	throw Error('This invalid task should never run!');
};
