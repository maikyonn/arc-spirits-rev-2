-- Restore the distinct hexagon-shaped Spirit Augment token art.
--
-- When the class-linked augment rows were dropped from the old `runes` table (mats split),
-- the augment tokens fell back to the plain class icon (icon_png). But Spirit Augments are
-- supposed to render as their dedicated hexagon token art. That art still lives in storage
-- (runes/<old-rune-id>/icon.png). Since augments are now class-derived, give each of the 6
-- augment classes an `augment_token_path` pointing at its hexagon token, so the renderer can
-- prefer it over the bare class icon.

alter table arc_spirits_assets.classes add column if not exists augment_token_path text;

update arc_spirits_assets.classes set augment_token_path = case name
    when 'Fighter'       then 'runes/efa4b29a-06f0-43af-bd11-d60c180e793e/icon.png'
    when 'Elementalist'  then 'runes/d0b484ed-733c-4d55-b549-30e631eec857/icon.png'
    when 'Cultivator'    then 'runes/a844c161-3f67-42d7-ba59-d5efd5df5f98/icon.png'
    when 'Soul Weaver'   then 'runes/33f343e7-6bdb-43cc-8b27-115eaa16826f/icon.png'
    when 'Spirit Animal' then 'runes/f1c4f059-61e0-40ad-ad9a-4e25a8531f49/icon.png'
    when 'Cursed Spirit' then 'runes/44d0b158-8892-42c7-9ce8-1a033da9440d/icon.png'
  end
 where name in ('Fighter','Elementalist','Cultivator','Soul Weaver','Spirit Animal','Cursed Spirit');
