# Sécurité de SCMusic

Décisions de sécurité documentées, au sens de l'OWASP ASVS 5.0. Ce fichier dit **ce qui est protégé, comment, et pourquoi**.
On le relit à chaque version qui touche au réseau, aux fichiers reçus ou aux mises à jour.

## Signaler une faille

Ouvre une issue sur le dépôt, sans détail exploitable, en demandant un contact privé.

## Périmètre et modèle de menace

SCMusic est un lecteur de musique **local** pour Android, utilisé par une seule personne.
Il n'y a ni compte, ni serveur à nous, ni publicité, ni télémétrie, ni service Google.

| Menace | Exemple | Protection |
|---|---|---|
| Fichier piégé sur le téléphone | MP3 au tag énorme, image de 100 000 × 100 000 pixels, `.lrc` géant | Limites de taille et vérification du contenu ([tableau](README.md#sécurité-des-fichiers-reçus)) |
| Partage reçu piégé | JSON de 1 Go, chemin `../`, faux `.mp3`, caractères invisibles | Taille et nombre limités, noms stricts, en-tête audio vérifié, textes nettoyés |
| Serveur tiers compromis ou réponse corrompue | LRCLIB, MusicBrainz ou GitHub renvoie n'importe quoi | Réponses plafonnées à 2 Mo, format vérifié, affichées comme du texte (jamais exécutées) |
| Fausse mise à jour | APK modifié, autre adresse de téléchargement | Adresse en liste blanche, empreinte obligatoire, **signature vérifiée par Android** |
| Fuite des données personnelles | sauvegarde Android, envoi à un tiers | `allowBackup: false`, aucune donnée de la bibliothèque n'est envoyée |
| Injection | SQL, chemin de fichier (LFI), code | Requêtes paramétrées, aucun chemin ni code construit à partir d'une saisie |

Hors périmètre : un téléphone rooté ou déjà compromis, et l'accès physique à un téléphone déverrouillé.

## Données et niveau de protection (ASVS 14.1)

| Donnée | Sensibilité | Où | Protection |
|---|---|---|---|
| Historique d'écoute, statistiques | **Personnelle** (habitudes, horaires) | Base SQLite privée de l'app | Bac à sable Android, chiffrement du téléphone, hors sauvegarde, jamais envoyée, effaçable dans Statistiques |
| Bibliothèque, playlists, infos modifiées, paroles | Personnelle (goûts) | Base SQLite privée | Idem, partagée seulement par un export que l'utilisateur lance |
| Pochettes copiées | Faible | Dossier privé de l'app | Bac à sable |
| Titre et artiste d'un morceau | Faible | Envoyés à LRCLIB / MusicBrainz **à la demande** | Rien d'autre n'est envoyé ; mode hors ligne pour tout bloquer |
| Clé de signature | **Critique** | PC de développement uniquement | Voir ci-dessous |

Les fichiers audio ne sont jamais modifiés par l'app.

**Journaux (MASVS-STORAGE-2) :** la version publiée n'écrit rien dans logcat (`logWarn` dans [src/log.ts](src/log.ts), actif seulement en développement). Les messages contiendraient des noms de fichiers, lisibles par adb, les rapports de bug et les apps système. Ne pas utiliser `console.*` directement.

**Cloisonnement (MASVS-PLATFORM-1, PRIVACY-1) :**
- **Ce que l'app voit :** seulement ce que l'utilisateur choisit dans le sélecteur d'Android (dossier de musique, image, fichier de partage). Aucune permission de stockage global : `READ_EXTERNAL_STORAGE` et `WRITE_EXTERNAL_STORAGE` sont bloquées, tout comme `VIBRATE` et `SYSTEM_ALERT_WINDOW`, inutiles.
- **Ce que les autres apps voient de SCMusic :**
  - pas de schéma de lien (`scmusic://` retiré), donc aucune app ni page web ne peut ouvrir un écran avec ses paramètres ;
  - seule l'icône du lanceur ouvre l'app ;
  - les services et fournisseurs de fichiers ne sont pas exportés ;
  - un fichier partagé n'est lisible que par l'app choisie par l'utilisateur, et seulement pour ce fichier.
- **Exception voulue :** les contrôles de lecture (écran verrouillé, notification, Bluetooth) passent par la session média d'Android.

**Version d'Android (MASVS-CODE-1) :** Android 10 minimum (`minSdkVersion` 29). Les versions plus anciennes ne reçoivent plus de correctifs de sécurité.

## Communications (ASVS 13.1, 13.2)

La liste des connexions, avec le moment où elles ont lieu, est dans le [README](README.md).
Toutes passent par [src/net/network.ts](src/net/network.ts). Aucun `fetch` n'est autorisé ailleurs.

- **Transport :** HTTPS uniquement. Android bloque le HTTP en clair.
- **Délais :** abandon après 15 s ; connexion fermée après chaque réponse (`Connection: close`).
- **Nouveaux essais :** seulement MusicBrainz (3 essais, 2, 4 puis 8 s, sur une réponse « occupé »). Aucun nouvel essai ailleurs.
- **Mode hors ligne :** bloque toute requête avant qu'elle parte.
- **Ajouter une destination réseau** est une décision de sécurité : elle se documente ici et dans le README avant d'être codée.

## Fonctions sensibles (ASVS 15.1.5)

| Fonction | Risque | Code |
|---|---|---|
| Lecture binaire des tags ID3 / FLAC | Fichier malformé | [tags.ts](src/library/tags.ts), lecture plafonnée à 8 Mo, bornes vérifiées |
| Lecture des en-têtes d'image | Pixel flood | [covers.ts](src/library/covers.ts), `checkCover` |
| Import d'un partage (JSON + fichiers) | Désérialisation, chemins | [format.ts](src/sharing/format.ts), `parseManifest` (validation champ par champ) |
| Téléchargement et installation d'un APK | Prise de contrôle de l'app | [updater.ts](src/update/updater.ts) |

## Cryptographie : inventaire (ASVS 11.1)

| Usage | Algorithme | Rôle |
|---|---|---|
| Signature de l'APK | RSA 4096, schémas v2 et v3, certificat `CN=SCMusic` | **Authenticité** : Android refuse toute mise à jour signée par une autre clé |
| Empreinte de l'APK publié | SHA-256 | **Intégrité** : fichier téléchargé intact. Ne prouve pas l'origine, puisque l'empreinte vient du même dépôt |
| Connexions réseau | TLS du système Android | Confidentialité et intégrité en transit |
| Dédoublonnage des pochettes | FNV-1a | **Pas** cryptographique : sert seulement à nommer les fichiers |

Empreinte SHA-256 du certificat de signature, à comparer avant chaque publication :
`61bef2114a9f37310330a19b0d31fe79eb4f477fc5065edc57b555c43e5b6c06`

## Clé de signature (ASVS 11.1.1, 13.3)

La clé est l'élément le plus critique : qui la détient peut publier une mise à jour acceptée par tous les téléphones.

- **Emplacement :** `~/.scmusic-keys/` (dossier `700`, fichiers `600`), **hors du dépôt**.
- **Mot de passe :** il est stocké dans `signing.properties`, lisible seulement par l'utilisateur. Il est transmis à `apksigner` par une variable d'environnement, jamais sur la ligne de commande, où les autres comptes le verraient dans la liste des processus.
- **Sauvegarde :** garder une copie **chiffrée et hors ligne** du dossier (clé USB chiffrée, par exemple). Sans cette clé, plus aucune mise à jour n'est possible : il faudrait désinstaller l'app et perdre les données.
- **Usage :** une seule clé, uniquement pour signer SCMusic, sur le PC de développement.
- **Si la clé fuit :**
  1. Ne plus rien publier.
  2. Retirer les releases suspectes de SCMusic-releases.
  3. Créer une nouvelle clé et faire la rotation avec la signature v3.1 (`apksigner rotate`), pour que les téléphones l'acceptent.
  4. Prévenir les utilisateurs.
- **Rotation :** il n'y a pas de rotation périodique. RSA 4096 n'a pas de date de fin pratique, et chaque rotation est risquée. On ne la fait qu'en cas de fuite.

## Dépendances (ASVS 15.1, 15.2)

- **Avant chaque publication :** `scripts/publish-release.sh` lance [scripts/audit.mjs](scripts/audit.mjs) et **bloque** si une faille haute ou critique n'est ni corrigée ni couverte par une exception valide.
- **Exceptions :** elles sont listées dans [security/audit-exceptions.json](security/audit-exceptions.json), avec justification et date de réexamen (90 jours maximum). Une fois expirée, l'exception bloque de nouveau la publication.
- **Liste des composants (SBOM) :** un fichier CycloneDX (`SCMusic-<version>.sbom.json`) est publié avec chaque version. On peut le régénérer avec `npm run sbom`.
- **Provenance :** seul le registre npm public est utilisé, et `package-lock.json` est versionné.
- **Ajout de dépendance :** passer par `npx expo install`, en préférant les modules Expo officiels. Ne jamais ajouter une bibliothèque qui embarque Google Play Services ou un pisteur. Après une compilation, vérifier l'APK : 0 référence à `com/google/android/gms`.

Délais de correction :

| Gravité | Dans le code embarqué dans l'APK | Seulement dans les outils de build |
|---|---|---|
| Critique ou haute | Version corrective sous 7 jours | Exception justifiée, réexaminée sous 90 jours, ou correction au prochain SDK Expo |
| Moyenne ou basse | Prochaine version | Prochaine mise à jour du SDK Expo |

Pour savoir si un paquet finit dans l'APK : `npm ls <paquet>`, puis chercher son nom dans le bundle : `unzip -p dist/SCMusic-x.apk assets/index.android.bundle | strings | grep <nom>`.

## Avant chaque publication

1. `npm run typecheck && npm run lint && npm test`
2. `npm run apk && npm run apk:sign`
3. Vérifier l'APK :
   - le certificat est celui indiqué plus haut ;
   - le versionCode a augmenté ;
   - il y a 0 référence à `com/google/android/gms` ;
   - `allowBackup=false` ;
   - il n'y a pas de nouvelle permission sans raison.
4. `npm run apk:publish -- "notes"` : cette commande vérifie l'empreinte, lance l'audit des dépendances et publie le SBOM.
