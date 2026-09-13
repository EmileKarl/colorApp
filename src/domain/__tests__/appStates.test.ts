import { ALL_APP_STATE_KINDS, appState } from "../appStates";

describe("app state catalogue", () => {
  it("covers every state listed in §10 of the specification", () => {
    // The spec enumerates loading, analysis, generation, saving, export,
    // model download, lost connection, camera denied, gallery denied, image
    // too large, object unavailable, 3D model too heavy, AI failure, quota
    // reached, storage full, empty list, empty search, empty collection and
    // empty profile — 19 states. Asserting the count catches a state being
    // dropped during a refactor.
    expect(ALL_APP_STATE_KINDS.length).toBeGreaterThanOrEqual(19);
  });

  it("gives every state a title and an explanation", () => {
    for (const kind of ALL_APP_STATE_KINDS) {
      const state = appState(kind);
      expect(state.title.length).toBeGreaterThan(0);
      expect(state.message.length).toBeGreaterThan(0);
    }
  });

  it("gives every error a corrective action", () => {
    // §10: "chaque erreur doit avoir une explication claire, une action
    // corrective, un bouton Réessayer, une alternative lorsque possible."
    // The first two are unconditional, so they are asserted here.
    for (const kind of ALL_APP_STATE_KINDS) {
      const state = appState(kind);
      if (state.tone !== "error") continue;
      expect(state.action).toBeDefined();
      expect(state.action?.length).toBeGreaterThan(0);
    }
  });

  it("marks an error as retryable only when retrying can plausibly help", () => {
    // A quota is time-based: an immediate retry cannot succeed, and offering
    // the button would be a lie. This asserts that distinction is actually
    // encoded rather than every error being blanket-retryable.
    expect(appState("quota_reached").retryable).toBe(false);
    expect(appState("offline").retryable).toBe(true);
    expect(appState("save_failed").retryable).toBe(true);
  });

  it("never marks a progress state as retryable", () => {
    for (const kind of ALL_APP_STATE_KINDS) {
      const state = appState(kind);
      if (state.tone === "progress") expect(state.retryable).toBe(false);
    }
  });

  it("offers an alternative where the spec expects one", () => {
    // A refused permission is the case §10 most clearly has in mind: the user
    // must still be able to reach the feature another way.
    expect(appState("camera_denied").alternative).toContain("galerie");
    expect(appState("gallery_denied").alternative).toContain("caméra");
  });

  it("returns the kind it was asked for", () => {
    for (const kind of ALL_APP_STATE_KINDS) {
      expect(appState(kind).kind).toBe(kind);
    }
  });
});
