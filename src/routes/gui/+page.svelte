<script lang="ts">
	// interface Props {
	// }

	// const {}: Props = $props();

	const hello_server = () => {
		import.meta.hot?.send('gro_server_message', {abc: 123});
	};
	import.meta.hot?.on('gro_client_message', (data) => {
		console.log('gro_client_message', data);
	});
</script>

<h1>gro gui</h1>

<section>
	<button onclick={hello_server}>hello server</button>
</section>
