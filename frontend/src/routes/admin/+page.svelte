<script lang="ts">
	let { data } = $props();
	void data;
</script>

<section class="admin-welcome">
	<h1>Administratoriaus valdymo pultas</h1>
	<p>
		Pirmosios administrovimo funkcijos ruošiamos. Ši sritis taps centrine vieta, kurioje bus galima
a
		tvarkyti turinio atnaujinimus, prižiūrėti moderavimo eilę ir stebėti audito įrašus.
	</p>
	<p>
		Kol kas patvirtinome prieigos apsaugą – tik administratoriai (arba kūrėjai naudojantys
		<code>?impersonate=admin</code> režimą) mato šį puslapį.
	</p>
</section>

<style>
	.admin-welcome {
		display: grid;
		gap: 1rem;
	}

	.admin-welcome h1 {
		margin: 0;
		font-size: clamp(1.6rem, 4vw, 2.4rem);
	}

	.admin-welcome p {
		margin: 0;
		line-height: 1.6;
	}

	.admin-welcome code {
		font-size: 0.9rem;
	}
</style>
