<script lang="ts">
	import {page} from '$app/state';
	import ApiIndex from '@ryanatkn/fuz/ApiIndex.svelte';
	import {DOCS_PATH} from '@ryanatkn/fuz/docs_helpers.svelte.js';

	const at_root = $derived(page.url.pathname === DOCS_PATH);
</script>

<ApiIndex minimal={at_root} />
