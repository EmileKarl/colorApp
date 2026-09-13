# Tester ColorLens

Deux façons de lancer l'application : un **émulateur Android** (via Android Studio) ou
ton **iPhone** (via Expo Go). Les deux partent du même serveur de développement.

---

## Point important avant de commencer

**On n'ouvre pas ce projet dans Android Studio.**

ColorLens est une application Expo en *managed workflow* : il n'y a pas de dossier
`android/` ni `ios/` dans le dépôt, donc rien à ouvrir comme projet Android. Android Studio
sert ici à **une seule chose** : fournir l'émulateur. C'est Expo, lancé depuis le terminal,
qui installe et démarre l'app dedans.

Si tu ouvres le dossier dans Android Studio, il ne verra pas de projet Gradle et n'aura rien
à compiler. C'est normal, et c'est voulu : c'est ce qui permet de tester sans compte
développeur Apple payant.

---

## 0. Préparer le projet (une seule fois)

```bash
git clone https://github.com/EmileKarl/colorApp.git
cd colorApp
git checkout claude/color-code-app-455juh
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` est nécessaire : `react-dom` déclare une dépendance stricte sur une
> version de React différente de celle d'Expo SDK 57. Sans le drapeau, npm refuse d'installer.

**Variables d'environnement** — optionnel pour commencer :

```bash
cp .env.example .env.local
```

Sans Supabase, l'application démarre et **tout le Studio fonctionne** (capture, objets,
variantes, export) — seuls le compte, la sauvegarde cloud et l'Explorer resteront vides.
Pour les activer, remplis `.env.local` avec ton URL et ta clé *anon* Supabase, et applique
les migrations : voir `supabase/README.md`.

Vérifie que tout est sain avant de lancer :

```bash
npm run typecheck && npm run lint && npm test
```

---

## 1. Émulateur Android (Android Studio)

### a. Installer Android Studio et créer un appareil virtuel

1. Télécharge Android Studio : https://developer.android.com/studio
2. À la première ouverture, laisse l'assistant installer le **Android SDK** et les
   **Android Virtual Device (AVD) components**.
3. Sur l'écran d'accueil : **More Actions → Virtual Device Manager**
   (ou, dans un projet ouvert : **Tools → Device Manager**).
4. **Create Device** → choisis un **Pixel 7** ou **Pixel 8** → **Next**.
5. Choisis une image système **avec les Google APIs** (par exemple *Tiramisu, API 33* ou
   *UpsideDownCake, API 34*). Télécharge-la si besoin.
   > Prends bien une image qui mentionne « Google APIs » ou « Google Play » : sans elle, le
   > Play Store est absent et l'installation d'Expo Go est plus pénible.
6. **Finish**, puis clique sur ▶ pour démarrer l'émulateur. Laisse-le tourner.

### b. Rendre `adb` visible depuis le terminal

Expo communique avec l'émulateur via `adb`. Vérifie :

```bash
adb devices
```

Tu dois voir une ligne du type `emulator-5554   device`.

Si la commande est introuvable, ajoute le SDK à ton `PATH` :

**macOS / Linux** — ajoute à `~/.zshrc` ou `~/.bashrc` :
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk       # macOS
# export ANDROID_HOME=$HOME/Android/Sdk             # Linux
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```
Puis `source ~/.zshrc`.

**Windows (PowerShell)** — le SDK est en général dans
`C:\Users\<toi>\AppData\Local\Android\Sdk`. Ajoute `platform-tools` au `PATH` via
*Paramètres → Variables d'environnement*.

### c. Lancer l'application

Avec l'émulateur démarré :

```bash
npm run android
```

Expo va : démarrer le serveur, détecter l'émulateur, **installer Expo Go automatiquement**
s'il n'y est pas, puis ouvrir ColorLens dedans. Le premier chargement prend une à deux
minutes (le bundle fait ~6 Mo) ; les suivants sont quasi instantanés.

Si l'installation automatique d'Expo Go échoue, ouvre le Play Store **dans l'émulateur**,
cherche « Expo Go », installe-le, puis relance `npm run android`.

### d. Ce que l'émulateur permet — et ce qu'il ne permet pas

| | Émulateur Android |
|---|---|
| Navigation, écrans, mise en page | ✅ fidèle |
| **Rendu Skia des objets, Studio, variantes** | ✅ fonctionne… |
| Performance du rendu | ⚠️ **non représentative** — l'émulateur rend en logiciel, donc c'est plus lent que sur un vrai téléphone. Ne juge pas la fluidité ici. |
| Import depuis la galerie | ✅ (glisse une image sur la fenêtre de l'émulateur pour l'ajouter) |
| **Capture caméra d'une vraie couleur** | ❌ la caméra virtuelle affiche une scène 3D de synthèse. L'app mesurera une couleur, mais elle n'a aucun sens. |
| Retour haptique, partage natif | ⚠️ partiel ou absent |

**Conclusion : l'émulateur sert à vérifier l'interface et la navigation. Il ne sert pas à
juger la performance du Studio ni la capture de couleur.** Pour ces deux-là, il faut
l'iPhone.

---

## 2. Ton iPhone (Expo Go)

C'est le test qui compte : caméra réelle, performance réelle, gestes réels.

### a. Installer Expo Go

Sur l'iPhone, App Store → **Expo Go** → installer. C'est tout. **Aucun compte développeur
Apple n'est nécessaire** — c'est précisément pourquoi le projet n'utilise que des modules
natifs inclus dans Expo Go.

### b. Mettre l'ordinateur et l'iPhone sur le même Wi-Fi

Les deux doivent être sur **le même réseau**. Pas l'ordinateur en Ethernet et le téléphone
en 4G.

### c. Lancer

Sur l'ordinateur :

```bash
npx expo start -c
```

> Le `-c` vide le cache Metro. Utile la première fois et après chaque `git pull` : un bundle
> périmé est la cause la plus fréquente d'erreurs qui « reviennent » alors qu'elles ont été
> corrigées.

Un QR code s'affiche dans le terminal.

Sur l'iPhone : ouvre l'**appareil photo** (pas Expo Go), vise le QR code, touche la
notification qui apparaît. ColorLens s'ouvre dans Expo Go.

### d. Si le QR code ne marche pas

Réseau d'entreprise, Wi-Fi public, ou « isolation des clients » activée sur la box — les
deux appareils se voient mal. Passe par un tunnel :

```bash
npx expo start --tunnel
```

Le premier lancement installe `@expo/ngrok`. C'est plus lent, mais ça traverse n'importe
quel réseau.

Autre solution, si le tunnel est bloqué : active le **partage de connexion** sur l'iPhone et
connecte l'ordinateur dessus. Les deux sont alors sur le même réseau.

---

## 3. Ce qu'il faut regarder en priorité

Dans cet ordre — le premier point est celui qui peut remettre en cause une partie du travail.

### ① Le rendu des objets — **Profil → Vérifier le rendu**

Les trois modèles (t-shirt, sneaker, voiture) ont été **dessinés en aveugle** : leurs
chemins SVG ont été écrits en coordonnées, sans jamais avoir été affichés. Les tests
vérifient leur cohérence interne, pas leur allure.

Sur cet écran, change la couleur, le matériau et l'éclairage, et regarde :

- **Est-ce que ça s'affiche ?** Si l'écran est vide, Skia ne tourne pas — dis-le-moi
  immédiatement, c'est un problème d'architecture.
- **Est-ce que ça réagit instantanément ?** Un délai perceptible au changement de couleur
  serait un problème de performance.
- **Est-ce que l'objet garde son volume ?** Il doit y avoir un côté ombré et un côté éclairé,
  quelle que soit la couleur. Une silhouette plate serait un bug.
- **Est-ce que ça ressemble à l'objet annoncé ?** C'est le point que je ne peux pas vérifier.
  Si les silhouettes sont ratées, dis-le : c'est du dessin à reprendre, pas de
  l'architecture.

### ② Le parcours principal

Scanner une couleur → **Appliquer à un objet** → choisir un modèle → Studio → changer une
zone, un matériau, une variante → comparer avant/après → exporter.

### ③ La capture de couleur

Photographie une surface **unie et bien éclairée** (un mur, un vêtement uni). Compare le
code affiché à ce que tu vois. Rappel honnête : c'est une estimation à partir d'une caméra
de téléphone, avec une incertitude annoncée d'au moins 3 ΔE00 — pas une mesure
colorimétrique professionnelle.

### ④ Supabase, si tu l'as configuré

Crée un compte, sauvegarde une couleur, crée une collection, enregistre une création.
**Rien de ce code réseau n'a jamais été exécuté** — il compile et il est typé, mais il n'a
jamais parlé à une vraie base.

---

## 4. Problèmes courants

| Symptôme | Cause et solution |
|---|---|
| `Cannot find native module '...'` | Un module natif absent d'Expo Go. Ne devrait plus arriver ; si oui, envoie-moi le nom exact du module. |
| `Cannot read property 'ErrorBoundary' of undefined` | Presque toujours le symptôme trompeur du cas ci-dessus, quand l'import fautif est en haut d'un fichier de route. |
| Une erreur déjà corrigée réapparaît | Bundle en cache. `npx expo start -c`, et dans Expo Go : secoue le téléphone → **Reload**. |
| Le QR code ne fait rien | Réseaux différents. `npx expo start --tunnel`, ou partage de connexion. |
| `adb: command not found` | `platform-tools` absent du `PATH` — voir §1.b. |
| Expo Go se ferme au lancement | Regarde le terminal : la vraie erreur y est écrite. Envoie-la-moi telle quelle. |
| L'app démarre mais Explorer/Collection sont vides | Normal sans Supabase configuré. Voir `supabase/README.md`. |

---

## 5. Et si je voulais un vrai build natif ?

Seulement nécessaire pour ce qu'Expo Go ne permet pas — le **Live Color temps réel**
(analyse image par image du flux caméra), qui demande `react-native-vision-camera`.

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios
```

Cela suppose un **compte Apple Developer à 99 $/an** pour installer le build sur un iPhone
physique. Pour Android, un build de développement est gratuit. Voir `docs/LIMITATIONS.md`
pour ce que cela débloquerait exactement — et ce que cela ne débloquerait pas.
