# Dice Configuration & Traits Documentation

This document contains all dice configurations and trait (class/origin) information for the Arc Spirits game.

---

## Dice Configuration

### Attack Dice

#### Basic Attack
- **Description:** Consistent heavy melee damage with low variance
- **Type:** Attack
- **Category:** attack
- **Color:** #4a9eff
- **Icon:** 🎲
- **Background:** `dice_backgrounds/dice_f5e0a3c4-0fe7-4d59-b834-94a39a53bbf9_background.png`

**Sides:**
1. ⚪ 0 Attack
2. ⚪ 1 Attack
3. 🔵 1 Attack
4. 🔵 1 Attack
5. 🔵 2 Attack
6. 🔵 2 Attack

#### Critical Attack
- **Description:** Ranged attack with moderate variance. EV 3.3 SD 3.2
- **Type:** Attack
- **Category:** attack
- **Color:** #4a9eff
- **Icon:** 🎲
- **Background:** `dice_backgrounds/dice_27f704cf-eb90-41bb-8d73-61e20ba4b43a_background.png`

**Sides:**
1. ⚫ 0 Attack
2. ⚫ 0 Attack
3. ⚪ 1 Attack
4. ⚪ 1 Attack
5. 🔵 2 Attack
6. 🔵 4 Attack

#### Magic Attack
- **Description:** High variance ranged attack with critical potential
- **Type:** Attack
- **Category:** critical
- **Color:** #4a9eff
- **Icon:** 🎲
- **Background:** `dice_backgrounds/dice_d7f817b0-36f7-42a9-91e5-35cce6acfbc1_background.png`

**Sides:**
1. ⚫ 1 Attack
2. ⚫ 1 Attack
3. 🔵 2 Attack
4. 🟢 3 Attack
5. 🔴 8 Attack
6. 🔴 9 Attack

### Special Dice

#### Arcane Attack
- **Description:** (empty)
- **Type:** Special
- **Category:** (none)
- **Color:** #ff4d4d
- **Icon:** 🎲
- **Background:** `dice_backgrounds/dice_889cd56b-a356-4f34-9914-8efa69618a55_background.png`

**Sides:**
1. ⚔️ ✴ (special)
2. ⚔️ ✴ (special)
3. ⚔️ 6 (special)
4. ⚔️ 9 (special)
5. ⚔️ 12 (special)
6. ⚔️ ✴ (special)

#### Cyber Dice
- **Description:** (empty)
- **Type:** Special
- **Category:** (none)
- **Color:** #4a9eff
- **Icon:** ⚔️
- **Background:** `dice_backgrounds/dice_4b4b8453-13eb-40e0-bd69-b5e8b7bea4d4_background.png`

**Sides:**
1. 🎯 2 (special) - Side 1
2. 🎯 2 (special) - Side 2
3. 🎯 2 (special) - Side 3
4. 🎯 ⧉ (special) - Side 4
5. 🎯 ⧉ (special) - Side 5
6. 🎯 ⧉ (special) - Side 6

#### Exalted Attack
- **Description:** (empty)
- **Type:** Special
- **Category:** (none)
- **Color:** #ffbf52
- **Icon:** 🎲
- **Background:** `dice_backgrounds/dice_f027b9ec-62f6-48bf-947e-5a6fd07064dc_background.png`

**Sides:**
1. 🎯 ✴ (special)
2. 🎯 2 (special)
3. 🎯 4 (special)
4. 🎯 4 (special)
5. 🎯 4 (special)
6. 🎯 6 (special)

---

## Classes (Traits)

### Defender
- **Position:** 1
- **Color:** #88a1d3
- **Icon:** `46cf02f0-a3cd-4211-bde4-cc3c5417bd6f/class_defender_icon.png`
- **Description:** Generally effective defense at defending against all types of damage.
- **Tags:** Defensive

**Rune Breakpoints:**
- 1 rune: 2 defense
- 2 runes: 3 defense
- 3 runes: 5 defense
- 4 runes: 8 defense
- 5 runes: 12 defense
- 6 runes: 17 defense
- 7 runes: 23 defense

**Effect Schema (by Rune Cost):**
- Bronze 1 rune: +2 defense (flat stat)
- Bronze 2 runes: +3 defense (flat stat)
- Silver 3 runes: +5 defense (flat stat)
- Silver 4 runes: +7 defense (flat stat)
- Gold 5 runes: +9 defense (flat stat)
- Gold 6 runes: +12 defense (flat stat)
- Gold 7 runes: +15 defense (flat stat)
- Prismatic 8 runes: +19 defense (flat stat)
- Prismatic 9 runes: +23 defense (flat stat)

### Backup
- **Position:** 2
- **Color:** #6b7280
- **Icon:** `aa90084b-a07a-4b00-9448-9f5dae83bd03/class_backup_icon.png`
- **Description:** Effective at reducing damage in combats with Ranged and Magic Attacks.
- **Tags:** Defensive

**Rune Breakpoints:**
- 1 rune: 3 defense
- 2 runes: 5 defense
- 3 runes: 7 defense
- 4 runes: 9 defense, reroll an enemy attack dice.

**Effect Schema (by Rune Cost):**
- Bronze 1 rune: Remove 1 incoming attack dice
- Gold 3 runes: Remove 2 incoming attack dice.
- Prismatic 5 runes: Remove 4 incoming attack dice.

### Swordsman
- **Position:** 3
- **Color:** #059669
- **Icon:** `dd17c072-159c-4b43-831f-1f51bb8b7720/class_swordsman_icon.png`
- **Description:** Stable and consistent offensive class. Linear scaling potential.
- **Tags:** Combat
- **Footer:** Expected Roll of Melee Attack Dice: ~1, Low Variance.

**Rune Breakpoints:**
- 1 rune: 2 attack dice
- 2 runes: 3 attack dice
- 3 runes: 4 attack dice
- 4 runes: 6 attack dice
- 5 runes: 9 attack dice
- 6 runes: 12 attack dice

**Effect Schema (by Rune Cost):**
- Bronze 1 rune: 2 Basic Attack Dice
- Bronze 2 runes: 4 Basic Attack Dice
- Bronze 3 runes: 1 Basic Attack Dice + 1 Exalted Attack Dice
- Silver 4 runes: 2 Critical Attack Dice
- Silver 5 runes: 3 Critical Attack Dice
- Gold 6 runes: 4 Critical Attack Dice
- Gold 7 runes: 5 Critical Attack Dice

### Archer
- **Position:** 4
- **Color:** #7287b1
- **Icon:** `5d1c9e89-e431-41dc-ae67-77dd8ee78170/class_archer_icon.png`
- **Description:** Acceptable damage dealer at the start, becoming formidable during the mid and late game. Archers are effective at targeting certain players.
- **Tags:** Combat
- **Footer:** Expected Roll of Ranged Attack Dice: ~1.5, Medium Variance

**Rune Breakpoints:**
- 1 rune: 1 atk dice
- 2 runes: 2 atk dice
- 3 runes: 4 atk dice
- 4 runes: 7 atk dice
- 5 runes: 7 atk dice, 1 crit dice
- 6 runes: 7 atk dice, 2 crit dice
- 7 runes: 7 atk dice, 4 crit dice

**Effect Schema (by Rune Cost):**
- 1 rune: 1 Basic Attack Dice
- Bronze 2 runes: 1 Critical Attack Dice
- Bronze 3 runes: 2 Critical Attack Dice
- Silver 4 runes: 2 Magic Attack Dice
- Silver 5 runes: 3 Magic Attack Dice
- Gold 6 runes: 1 Arcane Attack Dice + 2 Magic Attack Dice
- Gold 7 runes: 2 Arcane Attack Dice + 1 Magic Attack Dice
- Prismatic 8 runes: 3 Arcane Attack Dice

### Sorcerer
- **Position:** 5
- **Color:** #6b7280
- **Icon:** `173589ed-9bec-4965-94e6-dadbc6b5310a/class_sorcerer_icon.png`
- **Description:** Weak damage early on, but can deal massive damage in the late game.
- **Tags:** Combat
- **Footer:** Expected Roll of Magic Attack Dice: 4, High Variance.

**Rune Breakpoints:**
- 2 runes: 1 attack dice
- 3 runes: 1 critical attack dice
- 4 runes: 3 critical attack dice
- 5 runes: 5 critical attack dice
- 6 runes: 8 critical attack dice
- 7 runes: 12 critical attack dice

**Effect Schema (by Rune Cost):**
- Bronze 2 runes: 1 Basic Attack Dice
- Bronze 3 runes: 1 Critical Attack Dice
- Silver 4 runes: 1 Critical Attack Dice + 1 Basic Attack Dice
- Silver 5 runes: 1 Magic Attack Dice
- Gold 6 runes: 1 Magic Attack Dice + 1 Critical Attack Dice
- Gold 7 runes: 2 Magic Attack Dice
- Prismatic 8 runes: 1 Arcane Attack Dice
- Prismatic 9 runes: 1 Arcane Attack Dice + 1 Exalted Attack Dice

### Strategist
- **Position:** 6
- **Color:** #6b7280
- **Icon:** `17e08cde-f3d2-480b-8386-1e3047e2f85a/class_strategist_icon.png`
- **Description:** Before the Battle Loop Phase in any battle, you may choose a Strategy. The effect will persist through the entire battle loop and cannot be changed.
- **Tags:** Special

**Rune Breakpoints:**
- 2 runes: (empty)
- 3 runes: 2x atk / 2x def
- 4 runes: 3x atk / 3x def
- 2 runes: 4x atk / 4x def

**Effect Schema (by Rune Cost):**
- Bronze 2 runes: Strategy: Imitate - Gain 1 trait of any class.
- 2 runes: Strategy: All for One: Remove all attack dice and defense. Gain 1 magic dice.
- Gold 3 runes: Strategy: Magic Backup - Your backup units may deflect incoming attack dice back to the original player.
- Gold 4 runes: Strategy: Divine Intellect - All your dice may become Exalted Attack Dice.
- Prismatic 5 runes: (All Unique) Strategy: Combat Mastery: You may gain 4 breakpoints on any class with numerical breakpoints.

### Animal
- **Position:** 8
- **Color:** #6b7280
- **Icon:** `f5438f3c-2052-4093-b402-893a45cf7046/class_animal_icon.png`
- **Description:** Animals are cute. Animals grant access to select locations on the board if you play the Recall intent.
- **Tags:** Special

**Rune Breakpoints:** (none)

**Prismatic Effect:**
- **Animal Squad:** Gain 5 tokens that are the type of any of your current Animal spirits.

**Effect Schema (by Rune Cost):**
- 3 runes: Monster Fetch - If you are attacking a monster, you may gain the rewards even if you didn't kill it.

### Hero Party (Class)
- **Position:** 10
- **Color:** #6b7280
- **Icon:** `aaf8adbe-d24f-4551-aacf-44c037695f63/class_hero_party_class_icon.png`
- **Description:** The Hero Party are a class where units grow stronger over time as they level up.

Hero Party Spirits start at level 0. Hero Party Leveling Tokens increase a spirit's level by 1, with a max level of 3.

**Rune Breakpoints:**
- 1 rune: (Kael) - Gain 2 Defense per Hero Party Level
- 1 rune: (Zarek) - Gain Attack Dice per Hero Party Level
- 1 rune: (Eryn) - Gain Attack Dice per Hero Party Level
- 1 rune: (Nyra) - Gain Critical Attack Dice at level 3, and another at 5
- 1 rune: (Sera) - Reroll opponent attack once on defence at level 3, and another at 5

**Footer:** Deflect: Remove an attack dice from the incoming attack pool and move it to any other player's pool (1 dice given to a player max)

**Effect Schema (by Hero Spirit):**
- Ivyrn: Gain 1 ranged dice at level 1, and another at level 3.
- Kael: Gain 1 defense per Hero Level.
- Maribelle: Gain 1 critical dice at level 2, and another at level 3.
- Mintyheart: Deflect any 1 attack dice at level 3.
- Zarek: Gain 1 melee dice every level.

---
