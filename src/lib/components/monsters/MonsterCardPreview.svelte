<script lang="ts">
	import type { MonsterRow, SpecialEffectRow, RewardRow } from '$lib/types/gameData';
	import { REWARD_ROW_CONFIG } from '$lib/types/gameData';

	type ResolvedRewardRow = RewardRow & {
		icon_urls: (string | null)[];
	};

	type Monster = MonsterRow & {
		icon_url?: string | null;
		art_url?: string | null;
		resolved_reward_rows?: ResolvedRewardRow[];
		effects?: SpecialEffectRow[];
	};

	export let monster: Monster;
	export let orderNum: number | undefined = undefined;

	const stateColors: Record<string, string> = {
		tainted: '#c084fc',
		corrupt: '#6b21a8',
		fallen: '#065f46',
		boss: '#ef4444'
	};

	$: stateColor = stateColors[monster.state ?? 'tainted'] ?? '#94a3b8';
	$: validRewardRows = (monster.resolved_reward_rows ?? []).filter(row => row.icon_urls?.some(Boolean));
	$: tournamentRow = validRewardRows.find(r => r.type === 'tournament');
	$: standardRows = validRewardRows.filter(r => r.type !== 'tournament');
</script>

<div class="monster-card-preview">
	<!-- Data Panel (Left) -->
	<div class="data-panel">
		<!-- Header -->
		<div class="card-header">
			{#if monster.icon_url}
				<img src={monster.icon_url} alt="" class="monster-icon" />
			{:else if monster.icon}
				<div class="monster-icon-emoji">{monster.icon}</div>
			{/if}
			<div class="header-text">
				<h3 class="monster-name">{monster.name}</h3>
			</div>
		</div>

		<!-- State Badge -->
		<div class="state-badge" style="--state-color: {stateColor}">
			{(monster.state ?? 'tainted').toUpperCase()}
		</div>

		<!-- Stats Box -->
		<div class="stats-box">
			<div class="stat">
				<span class="stat-label">DAMAGE</span>
				<span class="stat-value">{monster.damage ?? 0}</span>
			</div>
			<div class="stat">
				<span class="stat-label">BARRIER</span>
				<span class="stat-value">{(monster as any).barrier ?? 0}</span>
			</div>

			{#if monster.effects && monster.effects.length > 0}
				<div class="effects-divider"></div>
				<div class="effects-list">
					{#each monster.effects.slice(0, 4) as effect}
						<div class="effect-item">
							<span class="effect-name" style="color: {effect.color || '#a78bfa'}">{effect.name}:</span>
							<span class="effect-desc">{@html effect.description || ''}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Tournament Reward Row -->
		{#if tournamentRow}
			{@const config = REWARD_ROW_CONFIG[tournamentRow.type]}
			<div class="tournament-rewards">
				<div class="tournament-title" style="color: {config.color}">
					THOSE THAT KILL, RANK DAMAGE
				</div>
				<div class="tournament-headers">
					<div class="tournament-header">
						<span class="placement">1ST</span>
						<span class="choose">CHOOSE 3</span>
					</div>
					<div class="tournament-divider"></div>
					<div class="tournament-header">
						<span class="placement">2ND</span>
						<span class="choose">CHOOSE 2</span>
					</div>
					<div class="tournament-divider"></div>
					<div class="tournament-header">
						<span class="placement">3RD+</span>
						<span class="choose">CHOOSE 1</span>
					</div>
				</div>
				<div class="reward-icons-panel" style="
					background: {config.bgColor};
					border-color: {config.borderColor};
				">
					{#each tournamentRow.icon_urls.filter(Boolean).slice(0, 5) as iconUrl}
						<img src={iconUrl} alt="" class="reward-icon" />
					{/each}
				</div>
			</div>
		{/if}

		<!-- Standard Reward Rows -->
		{#each standardRows as row}
			{@const config = REWARD_ROW_CONFIG[row.type] || REWARD_ROW_CONFIG.all_in_combat}
			<div class="reward-row">
				<div class="reward-label" style="color: {config.color}">
					{row.label || config.label}
				</div>
				<div class="reward-icons-panel" style="
					background: {config.bgColor};
					border-color: {config.borderColor};
				">
					{#each row.icon_urls.filter(Boolean).slice(0, 5) as iconUrl}
						<img src={iconUrl} alt="" class="reward-icon" />
					{/each}
				</div>
			</div>
		{/each}

		<!-- Footer -->
		<div class="card-footer">
			Arc Spirits // Monster
		</div>
	</div>

	<!-- Art Panel (Right) -->
	<div class="art-panel">
		{#if monster.art_url}
			<img src={monster.art_url} alt={monster.name} class="monster-art" />
		{:else}
			<div class="no-art">No artwork</div>
		{/if}
	</div>
</div>

<style>
	.monster-card-preview {
		display: grid;
		grid-template-columns: 1fr 1fr;
		background: #0c0b13;
		border-radius: 12px;
		overflow: hidden;
		border-left: 6px solid #a855f7;
		width: 600px;
		height: 437px;
	}

	.data-panel {
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-right: 2px solid rgba(168, 85, 247, 0.25);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.monster-icon {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}

	.monster-icon-emoji {
		font-size: 2.5rem;
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.header-text {
		flex: 1;
	}

	.monster-name {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 700;
		color: #f5f3ff;
		line-height: 1.2;
	}

	.state-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 4px 12px;
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		background: var(--state-color);
		color: #0f172a;
		width: fit-content;
	}

	.stats-box {
		background: rgba(91, 33, 182, 0.35);
		border: 2px solid rgba(168, 85, 247, 0.6);
		border-radius: 14px;
		padding: 12px 16px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stat-label {
		font-size: 0.7rem;
		font-weight: 700;
		color: #d8b4fe;
		letter-spacing: 0.03em;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 800;
		color: #f5f3ff;
	}

	.effects-divider {
		grid-column: 1 / -1;
		height: 1px;
		background: rgba(168, 85, 247, 0.3);
		margin: 4px 0;
	}

	.effects-list {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.effect-item {
		font-size: 0.7rem;
		line-height: 1.4;
	}

	.effect-name {
		font-weight: 700;
	}

	.effect-desc {
		color: #cbd5e1;
	}

	.tournament-rewards {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.tournament-title {
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.tournament-headers {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
	}

	.tournament-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0 12px;
	}

	.tournament-header .placement {
		font-size: 0.7rem;
		font-weight: 700;
		color: #fcd34d;
	}

	.tournament-header .choose {
		font-size: 0.6rem;
		font-weight: 600;
		color: #d97706;
	}

	.tournament-divider {
		width: 1px;
		height: 24px;
		background: rgba(251, 191, 36, 0.3);
	}

	.reward-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.reward-label {
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.reward-icons-panel {
		display: flex;
		gap: 6px;
		padding: 6px 8px;
		border-radius: 6px;
		border: 1px solid;
		justify-content: center;
	}

	.reward-icon {
		width: 32px;
		height: 32px;
		object-fit: contain;
	}

	.card-footer {
		margin-top: auto;
		padding-top: 8px;
		font-size: 0.75rem;
		color: #64748b;
		font-weight: 500;
	}

	.art-panel {
		background: rgba(12, 10, 19, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.monster-art {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: grayscale(100%);
	}

	.no-art {
		color: #64748b;
		font-size: 0.9rem;
	}

	@media (max-width: 500px) {
		.monster-card-preview {
			grid-template-columns: 1fr;
			grid-template-rows: auto 200px;
		}

		.data-panel {
			border-right: none;
			border-bottom: 2px solid rgba(168, 85, 247, 0.25);
		}
	}
</style>
