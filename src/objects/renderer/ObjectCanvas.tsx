import {
  Canvas,
  Group,
  Image,
  LinearGradient,
  Mask,
  Path,
  Rect,
  useImage,
  vec,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import type {
  BackgroundStyle,
  ObjectModel,
  ProjectData,
  RenderPlan,
  VectorLayer,
  ZoneRender,
} from "../types";
import { buildRenderPlan, findZoneRender } from "./shading";

type Props = {
  model: ObjectModel;
  project: ProjectData;
  width: number;
  height: number;
  /** Restricts drawing to one zone's silhouette — used by the zone picker. */
  isolateZone?: string;
  /** Dims every zone except this one, so the selected zone stands out. */
  emphasizeZone?: string;
};

/**
 * Draws a recolored object.
 *
 * All of the appearance reasoning happened in `shading.ts`; this component
 * only paints the `RenderPlan` it produces. Keeping the split means the rules
 * that decide how a material looks are unit-tested, and the part that needs a
 * GPU is small enough to read in one sitting.
 *
 * Both model kinds resolve to the same plan, which is what makes a
 * photographic mockup a drop-in replacement for a vector one (§6).
 */
export function ObjectCanvas({
  model,
  project,
  width,
  height,
  isolateZone,
  emphasizeZone,
}: Props) {
  const plan = useMemo(() => buildRenderPlan(model, project), [model, project]);

  return (
    <View style={[styles.container, { width, height }]}>
      <Canvas style={{ width, height }}>
        <Background background={plan.background} width={width} height={height} />
        {model.kind === "vector" ? (
          <VectorObject
            model={model}
            plan={plan}
            width={width}
            height={height}
            isolateZone={isolateZone}
            emphasizeZone={emphasizeZone}
          />
        ) : (
          <RasterObject model={model} plan={plan} width={width} height={height} />
        )}
      </Canvas>
    </View>
  );
}

function Background({
  background,
  width,
  height,
}: {
  background: BackgroundStyle;
  width: number;
  height: number;
}) {
  if (background.kind === "transparent") return null;
  if (background.kind === "solid") {
    return <Rect x={0} y={0} width={width} height={height} color={background.color} />;
  }
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <LinearGradient
        start={vec(0, 0)}
        end={vec(0, height)}
        colors={[background.from, background.to]}
      />
    </Rect>
  );
}

// ---------------------------------------------------------------------------
// Vector models
// ---------------------------------------------------------------------------

function VectorObject({
  model,
  plan,
  width,
  height,
  isolateZone,
  emphasizeZone,
}: {
  model: Extract<ObjectModel, { kind: "vector" }>;
  plan: RenderPlan;
  width: number;
  height: number;
  isolateZone?: string;
  emphasizeZone?: string;
}) {
  const { viewBox, layers } = model.vector;

  // Contain-fit: the whole object is always visible, centred, at the largest
  // scale that fits. Cropping a mockup would hide exactly the zone the user is
  // trying to judge.
  const transform = useMemo(() => {
    const scale = Math.min(width / viewBox.width, height / viewBox.height);
    return [
      { translateX: (width - viewBox.width * scale) / 2 },
      { translateY: (height - viewBox.height * scale) / 2 },
      { scale },
    ];
  }, [width, height, viewBox.width, viewBox.height]);

  const visible = isolateZone
    ? layers.filter((layer) => layerZone(layer) === isolateZone)
    : layers;

  return (
    <Group transform={transform}>
      {visible.map((layer, index) => (
        <VectorLayerNode
          key={`${layer.kind}-${index}`}
          layer={layer}
          plan={plan}
          viewBox={viewBox}
          dimmed={Boolean(emphasizeZone) && layerZone(layer) !== emphasizeZone}
        />
      ))}
    </Group>
  );
}

function layerZone(layer: VectorLayer): string | undefined {
  if (layer.kind === "zone") return layer.zone;
  if (layer.kind === "shade") return layer.zone;
  return undefined;
}

function VectorLayerNode({
  layer,
  plan,
  viewBox,
  dimmed,
}: {
  layer: VectorLayer;
  plan: RenderPlan;
  viewBox: { width: number; height: number };
  dimmed: boolean;
}) {
  // Dimming is opacity, not a grey overlay: an overlay would change the
  // colors the user is judging, which defeats the purpose of the preview.
  const dim = dimmed ? 0.25 : 1;

  if (layer.kind === "outline") {
    return (
      <Path
        path={layer.d}
        style="stroke"
        strokeWidth={layer.width}
        color={plan.ambientColor}
        opacity={layer.opacity * dim}
      />
    );
  }

  if (layer.kind === "zone") {
    const zone = findZoneRender(plan, layer.zone);
    if (!zone) return null;
    return <Path path={layer.d} color={zone.fill} opacity={zone.opacity * dim} />;
  }

  const zone = layer.zone ? findZoneRender(plan, layer.zone) : plan.zones[0];
  if (!zone) return null;
  return (
    <ShadeLayer
      d={layer.d}
      role={layer.role}
      baseOpacity={layer.opacity * dim}
      zone={zone}
      lightAngle={plan.lightAngle}
      viewBox={viewBox}
    />
  );
}

function ShadeLayer({
  d,
  role,
  baseOpacity,
  zone,
  lightAngle,
  viewBox,
}: {
  d: string;
  role: "shadow" | "highlight" | "occlusion" | "contact";
  baseOpacity: number;
  zone: ZoneRender;
  lightAngle: number;
  viewBox: { width: number; height: number };
}) {
  if (role === "highlight") {
    // The highlight fades out along the light direction, and how quickly it
    // fades is the material's specular tightness: a mirror concentrates it
    // into a small bright spot, suede spreads it across the whole form.
    const { start, end } = gradientAxis(lightAngle, viewBox);
    const stop = 0.15 + (1 - zone.specularTightness) * 0.7;
    return (
      <Path path={d} opacity={baseOpacity * zone.highlightOpacity}>
        <LinearGradient
          start={start}
          end={end}
          colors={[zone.highlightColor, zone.highlightColor, "#00000000"]}
          positions={[0, Math.min(stop, 0.85), 1]}
        />
      </Path>
    );
  }

  // Shadow, occlusion and contact all use the zone's derived shadow color,
  // which is the base color darkened toward the ambient light rather than
  // toward black — see the reasoning in shading.ts.
  const strength =
    role === "contact" ? 1 : role === "occlusion" ? 0.9 : zone.shadowOpacity;
  return <Path path={d} color={zone.shadowColor} opacity={baseOpacity * strength} />;
}

/** Start/end points for a gradient running along `angle`, across the box. */
function gradientAxis(angle: number, box: { width: number; height: number }) {
  const radians = ((angle - 90) * Math.PI) / 180;
  const cx = box.width / 2;
  const cy = box.height / 2;
  const reach = Math.max(box.width, box.height) / 2;
  return {
    start: vec(cx - Math.cos(radians) * reach, cy - Math.sin(radians) * reach),
    end: vec(cx + Math.cos(radians) * reach, cy + Math.sin(radians) * reach),
  };
}

// ---------------------------------------------------------------------------
// Raster models (photographic mockups)
// ---------------------------------------------------------------------------

/**
 * Photographic mockup compositing.
 *
 * The technique §6 describes: the base photograph carries the volumes as
 * luminance, each zone's color multiplies over it inside that zone's mask, and
 * the highlight and texture maps are re-applied on top so specular detail and
 * material grain survive the recoloring.
 *
 * Untested against real assets — the project has no photographic mockups yet
 * (audit decision 1). The code path exists so that adding one is a data change
 * rather than a code change.
 */
function RasterObject({
  model,
  plan,
  width,
  height,
}: {
  model: Extract<ObjectModel, { kind: "raster" }>;
  plan: RenderPlan;
  width: number;
  height: number;
}) {
  const base = useImage(model.raster.baseUrl);
  const highlights = useImage(model.raster.highlightsUrl ?? null);
  const texture = useImage(model.raster.textureUrl ?? null);

  if (!base) return null;

  return (
    <Group>
      <Image image={base} x={0} y={0} width={width} height={height} fit="contain" />
      {plan.zones.map((zone) => (
        <RasterZone
          key={zone.zoneId}
          zone={zone}
          maskUrl={model.raster.maskUrls[zone.zoneId]}
          base={base}
          width={width}
          height={height}
        />
      ))}
      {highlights ? (
        <Image
          image={highlights}
          x={0}
          y={0}
          width={width}
          height={height}
          fit="contain"
          blendMode="screen"
        />
      ) : null}
      {texture ? (
        <Image
          image={texture}
          x={0}
          y={0}
          width={width}
          height={height}
          fit="contain"
          blendMode="multiply"
          opacity={0.6}
        />
      ) : null}
    </Group>
  );
}

function RasterZone({
  zone,
  maskUrl,
  base,
  width,
  height,
}: {
  zone: ZoneRender;
  maskUrl?: string;
  base: ReturnType<typeof useImage>;
  width: number;
  height: number;
}) {
  const mask = useImage(maskUrl ?? null);
  if (!mask || !base) return null;

  return (
    <Mask
      mode="luminance"
      mask={<Image image={mask} x={0} y={0} width={width} height={height} fit="contain" />}
    >
      {/* Multiply is what preserves the volumes: the color scales the
          photograph's luminance rather than replacing it, so every fold,
          shadow and crease the photo captured is still there underneath. */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        color={zone.fill}
        blendMode="multiply"
        opacity={zone.opacity}
      />
    </Mask>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden" },
});
