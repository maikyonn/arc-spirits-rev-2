import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

type SpiritRow = {
  id: string;
  name: string;
  cost: number;
  traits: { origin_ids?: string[]; class_ids?: string[] } | null;
  game_print_image_path: string | null;
};

type NamedId = { id: string; name: string };

type ArtifactRow = {
  id: string;
  name: string;
  recipe_box: unknown;
  guardian_id: string | null;
  tag_ids: string[] | null;
  card_image_path: string | null;
};

type GuardianRow = {
  id: string;
  name: string;
  origin_id: string | null;
  image_mat_path: string | null;
  chibi_image_path: string | null;
  icon_image_path: string | null;
};

type MonsterRow = {
  id: string;
  name: string;
  state: string | null;
  barrier: number | null;
  damage: number | null;
  order_num: number | null;
  card_image_path: string | null;
};

type EventRow = {
  id: string;
  name: string;
  title: string;
  description: string;
  order_num: number | null;
  card_image_path: string | null;
};

type MiscAssetRow = {
  id: string;
  name: string;
  file_path: string | null;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
};

type EditionRow = {
  id: string;
  name: string;
  origin_ids: string[] | null;
  cost_duplicates: Record<string, number> | null;
};

type RuneRow = {
  id: string;
  name: string;
  origin_id: string | null;
  class_id: string | null;
  icon_path: string | null;
};

type CustomDiceRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  dice_type: "attack" | "special";
  background_image_path: string | null;
  exported_template_path: string | null;
};

type DiceSideRow = {
  id: string;
  dice_id: string;
  side_number: number;
  reward_type: "attack" | "special";
  reward_value: string;
  reward_description: string | null;
};

type ClassRow = {
  id: string;
  name: string;
  position: number;
  icon_emoji: string | null;
  icon_png: string | null;
  color: string | null;
  description: string | null;
  tags: string[] | null;
  effect_schema: unknown | null;
  footer: string | null;
};

type OriginRow = {
  id: string;
  name: string;
  position: number;
  color: string | null;
  description: string | null;
  icon_png: string | null;
  calling_card: {
    enabled: boolean;
    hex_spirit_id: string | null;
    breakpoints: { count: number; label?: string; icon_ids: string[] }[];
  } | null;
};

type CallingOrbImageRow = {
  id: string;
  origin_id: string;
  image_path: string;
};

type HexSpiritBasic = {
  id: string;
  name: string;
  cost: number;
  game_print_image_path: string | null;
  traits: { origin_ids?: string[]; class_ids?: string[] } | null;
};

const SCHEMA = "arc-spirits-rev2";
const BUCKET = "game_assets";

const stringify = (obj: unknown) =>
  JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

// Storage render base URL (image transformation endpoint)
const storageRenderBaseUrl = (req: Request) => {
  const host = new URL(req.url).host; // e.g., gvxfokbptelmvvlxbigh.functions.supabase.co
  const projectRef = host.split(".")[0];
  return `https://${projectRef}.supabase.co/storage/v1/render/image/public/${BUCKET}/`;
};

serve(async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  // Parse edition query parameter (default to "Base")
  const url = new URL(req.url);
  const editionName = url.searchParams.get("edition") ?? "Base";

  const dbUrl =
    Deno.env.get("SUPABASE_DB_URL") ??
    Deno.env.get("SUPABASE_DB_CONNECTION_STRING") ??
    Deno.env.get("DATABASE_URL");
  if (!dbUrl) return new Response("Database connection string not set", { status: 500 });

  const client = new Client(dbUrl);
  await client.connect();

  try {
    // Fetch the edition first
    const editionRes = await client.queryObject<EditionRow>(
      `select id, name, origin_ids, cost_duplicates from "${SCHEMA}".editions where name = $1`,
      [editionName]
    );

    if (editionRes.rows.length === 0) {
      return new Response(`Edition "${editionName}" not found`, { status: 404 });
    }

    const edition = editionRes.rows[0];
    const editionOriginIds = edition.origin_ids ?? [];
    const costDuplicates = edition.cost_duplicates ?? {};

    const [originsRes, classesRes, tagsRes, guardiansRes, monstersRes, eventsRes, miscAssetsRes, spiritsRes, artifactsRes, runesRes, originsFullRes, callingOrbsRes, hexSpiritsBasicRes, customDiceRes, classesFullRes, diceSidesRes] = await Promise.all([
      client.queryObject<NamedId>(`select id, name from "${SCHEMA}".origins`),
      client.queryObject<NamedId>(`select id, name from "${SCHEMA}".classes`),
      client.queryObject<NamedId>(`select id, name from "${SCHEMA}".artifact_tags`),
      client.queryObject<GuardianRow>(
        `select id, name, origin_id, image_mat_path, chibi_image_path, icon_image_path from "${SCHEMA}".guardians`
      ),
      client.queryObject<MonsterRow>(
        `select id, name, state, barrier, damage, order_num, card_image_path from "${SCHEMA}".monsters`
      ),
      client.queryObject<EventRow>(
        `select id, name, title, description, order_num, card_image_path from "${SCHEMA}".events`
      ),
      client.queryObject<MiscAssetRow>(
        `select id, name, file_path, file_type, file_size, category from "${SCHEMA}".misc_assets order by category, name`
      ),
      client.queryObject<SpiritRow>(`select id, name, cost, traits, game_print_image_path from "${SCHEMA}".hex_spirits`),
      client.queryObject<ArtifactRow>(`select id, name, recipe_box, guardian_id, tag_ids, card_image_path from "${SCHEMA}".artifacts`),
      client.queryObject<RuneRow>(`select id, name, origin_id, class_id, icon_path from "${SCHEMA}".runes`),
      // Full origins with calling card data
      client.queryObject<OriginRow>(`select id, name, position, color, description, icon_png, calling_card from "${SCHEMA}".origins order by position`),
      // Calling orb images
      client.queryObject<CallingOrbImageRow>(`select id, origin_id, image_path from "${SCHEMA}".calling_orb_images`),
      // Basic hex spirit info for calling card associations
      client.queryObject<HexSpiritBasic>(`select id, name, cost, game_print_image_path, traits from "${SCHEMA}".hex_spirits`),
      // Custom dice with their prefab templates
      client.queryObject<CustomDiceRow>(`select id, name, description, icon, color, dice_type, background_image_path, exported_template_path from "${SCHEMA}".custom_dice`),
      // Full classes with effect schema (contains dice_id references in breakpoints)
      client.queryObject<ClassRow>(`select id, name, position, icon_emoji, icon_png, color, description, tags, effect_schema, footer from "${SCHEMA}".classes order by position`),
      // Dice sides for face value counts
      client.queryObject<DiceSideRow>(`select id, dice_id, side_number, reward_type, reward_value, reward_description from "${SCHEMA}".dice_sides order by dice_id, side_number`),
    ]);

    const originMap = new Map(originsRes.rows.map((r) => [r.id, r.name]));
    const classMap = new Map(classesRes.rows.map((r) => [r.id, r.name]));
    const tagMap = new Map(tagsRes.rows.map((r) => [r.id, r.name]));
    const base = storageRenderBaseUrl(req);

    // Build calling orb images map (origin_id -> image_path)
    const callingOrbMap = new Map(callingOrbsRes.rows.map((r) => [r.origin_id, r.image_path]));

    // Build hex spirits map for calling card associations
    const hexSpiritMap = new Map(hexSpiritsBasicRes.rows.map((r) => [r.id, r]));

    // Build dice sides map (dice_id -> sides array)
    const diceSidesMap = new Map<string, DiceSideRow[]>();
    for (const side of diceSidesRes.rows) {
      const existing = diceSidesMap.get(side.dice_id) ?? [];
      existing.push(side);
      diceSidesMap.set(side.dice_id, existing);
    }

    // Map origins with calling cards and calling orb images
    const origins = originsFullRes.rows.map((o) => {
      const icon_url = o.icon_png ? `${base}${encodeURI(o.icon_png)}?quality=30` : null;
      const callingOrbPath = callingOrbMap.get(o.id);
      const calling_orb_image_url = callingOrbPath ? `${base}${encodeURI(callingOrbPath)}?quality=30` : null;

      // Get associated hex spirit if calling card is enabled
      // Structure matches the hex_spirits array output exactly
      let associated_hex_spirit = null;
      if (o.calling_card?.enabled && o.calling_card?.hex_spirit_id) {
        const spirit = hexSpiritMap.get(o.calling_card.hex_spirit_id);
        if (spirit) {
          const spiritOriginIds = spirit.traits?.origin_ids ?? [];
          const spiritClassIds = spirit.traits?.class_ids ?? [];
          associated_hex_spirit = {
            id: spirit.id,
            name: spirit.name,
            cost: spirit.cost,
            traits: {
              origins: spiritOriginIds.map((id) => ({ id, name: originMap.get(id) ?? null })),
              classes: spiritClassIds.map((id) => ({ id, name: classMap.get(id) ?? null })),
            },
            image_url: spirit.game_print_image_path
              ? `${base}${encodeURI(spirit.game_print_image_path)}?quality=30`
              : null,
          };
        }
      }

      return {
        id: o.id,
        name: o.name,
        position: o.position,
        color: o.color,
        description: o.description,
        icon_url,
        calling_card: o.calling_card?.enabled
          ? {
              enabled: true,
              breakpoints: o.calling_card.breakpoints,
              hex_spirit_id: o.calling_card.hex_spirit_id,
            }
          : null,
        calling_orb_image_url,
        associated_hex_spirit,
      };
    });

    const guardians = guardiansRes.rows.map((g) => {
      const origin_name = g.origin_id ? originMap.get(g.origin_id) ?? null : null;
      const mat_image_url = g.image_mat_path
        ? `${base}${encodeURI(g.image_mat_path)}?quality=30`
        : null;
      const chibi_image_url = g.chibi_image_path
        ? `${base}${encodeURI(g.chibi_image_path)}?quality=30`
        : null;
      const icon_image_url = g.icon_image_path
        ? `${base}${encodeURI(g.icon_image_path)}?quality=30`
        : null;
      return {
        name: g.name,
        origin_id: g.origin_id,
        origin_name,
        mat_image_url,
        chibi_image_url,
        icon_image_url,
      };
    });

    // Filter spirits by edition's origin_ids and duplicate based on cost_duplicates
    const hex_spirits: {
      id: string;
      name: string;
      cost: number;
      traits: { origins: { id: string; name: string | null }[]; classes: { id: string; name: string | null }[] };
      image_url: string | null;
      copy_index: number;
    }[] = [];

    for (const s of spiritsRes.rows) {
      const spiritOriginIds = s.traits?.origin_ids ?? [];

      // Check if spirit has at least one origin that matches the edition
      const hasMatchingOrigin = spiritOriginIds.some((oid) => editionOriginIds.includes(oid));
      if (!hasMatchingOrigin) continue;

      const origins = spiritOriginIds.map((id) => ({ id, name: originMap.get(id) ?? null }));
      const classes = (s.traits?.class_ids ?? []).map((id) => ({ id, name: classMap.get(id) ?? null }));
      const image_url = s.game_print_image_path
        ? `${base}${encodeURI(s.game_print_image_path)}?quality=30`
        : null;

      // Get duplicate count for this spirit's cost (default to 1)
      const duplicateCount = costDuplicates[String(s.cost)] ?? 1;

      // Add copies based on duplicate count
      for (let i = 0; i < duplicateCount; i++) {
        hex_spirits.push({
          id: s.id,
          name: s.name,
          cost: s.cost,
          traits: { origins, classes },
          image_url,
          copy_index: i + 1,
        });
      }
    }

    const artifacts = artifactsRes.rows.map((a) => {
      const tag_ids = a.tag_ids ?? [];
      const tag_names = tag_ids.map((id) => tagMap.get(id) ?? null);
      const image_path = a.card_image_path
        ? `${base}${encodeURI(a.card_image_path)}?quality=30`
        : null;
      return {
        id: a.id,
        name: a.name,
        recipe_box: a.recipe_box,
        guardian_id: a.guardian_id,
        image_path,
        tag_ids,
        tag_names,
      };
    });

    // Map monsters
    const monsterCards = monstersRes.rows.map((m) => {
      const image_url = m.card_image_path
        ? `${base}${encodeURI(m.card_image_path)}?quality=30`
        : null;
      return {
        id: m.id,
        name: m.name,
        type: "monster" as const,
        state: m.state,
        barrier: m.barrier,
        damage: m.damage,
        order_num: m.order_num ?? 999,
        image_url,
      };
    });

    // Map events (same structure as monsters for TTS compatibility)
    const eventCards = eventsRes.rows.map((e) => {
      const image_url = e.card_image_path
        ? `${base}${encodeURI(e.card_image_path)}?quality=30`
        : null;
      return {
        id: e.id,
        name: e.title, // Use title as the display name
        type: "event" as const,
        state: "event",
        barrier: null,
        damage: null,
        order_num: e.order_num ?? 999,
        image_url,
        // Event-specific fields
        event_name: e.name,
        description: e.description,
      };
    });

    // Combine and sort by order_num
    const monsters = [...monsterCards, ...eventCards].sort(
      (a, b) => (a.order_num ?? 999) - (b.order_num ?? 999)
    );

    // Group misc assets by category
    const miscAssetsByCategory: Record<string, {
      id: string;
      name: string;
      file_type: string | null;
      file_size: number | null;
      image_url: string | null;
    }[]> = {};

    for (const asset of miscAssetsRes.rows) {
      const category = asset.category ?? "uncategorized";
      const image_url = asset.file_path ? `${base}${encodeURI(asset.file_path)}?quality=30` : null;

      if (!miscAssetsByCategory[category]) {
        miscAssetsByCategory[category] = [];
      }

      miscAssetsByCategory[category].push({
        id: asset.id,
        name: asset.name,
        file_type: asset.file_type,
        file_size: asset.file_size,
        image_url,
      });
    }

    // Map runes with origin/class names resolved
    const runes = runesRes.rows.map((r) => {
      const origin_name = r.origin_id ? originMap.get(r.origin_id) ?? null : null;
      const class_name = r.class_id ? classMap.get(r.class_id) ?? null : null;
      const icon_url = r.icon_path ? `${base}${encodeURI(r.icon_path)}?quality=30` : null;
      return {
        id: r.id,
        name: r.name,
        type: r.origin_id ? "origin" : "class",
        origin_id: r.origin_id,
        origin_name,
        class_id: r.class_id,
        class_name,
        icon_url,
      };
    });

    // Map custom dice with prefab template URLs and face counts
    const custom_dice = customDiceRes.rows.map((d) => {
      const prefab_image_url = d.exported_template_path
        ? `${base}${encodeURI(d.exported_template_path)}?quality=30`
        : null;

      // Get sides for this dice and build faces array
      const sides = diceSidesMap.get(d.id) ?? [];
      const faces = sides.map((s) => ({
        side_number: s.side_number,
        reward_type: s.reward_type,
        reward_value: s.reward_value,
        reward_description: s.reward_description,
      }));

      return {
        id: d.id,
        name: d.name,
        description: d.description,
        icon: d.icon,
        color: d.color,
        dice_type: d.dice_type,
        prefab_image_url,
        faces,
      };
    });

    // Map classes with effect schema (contains dice_id references in breakpoints)
    const classes = classesFullRes.rows.map((c) => {
      const icon_url = c.icon_png ? `${base}${encodeURI(c.icon_png)}?quality=30` : null;
      return {
        id: c.id,
        name: c.name,
        position: c.position,
        icon_emoji: c.icon_emoji,
        icon_url,
        color: c.color,
        description: c.description,
        tags: c.tags,
        effect_schema: c.effect_schema,
        footer: c.footer,
      };
    });

    const body = stringify({
      exported_at: new Date().toISOString(),
      edition: {
        name: edition.name,
        origin_count: editionOriginIds.length,
        cost_duplicates: costDuplicates,
      },
      origins,
      classes,
      hex_spirits,
      artifacts,
      misc_assets: miscAssetsByCategory,
      monsters,
      guardians,
      runes,
      custom_dice,
    });

    const lastModified = new Date().toUTCString();

    // Sanitize edition name for filename (replace spaces with dashes, remove special chars)
    const safeEditionName = edition.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="tts-export-${safeEditionName}-${new Date().toISOString().slice(0, 10)}.json"`,
        "Access-Control-Allow-Origin": "*",
        "Last-Modified": lastModified,
      },
    });
  } catch (error) {
    console.error("Export failed", error);
    return new Response(`Export failed: ${error instanceof Error ? error.message : error}`, { status: 500 });
  } finally {
    await client.end();
  }
});
