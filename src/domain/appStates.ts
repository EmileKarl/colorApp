/**
 * The complete catalogue of loading, empty and error states required by §10 of
 * the ColorLens specification.
 *
 * It lives in the domain layer, not inside a component, for two reasons:
 *
 * - §10 requires that *every* error carry an explanation, a corrective action,
 *   a retry affordance and an alternative where one exists. Expressing that as
 *   data makes it testable — a unit test can assert that no state ships with
 *   an empty explanation or a missing action, which a hand-written screen
 *   cannot guarantee.
 * - The same state appears on several screens (a refused camera permission is
 *   the same message in Scanner and in Studio). One definition keeps the
 *   wording identical.
 */

export type AppStateKind =
  // Progress
  | "loading"
  | "analyzing"
  | "generating"
  | "saving"
  | "exporting"
  | "downloading_model"
  // Failures
  | "offline"
  | "camera_denied"
  | "gallery_denied"
  | "image_too_large"
  | "invalid_image"
  | "analysis_failed"
  | "object_unavailable"
  | "model_too_heavy"
  | "ai_failed"
  | "quota_reached"
  | "storage_full"
  | "save_failed"
  | "export_failed"
  // Empty
  | "empty_list"
  | "no_results"
  | "empty_collection"
  | "empty_profile"
  | "signed_out";

export type AppStateTone = "progress" | "error" | "empty";

export type AppState = {
  kind: AppStateKind;
  tone: AppStateTone;
  /** Ionicons glyph name. */
  icon: string;
  title: string;
  /** What happened, in plain language — never an error code. */
  message: string;
  /** What the user can do about it. Always present for errors. */
  action?: string;
  /** True when retrying the same operation can plausibly succeed. */
  retryable: boolean;
  /** A different route to the same goal, when one exists (§10). */
  alternative?: string;
};

const STATES: Record<AppStateKind, Omit<AppState, "kind">> = {
  // ---- Progress -----------------------------------------------------------
  loading: {
    tone: "progress",
    icon: "hourglass-outline",
    title: "Chargement…",
    message: "Un instant, on récupère tes données.",
    retryable: false,
  },
  analyzing: {
    tone: "progress",
    icon: "color-wand-outline",
    title: "Analyse de la couleur…",
    message: "On mesure la couleur, on corrige l'éclairage et on estime la confiance.",
    retryable: false,
  },
  generating: {
    tone: "progress",
    icon: "sparkles-outline",
    title: "Génération en cours…",
    message: "On prépare les variantes à partir de ta couleur.",
    retryable: false,
  },
  saving: {
    tone: "progress",
    icon: "cloud-upload-outline",
    title: "Enregistrement…",
    message: "Ta création est en cours de sauvegarde.",
    retryable: false,
  },
  exporting: {
    tone: "progress",
    icon: "download-outline",
    title: "Export en cours…",
    message: "On génère ton image.",
    retryable: false,
  },
  downloading_model: {
    tone: "progress",
    icon: "cube-outline",
    title: "Téléchargement du modèle…",
    message: "Le modèle est mis en cache : la prochaine fois, il s'ouvrira instantanément.",
    retryable: false,
  },

  // ---- Failures -----------------------------------------------------------
  offline: {
    tone: "error",
    icon: "cloud-offline-outline",
    title: "Pas de connexion",
    message: "Impossible de joindre le serveur. Tes couleurs déjà enregistrées restent lisibles.",
    action: "Vérifie ta connexion, puis réessaie.",
    retryable: true,
    alternative: "Tu peux continuer à scanner et à créer hors ligne.",
  },
  camera_denied: {
    tone: "error",
    icon: "camera-outline",
    title: "Accès à la caméra refusé",
    message: "ColorLens a besoin de la caméra pour capturer une couleur réelle.",
    action: "Autorise la caméra dans les réglages de ton téléphone.",
    retryable: true,
    alternative: "Tu peux aussi importer une photo depuis ta galerie.",
  },
  gallery_denied: {
    tone: "error",
    icon: "images-outline",
    title: "Accès à la galerie refusé",
    message: "ColorLens a besoin de la galerie pour analyser une photo existante.",
    action: "Autorise l'accès aux photos dans les réglages.",
    retryable: true,
    alternative: "Tu peux capturer une couleur directement avec la caméra.",
  },
  image_too_large: {
    tone: "error",
    icon: "resize-outline",
    title: "Image trop lourde",
    message: "Cette image dépasse la taille que l'on peut analyser sur l'appareil.",
    action: "Choisis une image plus petite, ou recadre-la avant de réessayer.",
    retryable: true,
    alternative: "Une capture d'écran de l'image fonctionne aussi.",
  },
  invalid_image: {
    tone: "error",
    icon: "alert-circle-outline",
    title: "Image illisible",
    message: "Ce fichier n'est pas une image que l'on sait décoder.",
    action: "Essaie avec une photo JPEG ou PNG.",
    retryable: true,
  },
  analysis_failed: {
    tone: "error",
    icon: "eyedrop-outline",
    title: "Analyse impossible",
    message: "La zone choisie ne contient pas assez d'information pour mesurer une couleur.",
    action: "Vise une surface unie, mieux éclairée, et réessaie.",
    retryable: true,
    alternative: "Tu peux aussi choisir une autre zone de l'image.",
  },
  object_unavailable: {
    tone: "error",
    icon: "cube-outline",
    title: "Modèle indisponible",
    message: "Ce modèle d'objet n'est pas accessible pour le moment.",
    action: "Réessaie dans un instant.",
    retryable: true,
    alternative: "Choisis un autre objet de la même catégorie.",
  },
  model_too_heavy: {
    tone: "error",
    icon: "speedometer-outline",
    title: "Modèle trop lourd",
    message: "Ce modèle dépasse ce que ton appareil peut afficher confortablement.",
    action: "Passe la qualité de rendu sur « Standard » dans les paramètres.",
    retryable: true,
    alternative: "La version 2D du même objet reste disponible.",
  },
  ai_failed: {
    tone: "error",
    icon: "sparkles-outline",
    title: "Génération impossible",
    message: "La suggestion créative n'a pas pu être produite.",
    action: "Réessaie, ou écris le texte toi-même.",
    retryable: true,
    alternative: "Les informations mesurées de la couleur restent exactes et disponibles.",
  },
  quota_reached: {
    tone: "error",
    icon: "timer-outline",
    title: "Limite atteinte",
    message: "Tu as atteint le nombre d'envois autorisés pour cette heure.",
    action: "Réessaie un peu plus tard.",
    retryable: false,
    alternative: "Tes créations locales ne sont pas concernées : tu peux continuer à travailler.",
  },
  storage_full: {
    tone: "error",
    icon: "server-outline",
    title: "Stockage plein",
    message: "Il n'y a plus assez d'espace pour enregistrer cette création.",
    action: "Libère de l'espace, ou vide le cache dans les paramètres.",
    retryable: true,
  },
  save_failed: {
    tone: "error",
    icon: "cloud-offline-outline",
    title: "Enregistrement échoué",
    message: "La création n'a pas pu être enregistrée.",
    action: "Réessaie.",
    retryable: true,
    alternative: "Tu peux exporter l'image en attendant pour ne rien perdre.",
  },
  export_failed: {
    tone: "error",
    icon: "download-outline",
    title: "Export échoué",
    message: "L'image n'a pas pu être générée.",
    action: "Réessaie.",
    retryable: true,
    alternative: "Une capture d'écran reste possible.",
  },

  // ---- Empty --------------------------------------------------------------
  empty_list: {
    tone: "empty",
    icon: "file-tray-outline",
    title: "Rien ici pour l'instant",
    message: "Cette liste se remplira au fur et à mesure.",
    retryable: false,
  },
  no_results: {
    tone: "empty",
    icon: "search-outline",
    title: "Aucun résultat",
    message: "Aucune couleur ne correspond à ta recherche.",
    action: "Essaie une famille (« bleu »), un qualificatif (« clair ») ou un code hexadécimal.",
    retryable: false,
  },
  empty_collection: {
    tone: "empty",
    icon: "albums-outline",
    title: "Collection vide",
    message: "Ajoute des couleurs, des palettes ou des créations pour les retrouver ici.",
    retryable: false,
  },
  empty_profile: {
    tone: "empty",
    icon: "color-palette-outline",
    title: "Aucune création",
    message: "Capture une couleur, applique-la à un objet, et ta première création apparaîtra ici.",
    retryable: false,
  },
  signed_out: {
    tone: "empty",
    icon: "person-circle-outline",
    title: "Connecte-toi pour synchroniser",
    message: "Tes couleurs et créations seront liées à ton compte et retrouvées sur tout appareil.",
    retryable: false,
    alternative: "Tu peux continuer sans compte : tout reste enregistré sur ce téléphone.",
  },
};

export function appState(kind: AppStateKind): AppState {
  return { kind, ...STATES[kind] };
}

export const ALL_APP_STATE_KINDS = Object.keys(STATES) as AppStateKind[];
