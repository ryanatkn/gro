<script lang="ts">
	import LibraryDetail from '@ryanatkn/fuz/LibraryDetail.svelte';
	import TomeContent from '@ryanatkn/fuz/TomeContent.svelte';
	import {get_tome_by_name} from '@ryanatkn/fuz/tome.js';
	import {library_context} from '@ryanatkn/fuz/library.svelte.js';

	const tome = get_tome_by_name('library');

	const library = library_context.get();
</script>

<TomeContent {tome}>
	<section>
		<LibraryDetail {library} />
	</section>
</TomeContent>
