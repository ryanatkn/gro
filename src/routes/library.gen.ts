import {library_gen} from '@fuzdev/fuz_ui/library_gen.js';
import {library_throw_on_duplicates} from '@fuzdev/fuz_ui/library_generate.js';

export const gen = library_gen({on_duplicates: library_throw_on_duplicates});
