import type { ObjectModel } from "../types";

/**
 * Car, side view. Zones follow §12's example: carrosserie, toit, jantes,
 * vitres, poignées, plus the rocker trim.
 *
 * Glass is a separate zone with a material default of `glass`, which is the
 * only material below full opacity — so windows read as windows rather than as
 * body panels in a different color.
 */
export const CAR: ObjectModel = {
  id: "car_coupe",
  name: "Voiture coupé",
  category: "automotive",
  kind: "vector",
  views: [],
  zones: [
    {
      id: "body",
      label: "Carrosserie",
      role: "body",
      defaultMaterial: "car_paint",
      defaultColor: "#d9dade",
      allowedMaterials: ["car_paint", "metal", "plastic", "satin"],
    },
    {
      id: "roof",
      label: "Toit",
      role: "secondary",
      defaultMaterial: "car_paint",
      defaultColor: "#d9dade",
      allowedMaterials: ["car_paint", "metal", "glass", "satin"],
    },
    {
      id: "glass",
      label: "Vitres",
      role: "detail",
      defaultMaterial: "glass",
      defaultColor: "#2f3a46",
      allowedMaterials: ["glass"],
    },
    {
      id: "rims",
      label: "Jantes",
      role: "accent",
      defaultMaterial: "metal",
      defaultColor: "#b9bcc2",
      allowedMaterials: ["metal", "car_paint", "plastic"],
    },
    {
      id: "tyres",
      label: "Pneus",
      role: "hardware",
      defaultMaterial: "rubber",
      defaultColor: "#1c1d20",
      allowedMaterials: ["rubber"],
    },
    {
      id: "trim",
      label: "Bas de caisse",
      role: "trim",
      defaultMaterial: "plastic",
      defaultColor: "#3a3c40",
      allowedMaterials: ["plastic", "metal", "car_paint", "rubber"],
    },
    {
      id: "handles",
      label: "Poignées",
      role: "hardware",
      defaultMaterial: "metal",
      defaultColor: "#c4c7cc",
      allowedMaterials: ["metal", "plastic", "car_paint"],
    },
  ],
  vector: {
    viewBox: { width: 480, height: 240 },
    layers: [
      {
        kind: "zone",
        zone: "body",
        d: "M24 160 Q18 122 62 112 L124 104 L170 64 Q206 48 274 52 L326 70 L372 108 L430 120 Q460 128 458 160 L454 178 L26 178 Z",
      },
      {
        kind: "zone",
        zone: "roof",
        d: "M166 68 Q208 46 276 52 L328 72 L310 82 Q240 62 184 84 Z",
      },
      {
        kind: "zone",
        zone: "glass",
        d: "M184 86 Q216 68 250 68 L250 108 L176 108 Z M260 68 Q296 74 314 88 L320 108 L260 108 Z",
      },
      {
        kind: "zone",
        zone: "trim",
        d: "M62 160 L428 160 L426 176 L64 176 Z",
      },
      { kind: "zone", zone: "handles", d: "M206 114 L238 114 L238 124 L206 124 Z M276 114 L308 114 L308 124 L276 124 Z" },

      // Wheels: tyre first, rim painted inside it.
      {
        kind: "zone",
        zone: "tyres",
        d: "M84 178 A38 38 0 1 1 160 178 A38 38 0 1 1 84 178 Z M320 178 A38 38 0 1 1 396 178 A38 38 0 1 1 320 178 Z",
      },
      {
        kind: "zone",
        zone: "rims",
        d: "M102 178 A20 20 0 1 1 142 178 A20 20 0 1 1 102 178 Z M338 178 A20 20 0 1 1 378 178 A20 20 0 1 1 338 178 Z",
      },

      // Shading. The long band under the windows is the car's shoulder line —
      // the single most recognisable piece of automotive form, and the reason
      // a flat-filled car silhouette reads as a cartoon.
      {
        kind: "shade",
        role: "highlight",
        zone: "body",
        opacity: 0.6,
        d: "M40 122 L126 110 L176 112 L320 112 L376 116 L444 128 L444 136 L372 124 L176 120 L126 118 L40 130 Z",
      },
      {
        kind: "shade",
        role: "shadow",
        zone: "body",
        opacity: 0.5,
        d: "M26 150 L456 150 L454 178 L26 178 Z",
      },
      {
        kind: "shade",
        role: "occlusion",
        zone: "body",
        opacity: 0.55,
        d: "M84 150 A38 38 0 0 1 160 150 L150 152 A28 28 0 0 0 94 152 Z M320 150 A38 38 0 0 1 396 150 L386 152 A28 28 0 0 0 330 152 Z",
      },
      {
        kind: "shade",
        role: "highlight",
        zone: "roof",
        opacity: 0.5,
        d: "M182 62 Q222 48 276 54 L276 62 Q224 58 190 70 Z",
      },
      {
        kind: "shade",
        role: "contact",
        zone: "body",
        opacity: 0.45,
        d: "M70 206 L410 206 Q432 214 396 218 L86 218 Q52 214 70 206 Z",
      },
    ],
  },
};
