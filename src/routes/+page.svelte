<script lang="ts">
	import {base} from '$app/paths';

	// TODO add website, rewriting the markdown docs as Svelte
</script>

<main>
	<h1>gro</h1>
	<div class="prose">
		<div class="box spaced">
			<blockquote>
				task runner and toolkit extending <a href="https://kit.svelte.dev/">SvelteKit</a>
			</blockquote>
		</div>
		<div class="box spaced">
			<code class="padded_md">
				npm i -D <a href="https://www.npmjs.com/package/@grogarden/gro">@grogarden/gro</a>
			</code>
		</div>
		<div class="panel spaced padded_md text_align_center">
			this website is a work in progress!<br />for now docs are in
			<a href="https://github.com/grogarden/gro">the source repo</a>
		</div>
	</div>
	<div hidden>
		Mastodon verification:
		<a rel="me" href="https://hci.social/@ryanatkn">@ryanatkn@hci.social</a>
	</div>
	<footer>
		<a class="panel padded_md box" href="https://github.com/grogarden/gro">
			<img
				alt="a pixelated green oak acorn with a glint of sun"
				class="spaced"
				src="{base}/favicon.png"
				style:width="var(--icon_size_lg)"
				style:height="var(--icon_size_lg)"
			/>
			<div>source code</div>
		</a>
	</footer>
</main>

<style>
	main {
		margin: 0 auto;
		max-width: var(--width_md);
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.prose {
		padding: 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
