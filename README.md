# SCMusic

Lecteur de musique **local, libre et open source** (GPL-3.0) pour Android, construit avec Expo / React Native.
Il lit les MP3 et FLAC que tu possèdes, sans compte, sans serveur, sans publicité.
Il ne se connecte à Internet que pour chercher des paroles ([LRCLIB](https://lrclib.net)) ou des albums ([MusicBrainz](https://musicbrainz.org)) quand tu le demandes (titre et artiste seulement), et pour vérifier les mises à jour (une fois par semaine au plus, en Wi-Fi, désactivable).
Chaque requête est coupée dès la réponse (15 s maximum), et **Réglages → Réseau → Mode hors ligne** bloque toute connexion d'un coup.

## Fonctionnalités (MVP)

- **Lecteur** : lecture, pause, déplacement dans le morceau, volume, lecture en arrière-plan
- **File d'attente** : suivant, précédent, aléatoire, répétition (tout / un), réorganisation, « lire ensuite »
- **Bibliothèque** : titres, albums, artistes, titres aimés (tags ID3 / FLAC lus dans les fichiers)
- **Playlists** : créer, renommer, réordonner, retirer des titres, supprimer
- **Paroles** : synchronisées comme sur Spotify (la ligne chantée suit la musique, toucher une ligne y saute). Bouton micro dans le lecteur, puis :
  - **Chercher en ligne** : interroge [LRCLIB](https://lrclib.net) (libre, sans compte) **uniquement quand tu appuies** ; seuls le titre et l'artiste sont envoyés
  - **Coller / écrire** le texte copié depuis un site, puis **Synchroniser au doigt** : la musique joue, tu touches « Ligne suivante » au début de chaque ligne
  - ou un fichier `nom.lrc` à côté de `nom.mp3`, ou les paroles intégrées au fichier (USLT / LYRICS), lus à l'analyse
- **Statistiques** (bouton graphique de l'accueil) : temps d'écoute, nombre d'écoutes, titres / artistes / albums les plus écoutés sur 7 jours, 30 jours, 12 mois ou depuis toujours, graphique par jour ou par mois, titres à redécouvrir et jamais écoutés. Un titre compte après 30 s d'écoute réelle (les sauts ne comptent pas). Tout est calculé sur le téléphone
- **Modifier les infos** (titre, artiste, album, n° de piste) **dans l'app**, sans toucher aux fichiers : menu `…` → *Modifier les infos*, ou **Bibliothèque → crayon** pour cocher plusieurs titres et leur donner le même album (créer un album) ou artiste, ou **crayon d'un album** pour le renommer. *Revenir aux infos des fichiers* annule. Un nouveau scan n'écrase pas ces modifications
- **Trouver les albums en ligne** : Bibliothèque → crayon → cocher des titres → loupe, ou bouton sur l'album « Album inconnu ». SCMusic interroge [MusicBrainz](https://musicbrainz.org) (un titre par seconde), propose l'album le plus probable (album studio plutôt que compilation, single ou bande originale) et le n° de piste ; tu coches ce que tu appliques. Chaque résultat (même « rien trouvé ») est gardé sur le téléphone : un titre déjà cherché n'est jamais redemandé, sauf si tu changes son titre ou son artiste
- **Recherche** : titres, artistes et albums (accents et majuscules ignorés)
- **Partage** : export / import de playlists entre deux téléphones, dans le respect du droit d'auteur (voir plus bas)
- **Français ou anglais** : Réglages → *Langue / Language*, sans redémarrer. Les textes sont dans [src/i18n/](src/i18n/) (`fr.ts` sert de référence, `en.ts` doit avoir les mêmes clés). Les données de la bibliothèque (titres, « Artiste inconnu » des fichiers sans tags) ne sont pas traduites

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

## Mises à jour sans câble

Les APK signés sont publiés sur le dépôt public [ma0ky/SCMusic-releases](https://github.com/ma0ky/SCMusic-releases) (le code reste privé).
À l'ouverture, au plus une fois par semaine et seulement en Wi-Fi (réglable), l'app regarde s'il existe une version plus récente et propose **Mettre à jour** :
elle télécharge l'APK, vérifie son empreinte SHA-256, puis l'installateur d'Android demande de confirmer.
Une version n'est proposée que si son APK **et** son fichier `.sha256` viennent du dépôt de releases (adresse vérifiée) :
sans empreinte, rien n'est installé. L'empreinte prouve que le fichier est intact, la signature (vérifiée par Android) qu'il vient bien de nous.
La première fois, Android demande d'autoriser SCMusic à installer des applications. On peut aussi vérifier à la main, ou couper la vérification, dans **Réglages → Mises à jour**.

Publier une nouvelle version :

```bash
# 1. augmenter "version" et "android.versionCode" dans app.json (et "version" dans package.json)
npm run apk && npm run apk:sign
npm run apk:publish -- "Ce qui change dans cette version"
```

Toujours signer avec la même clé (`~/.scmusic-keys`) : Android refuse une mise à jour signée avec une autre clé.
La publication vérifie l'empreinte, lance l'audit des dépendances (bloquant si faille haute non traitée) et joint la liste des composants (SBOM).
Décisions de sécurité, gestion de la clé et procédure complète : [SECURITY.md](SECURITY.md).

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

## Sécurité des fichiers reçus

Tout ce qui vient de l'extérieur (partage reçu, fichiers du téléphone, réponses des serveurs) est limité et vérifié :

| Entrée | Limites |
|---|---|
| Fichier de partage `scmusic-share.json` | 5 Mo, 500 playlists, 10 000 titres par playlist ; textes nettoyés (caractères invisibles et de direction retirés, 200 caractères max) |
| Audio joint à un partage | `.mp3` / `.flac` sans chemin, 300 Mo max, contenu vérifié (en-tête ID3, MPEG ou FLAC) |
| Pochettes (fichier, tag, dossier) | JPEG / PNG valide, 15 Mo et ~50 millions de pixels max ; une image refusée n'empêche pas d'ajouter le morceau |
| Paroles (`.lrc`, tags, LRCLIB, collage) | `.lrc` de 1 Mo max, texte coupé à 100 000 caractères |
| Réponses LRCLIB, MusicBrainz, GitHub | 2 Mo max, format vérifié avant usage |

Les données de l'app (bibliothèque, stats, paroles) sont exclues de la sauvegarde Android (`allowBackup: false`) : elles ne quittent pas le téléphone.

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

- Thème clair / sombre

## Licence

SCMusic est un logiciel libre distribué sous licence **GNU GPL v3** (voir `LICENSE`).
Tu peux l'utiliser, l'étudier, le modifier et le redistribuer, à condition que les versions dérivées restent sous la même licence.
