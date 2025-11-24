<script lang="ts">
	import {resolve} from '$app/paths';
	import {redirect} from '@sveltejs/kit';
	import {DOCS_PATH} from '@ryanatkn/fuz/docs_helpers.svelte.js';

	redirect(307, resolve(DOCS_PATH + 'api'));
</script>
