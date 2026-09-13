import {
  DEFAULT_RENDER_SETTINGS,
  ZONE_ROLE_ORDER,
  type BackgroundStyle,
  type LightingId,
  type ObjectModel,
  type ObjectZone,
  type ProjectData,
  type ZoneRole,
  type ZoneState,
} from "./types";

/**
 * Creating and editing a Studio project.
 *
 * Kept separate from rendering so that "what the user chose" and "what that
 * looks like" never get tangled: undo, remix and save all operate on this
 * state, and the renderer is a pure function of it.
 */

export const DEFAULT_BACKGROUND: BackgroundStyle = { kind: "gradient", from: "#f4f2ee", to: "#e6e2da" };

export function createProject(
  model: ObjectModel,
  options?: { lighting?: LightingId; background?: BackgroundStyle },
): ProjectData {
  const zones: Record<string, ZoneState> = {};
  for (const zone of model.zones) {
    zones[zone.id] = { color: zone.defaultColor, material: zone.defaultMaterial, opacity: 1 };
  }
  return {
    version: 1,
    objectId: model.id,
    zones,
    lighting: options?.lighting ?? "studio",
    render: { ...DEFAULT_RENDER_SETTINGS },
    background: options?.background ?? DEFAULT_BACKGROUND,
  };
}

/** Replaces one zone's state, leaving every other zone untouched. */
export function setZone(
  project: ProjectData,
  zoneId: string,
  patch: Partial<ZoneState>,
): ProjectData {
  const current = project.zones[zoneId];
  if (!current) return project;
  return {
    ...project,
    zones: { ...project.zones, [zoneId]: { ...current, ...patch } },
    // An explicit edit means the state is no longer one of the presets.
    variant: undefined,
  };
}

/**
 * Applies a single captured color to the object — the app's core gesture.
 *
 * Only zones in the `body` role take the color. Painting every zone the same
 * hue produces a monochrome blob in which the object's own structure
 * disappears, which is the opposite of what "see your color on this object"
 * should show; soles, trim and hardware keep their defaults so the form still
 * reads.
 */
export function applyColor(project: ProjectData, model: ObjectModel, hex: string): ProjectData {
  const zones = { ...project.zones };
  for (const zone of model.zones) {
    if (zone.role !== "body") continue;
    const current = zones[zone.id];
    if (current) zones[zone.id] = { ...current, color: hex };
  }
  return { ...project, zones, variant: undefined };
}

/**
 * Distributes a palette across the object's zones by role.
 *
 * Zones are filled in role order — body, secondary, detail, accent, trim,
 * hardware — and the palette is walked in parallel. When the palette is
 * shorter than the number of distinct roles it wraps, which keeps every zone
 * colored rather than leaving some at a default that clashes with the rest.
 */
export function applyPalette(
  project: ProjectData,
  model: ObjectModel,
  palette: string[],
): ProjectData {
  if (palette.length === 0) return project;

  const rolesPresent = ZONE_ROLE_ORDER.filter((role) =>
    model.zones.some((zone) => zone.role === role),
  );
  const colorForRole = new Map<ZoneRole, string>();
  rolesPresent.forEach((role, index) => {
    colorForRole.set(role, palette[index % palette.length]);
  });

  const zones = { ...project.zones };
  for (const zone of model.zones) {
    const color = colorForRole.get(zone.role);
    const current = zones[zone.id];
    if (color && current) zones[zone.id] = { ...current, color };
  }
  return { ...project, zones, variant: undefined };
}

/** The colors currently in use, in role order, without duplicates. */
export function projectPalette(project: ProjectData, model: ObjectModel): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const byRole = [...model.zones].sort(
    (a, b) => ZONE_ROLE_ORDER.indexOf(a.role) - ZONE_ROLE_ORDER.indexOf(b.role),
  );
  for (const zone of byRole) {
    const color = project.zones[zone.id]?.color;
    if (!color || seen.has(color)) continue;
    seen.add(color);
    ordered.push(color);
  }
  return ordered;
}

/** Restores the object's factory colors and materials, keeping the scene. */
export function resetProject(project: ProjectData, model: ObjectModel): ProjectData {
  const fresh = createProject(model, {
    lighting: project.lighting,
    background: project.background,
  });
  return { ...fresh, render: { ...project.render } };
}

export function zonesByRole(model: ObjectModel, role: ZoneRole): ObjectZone[] {
  return model.zones.filter((zone) => zone.role === role);
}

/**
 * Validates and migrates a `project_data` blob read from the database.
 *
 * A creation saved months ago must still open. Anything unrecognisable
 * returns null so the caller can show a real error instead of rendering a
 * half-broken object — §10 requires the failure to be explainable.
 */
export function parseProject(raw: unknown, model: ObjectModel): ProjectData | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<ProjectData>;
  if (candidate.version !== 1) return null;
  if (typeof candidate.objectId !== "string") return null;
  if (!candidate.zones || typeof candidate.zones !== "object") return null;

  // Rebuild from defaults and overlay what was stored, so a zone added to the
  // model since the save still gets a valid state.
  const base = createProject(model);
  const zones: Record<string, ZoneState> = { ...base.zones };
  for (const zone of model.zones) {
    const stored = (candidate.zones as Record<string, unknown>)[zone.id];
    if (!stored || typeof stored !== "object") continue;
    const { color, material, opacity } = stored as Partial<ZoneState>;
    zones[zone.id] = {
      color: typeof color === "string" ? color : base.zones[zone.id].color,
      material: typeof material === "string" ? material : base.zones[zone.id].material,
      opacity: typeof opacity === "number" ? opacity : 1,
    } as ZoneState;
  }

  return {
    version: 1,
    objectId: candidate.objectId,
    zones,
    lighting: candidate.lighting ?? base.lighting,
    render: { ...base.render, ...(candidate.render ?? {}) },
    background: candidate.background ?? base.background,
    variant: candidate.variant,
  };
}
