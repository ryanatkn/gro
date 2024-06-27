import {z} from 'zod';

export const CHANGESET_RESTRICTED_ACCESS = 'restricted';
export const CHANGESET_PUBLIC_ACCESS = 'public';

export const Changeset_Access = z.enum([CHANGESET_RESTRICTED_ACCESS, CHANGESET_PUBLIC_ACCESS]);

export const CHANGESET_CLI = 'changeset';

export const CHANGESET_DIR = '.changeset';

export const Changeset_Bump = z.enum(['patch', 'minor', 'major']);
export type Changeset_Bump = z.infer<typeof Changeset_Bump>;
