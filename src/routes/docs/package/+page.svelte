<script lang="ts">
	import PackageDetail from '@ryanatkn/fuz/PackageDetail.svelte';
	import TomeContent from '@ryanatkn/fuz/TomeContent.svelte';
	import {get_tome_by_name} from '@ryanatkn/fuz/tome.js';
	import {pkg_context} from '@ryanatkn/fuz/pkg.svelte.js';

	const tome = get_tome_by_name('package');

	const pkg = pkg_context.get();
</script>

<TomeContent {tome}>
	<section>
		<PackageDetail {pkg} />
	</section>
</TomeContent>
