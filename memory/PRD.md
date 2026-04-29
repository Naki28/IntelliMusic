# IntelliMusic — Product Requirements Document (v2)

## Vue d'ensemble
IntelliMusic v2 est une app mobile de streaming musical (React Native + Expo) avec compte utilisateur, playlists, et **IntelliRadio** : une radio personnalisée qui change de programme selon l'heure de la journée et tes goûts.

## Stack technique
- **Frontend** : React Native + Expo SDK 54, expo-router, TypeScript
- **Backend** : FastAPI (Python) + MongoDB (motor) — proxy Deezer + auth + profile + playlists + intelliradio
- **Auth** : Emergent Google OAuth + compte démo seedé
- **Audio** : expo-av (titres preview 30s + stream radio MP3)
- **Stockage** : MongoDB côté serveur (favoris/playlists/users) + AsyncStorage (token)

## Fonctionnalités v2 livrées

### 🔐 Authentification & Profil
- **Google OAuth** (Emergent-managed) sur web
- **Compte démo** : naki28 / naki28 (seedé automatiquement avec genres Pop/Hip Hop/R&B + artistes Drake/The Weeknd, pays FR)
- **Profil éditable** : nom, pays (override manuel), genres préférés (chips), artistes préférés (input + chips supprimables)
- **Détection auto pays** via header `cf-ipcountry` (fallback FR)

### 📻 IntelliRadio (programme par tranches horaires UTC+1)
| Tranche  | Programme | Type |
|----------|-----------|------|
| 06h-10h  | IntelliRadio Wake-up | musique |
| 10h-14h  | IntelliRadio Discovery (≥2020) | musique |
| 14h-16h  | IntelliRadio Classics (≤2015) | musique |
| 16h-20h  | IntelliRadio Mix | musique |
| **20h-00h**  | **RMC Info** | **stream live** |
| 00h-06h  | IntelliRadio Chill | musique |

Pour les slots musique, la queue est construite à partir des **artistes préférés (top tracks Deezer) + genres préférés + favoris** de l'user, avec filtre par année selon le slot.

### 🎵 Playlists & Favoris
- CRUD complet playlists (create/delete + add/remove track)
- Favoris persistés côté serveur (sync entre devices)
- Détail playlist avec "Tout lire"

### 🎧 Lecteur étendu
- Mode `track` : queue de titres avec slider, prev/next
- Mode `stream` : lecture continue (RMC), badge "FLUX EN DIRECT", contrôles next/prev/slider désactivés

### 🔌 Connexion Deezer
- ⚠️ **MOCK** : bouton cosmétique (toggle `deezer_connected`). OAuth réel non implémenté car nécessite client_id/secret Deezer.

## Architecture
```
backend/server.py
  ├─ /api/auth/* (demo-login, session, me, logout)
  ├─ /api/profile (PATCH, connect-deezer mock)
  ├─ /api/favorites (GET, POST, DELETE)
  ├─ /api/playlists (full CRUD + tracks)
  ├─ /api/intelliradio + /api/intelliradio/schedule
  ├─ /api/recommendations
  └─ /api/deezer/* (proxy public)

frontend/
  ├─ app/_layout.tsx (AuthGate + AuthCallbackHandler + Providers)
  ├─ app/login.tsx
  ├─ app/(tabs)/{index, search, intelliradio, library, profile}.tsx
  ├─ app/playlist/[id].tsx
  ├─ app/player.tsx
  └─ src/
      ├─ api/{client, deezer}.ts
      ├─ context/{Auth, Player, Favorites, Playlists}Context.tsx
      └─ components/{MiniPlayer, TrackRow, AlbumCard, SectionHeader}.tsx
```

## Tests
- **Backend** : 14/14 pytest (auth, profile, favorites, playlists, intelliradio)
- **Frontend** : 95% des flows validés via Playwright

## Limitations / Mocks
- ⚠️ **OAuth Deezer = MOCK** (toggle uniquement)
- ⚠️ Recommandations par pays = chart Deezer global (l'API publique ne fournit pas de chart par pays)
- ⚠️ Stream RMC peut ne pas se lire dans certains navigateurs headless (CORS / format MP3)

## Comptes de test
Voir `/app/memory/test_credentials.md`.
