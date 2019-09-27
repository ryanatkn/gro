export enum AsyncState {
	Initial,
	Pending,
	Success,
	Failure,
}

export const wait = (duration = 0) =>
	new Promise(resolve => setTimeout(resolve, duration));
