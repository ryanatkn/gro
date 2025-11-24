<script lang="ts">
	import Package_Detail from '@ryanatkn/fuz/Package_Detail.svelte';
	import Tome_Content from '@ryanatkn/fuz/Tome_Content.svelte';
	import {get_tome_by_name} from '@ryanatkn/fuz/tome.js';
	import {pkg_context} from '@ryanatkn/fuz/pkg.svelte.js';

	const tome = get_tome_by_name('package');

	const pkg = pkg_context.get();
</script>

<Tome_Content {tome}>
	<section>
		<Package_Detail {pkg} />
	</section>
</Tome_Content>
