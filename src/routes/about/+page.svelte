<script lang="ts">
	import Package_Detail from '@ryanatkn/fuz/Package_Detail.svelte';
	import Docs_Footer from '@ryanatkn/fuz/Docs_Footer.svelte';
	import Community_Links_Panel from '@ryanatkn/fuz/Community_Links_Panel.svelte';
	import Breadcrumb from '@ryanatkn/fuz/Breadcrumb.svelte';

	import {parse_package_meta} from '$lib/package_meta.js';
	import {package_json, src_json} from '$lib/package.js';

	const pkg = parse_package_meta(package_json, src_json);

	// TODO standardize
</script>

<main class="width_md">
	<section class="mt_xl3">
		<header class="box">
			<h1>{pkg.repo_name}</h1>
		</header>
		<Breadcrumb>🧶</Breadcrumb>
	</section>
	<Community_Links_Panel />
	<section class="box w_100 mb_lg">
		<div class="panel p_md width_md">
			<Package_Detail {pkg} />
		</div>
	</section>
	<section class="box">
		<nav class="mb_lg">
			<Breadcrumb>🧶</Breadcrumb>
		</nav>
		<Docs_Footer {pkg} />
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
