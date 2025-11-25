<script lang="ts">
	import PackageDetail from '@ryanatkn/fuz/PackageDetail.svelte';
	import DocsFooter from '@ryanatkn/fuz/DocsFooter.svelte';
	import EcosystemLinksPanel from '@ryanatkn/fuz/EcosystemLinksPanel.svelte';
	import Breadcrumb from '@ryanatkn/fuz/Breadcrumb.svelte';
	import {pkg_context} from '@ryanatkn/fuz/pkg.svelte.js';

	const pkg = pkg_context.get();
</script>

<main class="width_upto_md">
	<section class="mt_xl3">
		<header class="box">
			<h1>{pkg.repo_name}</h1>
		</header>
		<Breadcrumb>{pkg.package_json.glyph}</Breadcrumb>
	</section>
	<EcosystemLinksPanel />
	<section class="box width_100 mb_lg">
		<div class="panel p_md width_upto_md">
			<PackageDetail {pkg} />
		</div>
	</section>
	<section class="box">
		<nav class="mb_lg">
			<Breadcrumb>{pkg.package_json.glyph}</Breadcrumb>
		</nav>
		<DocsFooter {pkg} />
	</section>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 0 auto;
	}
	h1 {
		display: flex;
		align-items: baseline;
		text-align: center;
	}
	section {
		margin-bottom: var(--space_xl5);
	}
</style>
