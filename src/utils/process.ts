import {attachProcessErrorHandlers as baseAttachProcessErrorHandlers} from '@feltcoop/felt/utils/process.js';

import {Task_Error} from '../task/task.js';

export const attachProcessErrorHandlers = (): void => {
	baseAttachProcessErrorHandlers((err) => (err instanceof Task_Error ? 'Task_Error' : null));
};
