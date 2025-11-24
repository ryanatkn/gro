<script lang="ts">
	import Api_Module from '@ryanatkn/fuz/Api_Module.svelte';

	interface Props {
		params: {module_path?: string};
	}

	const {params}: Props = $props();

	const module_path = $derived(params.module_path ?? '');
</script>

<Api_Module {module_path} />
