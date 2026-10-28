# SCMusic

Lecteur de musique **local, libre et open source** (GPL-3.0) pour Android, construit avec Expo / React Native.
Il lit les MP3 et FLAC que tu possèdes, sans compte, sans serveur, sans publicité.

## Fonctionnalités (MVP)

- **Lecteur** : lecture, pause, déplacement dans le morceau, volume, lecture en arrière-plan
- **File d'attente** : suivant, précédent, aléatoire, répétition (tout / un), réorganisation, « lire ensuite »
- **Bibliothèque** : titres, albums, artistes, titres aimés (tags ID3 / FLAC lus dans les fichiers)
- **Playlists** : créer, renommer, réordonner, retirer des titres, supprimer
- **Recherche** : titres, artistes et albums (accents et majuscules ignorés)
- **Partage** : export / import de playlists entre deux téléphones, dans le respect du droit d'auteur (voir plus bas)

## Lancer l'app sur ton téléphone (développement)

Prérequis : Node.js 20+ sur le PC, l'app **Expo Go** sur le téléphone (Play Store), PC et téléphone sur le même Wi-Fi.

```bash
npm install        # installe les dépendances (une seule fois)
npm start          # lance le serveur de développement et affiche un QR code
```

Scanne le QR code avec Expo Go. À chaque modification du code, l'app se recharge toute seule.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm test` | lance les tests (file d'attente, tags, recherche, règles de partage) |
| `npm run typecheck` | vérifie les types TypeScript |
| `npx eslint .` | vérifie le style et les erreurs courantes |
| `npx expo-doctor` | diagnostique la configuration Expo |

## Construire l'APK

- **Dans le cloud (le plus simple)** : `npx eas-cli@latest build -p android --profile preview` (compte Expo gratuit requis). Docs : https://docs.expo.dev/build-reference/apk/
- **En local** : installe Android Studio (SDK Android), puis `npx expo run:android --variant release`.

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

- **Phase 2** : paroles synchronisées (LRCLIB), thème clair / sombre
- **Phase 3** : statistiques d'écoute

## Licence

SCMusic est un logiciel libre distribué sous licence **GNU GPL v3** (voir `LICENSE`).
Tu peux l'utiliser, l'étudier, le modifier et le redistribuer, à condition que les versions dérivées restent sous la même licence.
