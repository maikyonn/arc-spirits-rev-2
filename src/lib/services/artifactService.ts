import type {
    ArtifactRecipeEntry,
    ArtifactTemplateRow,
    OriginRow,
    RuneRow,
    ArtifactTagRow
} from '$lib/types/gameData';

export type ArtifactTemplateConfig = {
    namePattern: string;
    benefit: string;
    recipeType: 'origin-runes' | 'specific-runes' | 'custom';
    originRuneQuantity: number;
    specificRunes: ArtifactRecipeEntry[];
    tagIds: string[];
    selectedOriginIds?: string[];
    quantity?: number;
};

export type GeneratedArtifactPreview = {
    name: string;
    benefit: string;
    guardian_id: string | null;
    recipe_box: ArtifactRecipeEntry[];
    tag_ids: string[];
};

export const artifactService = {
    replacePlaceholders(text: string, entity: OriginRow | null, quantity?: number): string {
        if (!text) return '';
        let result = text;

        if (entity) {
            result = result.replace(/{origin}/gi, entity.name || '');
            result = result.replace(/{class}/gi, entity.name || '');
        }

        if (quantity !== undefined && quantity !== null) {
            result = result.replace(/{quantity}/g, quantity.toString());
        } else {
            result = result.replace(/{quantity}/g, '');
        }
        return result;
    },

    getOriginRunes(originId: string, runes: RuneRow[]): RuneRow[] {
        return runes.filter((rune) => rune.origin_id === originId);
    },

    generateFromTemplate(
        templateConfig: ArtifactTemplateConfig,
        origins: OriginRow[],
        runes: RuneRow[]
    ): GeneratedArtifactPreview[] {
        const { namePattern, benefit, recipeType, originRuneQuantity, specificRunes, tagIds } = templateConfig;

        const targetOrigins = templateConfig.selectedOriginIds && templateConfig.selectedOriginIds.length > 0
            ? origins.filter(o => templateConfig.selectedOriginIds!.includes(o.id))
            : origins;

        return targetOrigins.map(origin => {
            const name = this.replacePlaceholders(namePattern, origin);
            const benefitText = this.replacePlaceholders(benefit, origin, originRuneQuantity);

            let recipe_box: ArtifactRecipeEntry[] = [];
            if (recipeType === 'origin-runes') {
                const originRunes = this.getOriginRunes(origin.id, runes);
                if (originRunes.length > 0) {
                    const runesToUse = originRunes.slice(0, Math.min(originRuneQuantity, originRunes.length));
                    const quantityPerRune = Math.floor(originRuneQuantity / runesToUse.length);
                    const remainder = originRuneQuantity % runesToUse.length;

                    recipe_box = runesToUse.map((rune, index) => ({
                        rune_id: rune.id,
                        quantity: quantityPerRune + (index < remainder ? 1 : 0)
                    }));
                }
            } else if (recipeType === 'specific-runes') {
                recipe_box = specificRunes.filter((entry) => Boolean(entry.rune_id));
            }

            return {
                name,
                benefit: benefitText,
                guardian_id: null,
                recipe_box,
                tag_ids: tagIds ?? []
            };
        });
    }
};
