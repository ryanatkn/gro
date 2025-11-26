<script lang="ts">
	import LibraryDetail from '@ryanatkn/fuz/LibraryDetail.svelte';
	import DocsFooter from '@ryanatkn/fuz/DocsFooter.svelte';
	import EcosystemLinksPanel from '@ryanatkn/fuz/EcosystemLinksPanel.svelte';
	import Breadcrumb from '@ryanatkn/fuz/Breadcrumb.svelte';
	import {library_context} from '@ryanatkn/fuz/library.svelte.js';

	const library = library_context.get();
</script>

<main class="width_upto_md">
	<section class="mt_xl3">
		<header class="box">
			<h1>{library.repo_name}</h1>
		</header>
		<Breadcrumb>{library.package_json.glyph}</Breadcrumb>
	</section>
	<EcosystemLinksPanel />
	<section class="box width_100 mb_lg">
		<div class="panel p_md width_upto_md">
			<LibraryDetail {library} />
		</div>
	</section>
	<section class="box">
		<nav class="mb_lg">
			<Breadcrumb>{library.package_json.glyph}</Breadcrumb>
		</nav>
		<DocsFooter {library} />
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
