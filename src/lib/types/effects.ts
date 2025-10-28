export type DiceEffect = {
	type: 'dice';
	dice_id: string | null;
	dice_name?: string;
	quantity: number;
};

export type FlatStatEffect = {
	type: 'flat_stat';
	stat: 'attack' | 'defense';
	value: number;
	condition?: string;
};

export type MultiplierEffect = {
	type: 'multiplier';
	stat: 'attack' | 'defense';
	value: number;
};

export type BackupTrimEffect = {
	type: 'backup_trim';
	value: number;
};

export type BenefitEffect = {
	type: 'benefit';
	description: string;
	value?: number;
	benefit_type?: string;
};

export type Effect =
	| DiceEffect
	| FlatStatEffect
	| MultiplierEffect
	| BenefitEffect
	| BackupTrimEffect;

export type BreakpointColor = 'bronze' | 'silver' | 'gold' | 'prismatic';

export interface EffectBreakpoint {
	count: number | string;
	effects: Effect[];
	color?: BreakpointColor;
	description?: string;
}

export interface TraitWithEffects {
	id: string;
	name: string;
	description: string | null;
	effect_schema: EffectBreakpoint[];
}
