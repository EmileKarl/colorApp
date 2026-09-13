import type { ObjectModel } from "../types";

/**
 * Sneaker, side view. Zones follow §12's example: corps, semelle, lacets,
 * logo, languette, talon, doublure.
 */
export const SNEAKER: ObjectModel = {
  id: "sneaker_low",
  name: "Sneaker basse",
  category: "shoes",
  kind: "vector",
  views: [],
  zones: [
    {
      id: "body",
      label: "Corps",
      role: "body",
      defaultMaterial: "leather",
      defaultColor: "#f0eee9",
      allowedMaterials: ["leather", "suede", "fabric", "cotton", "plastic"],
    },
    {
      id: "sole",
      label: "Semelle",
      role: "secondary",
      defaultMaterial: "rubber",
      defaultColor: "#ffffff",
      allowedMaterials: ["rubber", "plastic"],
    },
    {
      id: "midsole",
      label: "Semelle intermédiaire",
      role: "trim",
      defaultMaterial: "rubber",
      defaultColor: "#e6e3dd",
      allowedMaterials: ["rubber", "plastic"],
    },
    {
      id: "laces",
      label: "Lacets",
      role: "detail",
      defaultMaterial: "fabric",
      defaultColor: "#f6f4f0",
      allowedMaterials: ["fabric", "cotton", "leather"],
    },
    {
      id: "tongue",
      label: "Languette",
      role: "detail",
      defaultMaterial: "fabric",
      defaultColor: "#eceae5",
      allowedMaterials: ["fabric", "cotton", "leather", "suede"],
    },
    {
      id: "heel",
      label: "Talon",
      role: "secondary",
      defaultMaterial: "leather",
      defaultColor: "#e4e1db",
      allowedMaterials: ["leather", "suede", "fabric"],
    },
    {
      id: "lining",
      label: "Doublure",
      role: "trim",
      defaultMaterial: "fabric",
      defaultColor: "#d9d6d0",
      allowedMaterials: ["fabric", "cotton", "suede"],
    },
    {
      id: "logo",
      label: "Logo",
      role: "accent",
      defaultMaterial: "leather",
      defaultColor: "#2c2c2c",
      allowedMaterials: ["leather", "rubber", "plastic", "metal"],
    },
  ],
  vector: {
    viewBox: { width: 460, height: 280 },
    layers: [
      {
        kind: "zone",
        zone: "body",
        d: "M30 186 Q34 122 98 98 L212 62 Q252 50 290 66 L356 98 Q410 120 418 186 Z",
      },
      {
        kind: "zone",
        zone: "heel",
        d: "M356 98 Q410 120 418 186 L372 186 Q364 124 340 102 Z",
      },
      {
        kind: "zone",
        zone: "tongue",
        d: "M182 74 Q198 42 240 40 L268 52 L254 98 L198 108 Z",
      },
      { kind: "zone", zone: "lining", d: "M268 52 L290 66 L280 102 L254 98 Z" },
      {
        kind: "zone",
        zone: "laces",
        d: "M126 106 L188 84 L192 98 L130 120 Z M140 128 L202 106 L206 120 L144 142 Z M154 150 L216 128 L220 142 L158 164 Z",
      },
      {
        kind: "zone",
        zone: "logo",
        d: "M214 174 Q272 142 334 152 L338 172 Q280 162 224 190 Z",
      },
      {
        kind: "zone",
        zone: "midsole",
        d: "M26 182 L420 182 Q426 198 422 204 L24 204 Q20 194 26 182 Z",
      },
      {
        kind: "zone",
        zone: "sole",
        d: "M24 202 Q20 232 54 234 L396 234 Q428 232 422 202 Z",
      },

      // Shading
      {
        kind: "shade",
        role: "occlusion",
        zone: "body",
        opacity: 0.4,
        d: "M198 108 L254 98 L250 122 L200 130 Z",
      },
      {
        kind: "shade",
        role: "shadow",
        zone: "body",
        opacity: 0.45,
        d: "M30 186 L418 186 L418 172 Q230 148 30 172 Z",
      },
      {
        kind: "shade",
        role: "highlight",
        zone: "body",
        opacity: 0.5,
        d: "M98 98 L212 62 Q252 50 290 66 L286 80 Q250 66 214 78 L106 112 Z",
      },
      {
        kind: "shade",
        role: "shadow",
        zone: "sole",
        opacity: 0.35,
        d: "M24 222 L422 222 L420 202 L26 202 Z",
      },
      {
        kind: "shade",
        role: "contact",
        zone: "sole",
        opacity: 0.45,
        d: "M40 228 L406 228 L396 234 L54 234 Z",
      },
    ],
  },
};
