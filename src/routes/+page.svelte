<section class="page">
	<header class="page__header">
		<div>
			<h1>Arc Spirits Rev 2</h1>
			<p>Manage the next-generation data model for Arc Spirits.</p>
		</div>
	</header>

	<div class="card-grid">
		<a class="card" href="/origins">
			<h2>Origins</h2>
			<p>Curate the worlds and story anchors that power spirits.</p>
		</a>
		<a class="card" href="/classes">
			<h2>Classes</h2>
			<p>Define combat archetypes and roles for units.</p>
		</a>
		<a class="card" href="/runes">
			<h2>Runes</h2>
			<p>Manage rune stockpiles used for artifact crafting.</p>
		</a>
		<a class="card" href="/hex-spirits">
			<h2>Hex Spirits</h2>
			<p>Browse and edit playable spirits, their costs, and imagery.</p>
		</a>
		<a class="card" href="/dice-simulator">
			<h2>Dice Lab</h2>
			<p>Design custom dice, tweak side effects, and simulate rolls.</p>
		</a>
		<a class="card" href="/artifacts">
			<h2>Artifacts</h2>
			<p>Author artifact benefits and rune recipes.</p>
		</a>
		<a class="card" href="/avatar-spirits">
			<h2>Avatar Spirits</h2>
			<p>Track special spirits linked to their origin.</p>
		</a>
	</div>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.page__header {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		padding: 1.25rem;
	}

	.page__header h1 {
		margin: 0;
	}

	.page__header p {
		margin: 0;
		color: #cbd5f5;
	}

	.card-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 1rem;
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.card:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 20px rgba(15, 23, 42, 0.45);
	}

	.card h2 {
		margin: 0;
	}

	.card p {
		margin: 0;
		color: #cbd5f5;
	}
</style>
