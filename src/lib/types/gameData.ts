export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type CustomDiceRow = {
	id: string;
	name: string;
	description: string | null;
	icon: string | null;
	color: string | null;
	category: string | null;
	dice_type: 'attack' | 'special';
	created_at: string | null;
	updated_at: string | null;
};

export type DiceSideRow = {
	id: string;
	dice_id: string;
	side_number: number;
	reward_type: 'attack' | 'special';
	reward_value: string;
	reward_description: string | null;
	icon: string | null;
	created_at: string | null;
};

export type OriginRow = {
	id: string;
	name: string;
	position: number;
	icon: string | null;
	color: string | null;
	description: string | null;
	footer: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type ClassRow = {
	id: string;
	name: string;
	position: number;
	icon: string | null;
	color: string | null;
	description: string | null;
	breakpoints: Json | null;
	prismatic: Json | null;
	tags: string[] | null;
	effect_schema: Json | null;
	footer: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type RuneRow = {
	id: string;
	name: string;
	benefit: string;
	origin_id: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type HexSpiritRow = {
	id: string;
	name: string;
	cost: number;
	class_id: string | null;
	origin_id: string | null;
	created_at: string | null;
	image_path: string | null;
	updated_at: string | null;
};

export type UnitRow = HexSpiritRow;

export type ArtifactRecipeEntry = {
	rune_id: string;
	quantity: number;
};

export type ArtifactRow = {
	id: string;
	name: string;
	benefit: string;
	recipe_box: ArtifactRecipeEntry[];
	origin_id: string;
	created_at: string | null;
	updated_at: string | null;
};

export type AvatarSpiritRow = {
	id: string;
	name: string;
	origin_id: string;
	created_at: string | null;
	updated_at: string | null;
};
