import {attach_process_error_handlers as base_attach_process_error_handlers} from '@feltcoop/felt/util/process.js';

import {Task_Error} from '../task/task.js';

export const attach_process_error_handlers = (): void => {
	base_attach_process_error_handlers((err) => (err instanceof Task_Error ? 'Task_Error' : null));
};
