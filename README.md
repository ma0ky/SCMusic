# SCMusic

Lecteur de musique **local, libre et open source** (GPL-3.0) pour Android, construit avec Expo / React Native.
Il lit les MP3 et FLAC que tu possèdes, sans compte, sans serveur, sans publicité.
La seule connexion à Internet est la recherche de paroles, et seulement quand tu la demandes.

## Fonctionnalités (MVP)

- **Lecteur** : lecture, pause, déplacement dans le morceau, volume, lecture en arrière-plan
- **File d'attente** : suivant, précédent, aléatoire, répétition (tout / un), réorganisation, « lire ensuite »
- **Bibliothèque** : titres, albums, artistes, titres aimés (tags ID3 / FLAC lus dans les fichiers)
- **Playlists** : créer, renommer, réordonner, retirer des titres, supprimer
- **Paroles** : synchronisées comme sur Spotify (la ligne chantée suit la musique, toucher une ligne y saute). Bouton micro dans le lecteur, puis :
  - **Chercher en ligne** : interroge [LRCLIB](https://lrclib.net) (libre, sans compte) **uniquement quand tu appuies** ; seuls le titre et l'artiste sont envoyés
  - **Coller / écrire** le texte copié depuis un site, puis **Synchroniser au doigt** : la musique joue, tu touches « Ligne suivante » au début de chaque ligne
  - ou un fichier `nom.lrc` à côté de `nom.mp3`, ou les paroles intégrées au fichier (USLT / LYRICS), lus à l'analyse
- **Recherche** : titres, artistes et albums (accents et majuscules ignorés)
- **Partage** : export / import de playlists entre deux téléphones, dans le respect du droit d'auteur (voir plus bas)

## Compiler et installer (100 % local, sans store ni cloud)

Prérequis sur le PC : Node.js 20+, Java 21, le SDK Android en ligne de commande dans `~/Android/Sdk`
(`platforms;android-37.0`, `build-tools;37.0.0`, `platform-tools`, `ndk;27.1.12297006`) et :

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export EXPO_NO_TELEMETRY=1
```

Sur le téléphone : Options développeur → Débogage USB, puis branche-le en USB.

```bash
npm install          # dépendances (une seule fois)
npm run apk          # compile l'APK (arm64) : android/app/build/outputs/apk/release/app-release.apk
npm run apk:install  # installe / met à jour l'app via USB, en gardant tes données
```

L'APK ne contient aucun service Google (pas de Play Services, pas de Firebase).
Il est signé avec une clé de développement locale : suffisant pour un usage perso.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm test` | lance les tests (file d'attente, tags, recherche, règles de partage) |
| `npm run typecheck` | vérifie les types TypeScript |
| `npx eslint .` | vérifie le style et les erreurs courantes |
| `npx expo-doctor` | diagnostique la configuration Expo |

## Partage et droit d'auteur

Chaque morceau a une **licence**, modifiable depuis son menu `…` → *Licence du morceau* :

| Licence | Exemple | Fichier audio exportable ? |
|---|---|---|
| Achat / CD perso (par défaut) | album acheté, CD numérisé | **Non** : seules les infos (titre, artiste, album) sont partagées |
| Ma création | tes propres morceaux | Oui |
| Licence libre | Creative Commons, domaine public | Oui (vérifie les conditions de la licence, ex. « pas d'usage commercial ») |

**Réglages → Partager** crée un dossier `SCMusic-export-…` contenant `scmusic-share.json` (+ les fichiers autorisés).
Sur l'autre téléphone : **Réglages → Importer un dossier d'export**. Les titres d'une playlist sont retrouvés dans la bibliothèque du destinataire par titre et artiste.

## Organisation du code

```
src/app/          écrans (Expo Router : un fichier = un écran)
src/components/   composants d'interface réutilisables
src/theme/        tokens de design (couleur #8b7bff, rayon 13, monospace)
src/db/           base SQLite locale (schéma, requêtes, types)
src/library/      scan du dossier musique et lecture des tags
src/player/       file d'attente (logique pure) et moteur audio
src/search/       recherche
src/sharing/      format d'échange, export, import
src/store/        état global (Zustand)
__tests__/        tests Jest
```

## Feuille de route

- **Phase 2** : thème clair / sombre
- **Phase 3** : statistiques d'écoute

## Licence

SCMusic est un logiciel libre distribué sous licence **GNU GPL v3** (voir `LICENSE`).
Tu peux l'utiliser, l'étudier, le modifier et le redistribuer, à condition que les versions dérivées restent sous la même licence.
