import type { ObjectModel } from "../types";

/**
 * T-shirt, front view. Zones follow §12's example: corps, col, manches,
 * coutures, logo.
 *
 * Paint order matters: the body is laid down first and the sleeves painted
 * over the region they share with it, so the two can carry different colors
 * without needing a clipped path for each.
 */
export const TSHIRT: ObjectModel = {
  id: "tshirt_classic",
  name: "T-shirt classique",
  category: "fashion",
  kind: "vector",
  views: [],
  zones: [
    {
      id: "body",
      label: "Corps",
      role: "body",
      defaultMaterial: "cotton",
      defaultColor: "#e8e6e1",
      allowedMaterials: ["cotton", "fabric", "satin", "velvet"],
    },
    {
      id: "sleeves",
      label: "Manches",
      role: "secondary",
      defaultMaterial: "cotton",
      defaultColor: "#e8e6e1",
      allowedMaterials: ["cotton", "fabric", "satin", "velvet"],
    },
    {
      id: "collar",
      label: "Col",
      role: "detail",
      defaultMaterial: "cotton",
      defaultColor: "#d8d5cf",
      allowedMaterials: ["cotton", "fabric", "rubber"],
    },
    {
      id: "seams",
      label: "Coutures",
      role: "trim",
      defaultMaterial: "cotton",
      defaultColor: "#c9c5bd",
      allowedMaterials: ["cotton", "fabric"],
    },
    {
      id: "logo",
      label: "Logo",
      role: "accent",
      defaultMaterial: "rubber",
      defaultColor: "#2c2c2c",
      allowedMaterials: ["rubber", "plastic", "metal", "cotton"],
    },
  ],
  vector: {
    viewBox: { width: 400, height: 460 },
    layers: [
      // Torso and sleeves as one silhouette, so the outline stays continuous.
      {
        kind: "zone",
        zone: "body",
        d: "M155 68 Q200 112 245 68 L282 66 L348 106 L320 188 L270 160 L274 424 L126 424 L130 160 L80 188 L52 106 L118 66 Z",
      },
      // Sleeves repaint their share of that silhouette.
      { kind: "zone", zone: "sleeves", d: "M118 66 L52 106 L80 188 L130 160 L132 118 Z" },
      { kind: "zone", zone: "sleeves", d: "M282 66 L348 106 L320 188 L270 160 L268 118 Z" },
      {
        kind: "zone",
        zone: "collar",
        d: "M150 66 Q200 118 250 66 L247 90 Q200 134 153 90 Z",
      },
      // Side seams, sleeve joins and hem, drawn as thin quads rather than
      // strokes so they scale with the model instead of with the viewport.
      {
        kind: "zone",
        zone: "seams",
        d: "M130 162 L134 162 L130 422 L126 422 Z M270 162 L274 162 L270 422 L266 422 Z M126 414 L274 414 L274 419 L126 419 Z M130 118 L134 118 L132 162 L128 162 Z M268 118 L272 118 L270 162 L266 162 Z",
      },
      { kind: "zone", zone: "logo", d: "M176 196 L224 196 L224 232 L176 232 Z" },

      // Shading. These are painted with the colors `shading.ts` derives from
      // the zone's own fill, so volume survives any recoloring (§6).
      {
        kind: "shade",
        role: "occlusion",
        zone: "body",
        opacity: 0.45,
        d: "M153 90 Q200 134 247 90 L251 112 Q200 158 149 112 Z",
      },
      {
        kind: "shade",
        role: "shadow",
        zone: "body",
        opacity: 0.5,
        d: "M130 160 L126 424 L182 424 L180 168 Z",
      },
      {
        kind: "shade",
        role: "shadow",
        zone: "sleeves",
        opacity: 0.4,
        d: "M52 106 L80 188 L104 176 L76 104 Z",
      },
      {
        kind: "shade",
        role: "highlight",
        zone: "body",
        opacity: 0.55,
        d: "M196 130 L238 128 L248 420 L206 420 Z",
      },
      {
        kind: "shade",
        role: "contact",
        zone: "body",
        opacity: 0.35,
        d: "M126 400 L274 400 L274 424 L126 424 Z",
      },
    ],
  },
};
