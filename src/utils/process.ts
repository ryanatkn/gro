import {attachProcessErrorHandlers as baseAttachProcessErrorHandlers} from '@feltcoop/felt/utils/process.js';

import {TaskError} from '../task/task.js';

export const attachProcessErrorHandlers = (): void => {
	baseAttachProcessErrorHandlers((err) => (err instanceof TaskError ? 'TaskError' : null));
};
