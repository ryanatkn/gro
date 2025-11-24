<script lang="ts">
	import Api_Module from '@ryanatkn/fuz/Api_Module.svelte';

	const {
		params,
	}: {
		params: {module_path?: string};
	} = $props();

	const module_path = $derived(params.module_path ?? '');
</script>

<Api_Module {module_path} />
