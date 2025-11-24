<script lang="ts">
	import {page} from '$app/state';
	import Api_Index from '@ryanatkn/fuz/Api_Index.svelte';
	import {DOCS_PATH} from '@ryanatkn/fuz/docs_helpers.svelte.js';

	const at_root = $derived(page.url.pathname === DOCS_PATH);
</script>

<Api_Index minimal={at_root} />
