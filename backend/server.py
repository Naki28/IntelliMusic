from fastapi import FastAPI, APIRouter, HTTPException, Query, Request, Response, Depends, Cookie, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, hashlib
from pathlib import Path
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import httpx
from pydantic import BaseModel, Field
import yt_dlp
import time as _time
import threading
import subprocess
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="IntelliMusic API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DEEZER_BASE = "https://api.deezer.com"
RMC_STREAM_URL = "https://audio.bfmtv.com/rmcradio_128.mp3"
EMERGENT_AUTH_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

http_client = httpx.AsyncClient(timeout=15.0, follow_redirects=True)


# ---------- Modèles ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    country: Optional[str] = "FR"
    deezer_connected: bool = False
    favorite_genres: List[str] = []
    favorite_artists: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    favorite_genres: Optional[List[str]] = None
    favorite_artists: Optional[List[str]] = None

class DemoLogin(BaseModel):
    username: str
    password: str

class SessionExchange(BaseModel):
    session_id: str

class Playlist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    track_ids: List[int] = []
    tracks: List[dict] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PlaylistCreate(BaseModel):
    name: str

class TrackPayload(BaseModel):
    track: dict


# ---------- Helpers ----------
async def deezer_get(path: str, params: Optional[dict] = None) -> dict:
    try:
        r = await http_client.get(f"{DEEZER_BASE}{path}", params=params or {})
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as e:
        logger.error(f"Erreur Deezer {path}: {e}")
        raise HTTPException(status_code=502, detail="Service Deezer indisponible")


def detect_country(request: Request) -> str:
    """Détecte le pays via Cloudflare/header ou fallback FR."""
    cc = request.headers.get("cf-ipcountry") or request.headers.get("x-country") or "FR"
    return (cc or "FR").upper()[:2]


async def get_current_user(
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None),
) -> User:
    """Récupère l'user via cookie ou Bearer token."""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")

    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Session invalide")

    expires_at = sess["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expirée")

    user_doc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return User(**user_doc)


async def create_session(user_id: str) -> str:
    """Crée une session 7j, renvoie session_token."""
    token = uuid.uuid4().hex + uuid.uuid4().hex
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    return token


# ---------- Auth ----------
@api_router.post("/auth/demo-login")
async def demo_login(payload: DemoLogin, response: Response):
    """Login démo simple pour comptes seedés (naki28)."""
    if payload.username != "naki28" or payload.password != "naki28":
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    user = await db.users.find_one({"user_id": "demo_naki28"}, {"_id": 0})
    if not user:
        user_data = User(
            user_id="demo_naki28",
            email="naki28@intellimusic.demo",
            name="Naki",
            picture="https://api.dicebear.com/7.x/avataaars/svg?seed=naki28",
            country="FR",
            favorite_genres=["Pop", "Hip Hop", "R&B"],
            favorite_artists=["Drake", "The Weeknd"],
        ).dict()
        await db.users.insert_one(user_data)
        user = await db.users.find_one({"user_id": "demo_naki28"}, {"_id": 0})
    token = await create_session(user["user_id"])
    response.set_cookie("session_token", token, max_age=7*24*3600, httponly=True, secure=True, samesite="none", path="/")
    return {"session_token": token, "user": User(**user)}


@api_router.post("/auth/session")
async def auth_session(payload: SessionExchange, request: Request, response: Response):
    """Échange un session_id Emergent contre un session_token IntelliMusic."""
    try:
        r = await http_client.get(EMERGENT_AUTH_SESSION_URL, headers={"X-Session-ID": payload.session_id})
        r.raise_for_status()
        data = r.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=401, detail="Session invalide")

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": data["name"], "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        country = detect_country(request)
        user_data = User(
            user_id=user_id, email=email, name=data["name"],
            picture=data.get("picture"), country=country,
        ).dict()
        await db.users.insert_one(user_data)

    token = await create_session(user_id)
    response.set_cookie("session_token", token, max_age=7*24*3600, httponly=True, secure=True, samesite="none", path="/")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": token, "user": User(**user)}


@api_router.get("/auth/me", response_model=User)
async def auth_me(user: User = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def auth_logout(response: Response, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    token = session_token or (authorization.split(" ", 1)[1] if authorization and authorization.startswith("Bearer ") else None)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------- Profile ----------
@api_router.patch("/profile", response_model=User)
async def update_profile(payload: ProfileUpdate, user: User = Depends(get_current_user)):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if update:
        await db.users.update_one({"user_id": user.user_id}, {"$set": update})
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**user_doc)


@api_router.post("/profile/connect-deezer")
async def connect_deezer(user: User = Depends(get_current_user)):
    """MOCK : marque l'user comme 'connecté Deezer' (pas d'OAuth réel)."""
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"deezer_connected": True}})
    return {"ok": True, "deezer_connected": True, "note": "MOCK — OAuth Deezer non implémenté"}


@api_router.post("/profile/disconnect-deezer")
async def disconnect_deezer(user: User = Depends(get_current_user)):
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"deezer_connected": False}})
    return {"ok": True, "deezer_connected": False}


# ---------- Favorites (server-synced) ----------
@api_router.get("/favorites")
async def get_favorites(user: User = Depends(get_current_user)):
    docs = await db.favorites.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    return {"data": [d["track"] for d in docs]}


@api_router.post("/favorites")
async def add_favorite(payload: TrackPayload, user: User = Depends(get_current_user)):
    track = payload.track
    await db.favorites.update_one(
        {"user_id": user.user_id, "track_id": track["id"]},
        {"$set": {"user_id": user.user_id, "track_id": track["id"], "track": track, "added_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


@api_router.delete("/favorites/{track_id}")
async def remove_favorite(track_id: int, user: User = Depends(get_current_user)):
    await db.favorites.delete_one({"user_id": user.user_id, "track_id": track_id})
    return {"ok": True}


# ---------- Playlists ----------
@api_router.get("/playlists")
async def list_playlists(user: User = Depends(get_current_user)):
    docs = await db.playlists.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    return {"data": docs}


@api_router.post("/playlists")
async def create_playlist(payload: PlaylistCreate, user: User = Depends(get_current_user)):
    pl = Playlist(user_id=user.user_id, name=payload.name).dict()
    await db.playlists.insert_one(pl)
    pl_clean = await db.playlists.find_one({"id": pl["id"]}, {"_id": 0})
    return pl_clean


@api_router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: str, user: User = Depends(get_current_user)):
    await db.playlists.delete_one({"id": playlist_id, "user_id": user.user_id})
    return {"ok": True}


@api_router.post("/playlists/{playlist_id}/tracks")
async def add_track_to_playlist(playlist_id: str, payload: TrackPayload, user: User = Depends(get_current_user)):
    pl = await db.playlists.find_one({"id": playlist_id, "user_id": user.user_id}, {"_id": 0})
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist introuvable")
    track = payload.track
    if track["id"] not in pl.get("track_ids", []):
        await db.playlists.update_one(
            {"id": playlist_id},
            {"$push": {"track_ids": track["id"], "tracks": track}},
        )
    return {"ok": True}


@api_router.delete("/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(playlist_id: str, track_id: int, user: User = Depends(get_current_user)):
    await db.playlists.update_one(
        {"id": playlist_id, "user_id": user.user_id},
        {"$pull": {"track_ids": track_id, "tracks": {"id": track_id}}},
    )
    return {"ok": True}


# ---------- Saved Albums & Artists ----------
class AlbumPayload(BaseModel):
    album: dict

class ArtistPayload(BaseModel):
    artist: dict


@api_router.get("/saved-albums")
async def get_saved_albums(user: User = Depends(get_current_user)):
    docs = await db.saved_albums.find({"user_id": user.user_id}, {"_id": 0}).sort("added_at", -1).to_list(200)
    return {"data": [d["album"] for d in docs]}


@api_router.post("/saved-albums")
async def save_album(payload: AlbumPayload, user: User = Depends(get_current_user)):
    a = payload.album
    await db.saved_albums.update_one(
        {"user_id": user.user_id, "album_id": a["id"]},
        {"$set": {"user_id": user.user_id, "album_id": a["id"], "album": a, "added_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


@api_router.delete("/saved-albums/{album_id}")
async def remove_saved_album(album_id: int, user: User = Depends(get_current_user)):
    await db.saved_albums.delete_one({"user_id": user.user_id, "album_id": album_id})
    return {"ok": True}


@api_router.get("/saved-artists")
async def get_saved_artists(user: User = Depends(get_current_user)):
    docs = await db.saved_artists.find({"user_id": user.user_id}, {"_id": 0}).sort("added_at", -1).to_list(200)
    return {"data": [d["artist"] for d in docs]}


@api_router.post("/saved-artists")
async def save_artist(payload: ArtistPayload, user: User = Depends(get_current_user)):
    a = payload.artist
    await db.saved_artists.update_one(
        {"user_id": user.user_id, "artist_id": a["id"]},
        {"$set": {"user_id": user.user_id, "artist_id": a["id"], "artist": a, "added_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


@api_router.delete("/saved-artists/{artist_id}")
async def remove_saved_artist(artist_id: int, user: User = Depends(get_current_user)):
    await db.saved_artists.delete_one({"user_id": user.user_id, "artist_id": artist_id})
    return {"ok": True}


# ---------- Personalized Home ----------
@api_router.get("/home/recommendations")
async def home_recommendations(user: User = Depends(get_current_user)):
    """Suggestions personnalisées basées sur genres + artistes (préférés + sauvés) + favoris."""
    saved_artists_docs = await db.saved_artists.find({"user_id": user.user_id}, {"_id": 0}).to_list(20)
    saved_artist_names = [a["artist"]["name"] for a in saved_artists_docs if a.get("artist", {}).get("name")]
    artists_pool = list(dict.fromkeys((user.favorite_artists or []) + saved_artist_names))[:5]

    suggested_tracks: list = []
    suggested_artists: list = []
    new_releases_user: list = []

    # Top de chaque artiste préféré → suggestions
    for name in artists_pool[:4]:
        try:
            res = await deezer_get("/search/artist", {"q": name, "limit": 1})
            if res.get("data"):
                a = res["data"][0]
                suggested_artists.append(a)
                top = await deezer_get(f"/artist/{a['id']}/top", {"limit": 5})
                suggested_tracks.extend(top.get("data", []))
        except Exception:
            pass

    # Recherche par genre user → tracks
    genre_tracks: list = []
    for g in (user.favorite_genres or [])[:3]:
        try:
            r = await deezer_get("/search", {"q": g, "limit": 10})
            genre_tracks.extend(r.get("data", []))
        except Exception:
            pass

    # Nouveautés filtrées (recherche par genre + tri par date album)
    try:
        rel = await deezer_get("/editorial/0/releases")
        all_rel = rel.get("data", []) or []
        # Si user a des genres, on biaise via une recherche album par genre
        if user.favorite_genres:
            for g in user.favorite_genres[:2]:
                try:
                    sr = await deezer_get("/search/album", {"q": g, "limit": 10})
                    new_releases_user.extend(sr.get("data", []))
                except Exception:
                    pass
        if not new_releases_user:
            new_releases_user = all_rel[:15]
    except Exception:
        pass

    # Dédoublonnage tracks
    seen = set()
    uniq_tracks = []
    for t in suggested_tracks + genre_tracks:
        if t.get("id") and t["id"] not in seen and t.get("preview"):
            seen.add(t["id"])
            uniq_tracks.append(t)

    return {
        "for_you_tracks": uniq_tracks[:15],
        "trending_artists": suggested_artists[:10],
        "new_releases": new_releases_user[:15],
        "genres_used": user.favorite_genres or [],
        "artists_used": artists_pool,
    }


# ---------- Podcasts (via iTunes Search API public) ----------
ITUNES_BASE = "https://itunes.apple.com"


@api_router.get("/podcasts/search")
async def podcasts_search(q: str = Query(..., min_length=1), limit: int = 25):
    try:
        r = await http_client.get(f"{ITUNES_BASE}/search", params={"term": q, "media": "podcast", "limit": limit, "country": "FR"})
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="iTunes indisponible")


@api_router.get("/podcasts/top")
async def podcasts_top(limit: int = 25, country: str = "fr"):
    """Top podcasts via iTunes Top Charts."""
    try:
        url = f"{ITUNES_BASE}/{country}/rss/toppodcasts/limit={limit}/json"
        r = await http_client.get(url)
        r.raise_for_status()
        data = r.json()
        feed = data.get("feed", {})
        entries = feed.get("entry", [])
        results = []
        for e in entries:
            results.append({
                "id": int((e.get("id", {}).get("attributes", {}).get("im:id") or 0)),
                "name": e.get("im:name", {}).get("label"),
                "artist": e.get("im:artist", {}).get("label"),
                "image": (e.get("im:image", []) or [{}])[-1].get("label"),
                "summary": e.get("summary", {}).get("label", "")[:300],
            })
        return {"data": results}
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="iTunes indisponible")


@api_router.get("/podcasts/{collection_id}/episodes")
async def podcasts_episodes(collection_id: int, limit: int = 50):
    """Récupère le RSS feed via iTunes lookup puis parse les épisodes."""
    try:
        # 1) Récupère feedUrl via iTunes lookup
        r = await http_client.get(f"{ITUNES_BASE}/lookup", params={"id": collection_id, "entity": "podcast"})
        r.raise_for_status()
        results = r.json().get("results", [])
        if not results:
            raise HTTPException(status_code=404, detail="Podcast introuvable")
        meta = results[0]
        feed_url = meta.get("feedUrl")
        if not feed_url:
            raise HTTPException(status_code=404, detail="Pas de feed RSS")

        # 2) Parse RSS
        rf = await http_client.get(feed_url, follow_redirects=True)
        rf.raise_for_status()
        import xml.etree.ElementTree as ET
        root = ET.fromstring(rf.text)
        ns = {"itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd", "media": "http://search.yahoo.com/mrss/"}

        channel = root.find("channel")
        episodes = []
        if channel is not None:
            for item in channel.findall("item")[:limit]:
                title = (item.findtext("title") or "").strip()
                pub = item.findtext("pubDate") or ""
                desc = (item.findtext("description") or "")[:500]
                enc = item.find("enclosure")
                audio_url = enc.get("url") if enc is not None else None
                duration = item.findtext("itunes:duration", default="", namespaces=ns)
                # Parse mm:ss ou h:mm:ss
                dur_s = None
                try:
                    parts = [int(p) for p in (duration or "0").split(":")]
                    if len(parts) == 1: dur_s = parts[0]
                    elif len(parts) == 2: dur_s = parts[0]*60 + parts[1]
                    elif len(parts) == 3: dur_s = parts[0]*3600 + parts[1]*60 + parts[2]
                except Exception:
                    pass
                if audio_url:
                    episodes.append({
                        "id": item.findtext("guid") or audio_url,
                        "title": title,
                        "audio_url": audio_url,
                        "duration": dur_s,
                        "pub_date": pub,
                        "description": desc,
                    })
        return {
            "podcast": {
                "id": collection_id,
                "name": meta.get("collectionName"),
                "artist": meta.get("artistName"),
                "artwork": meta.get("artworkUrl600") or meta.get("artworkUrl100"),
                "summary": meta.get("description") or "",
            },
            "episodes": episodes,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"podcast episodes error: {e}")
        raise HTTPException(status_code=502, detail="Erreur parsing podcast")


# Saved podcasts (favoris)
@api_router.get("/saved-podcasts")
async def get_saved_podcasts(user: User = Depends(get_current_user)):
    docs = await db.saved_podcasts.find({"user_id": user.user_id}, {"_id": 0}).sort("added_at", -1).to_list(200)
    return {"data": [d["podcast"] for d in docs]}


@api_router.post("/saved-podcasts")
async def save_podcast(payload: dict, user: User = Depends(get_current_user)):
    p = payload.get("podcast") or {}
    if not p.get("id"):
        raise HTTPException(status_code=400, detail="podcast.id requis")
    await db.saved_podcasts.update_one(
        {"user_id": user.user_id, "podcast_id": p["id"]},
        {"$set": {"user_id": user.user_id, "podcast_id": p["id"], "podcast": p, "added_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


@api_router.delete("/saved-podcasts/{podcast_id}")
async def remove_saved_podcast(podcast_id: int, user: User = Depends(get_current_user)):
    await db.saved_podcasts.delete_one({"user_id": user.user_id, "podcast_id": podcast_id})
    return {"ok": True}


# ---------- IntelliRadio ----------
INTELLIRADIO_PROGRAMS = [
    {"slot": "06-10", "start": 6.0, "end": 10.0, "name": "IntelliRadio Wake-up", "tagline": "Énergie matinale", "kind": "music", "year_max": None, "year_min": None},
    {"slot": "10-14", "start": 10.0, "end": 14.0, "name": "IntelliRadio Discovery", "tagline": "Nouveautés & découvertes", "kind": "music", "year_max": None, "year_min": 2020},
    {"slot": "14-16", "start": 14.0, "end": 16.0, "name": "IntelliRadio Classics", "tagline": "Avant 2016, vos genres", "kind": "music", "year_max": 2015, "year_min": None},
    {"slot": "16-20", "start": 16.0, "end": 20.0, "name": "IntelliRadio Mix", "tagline": "Vos favoris & similaires", "kind": "music", "year_max": None, "year_min": None},
    # RMC en direct étendu : 20h00 → 01h30 (chevauche minuit)
    {"slot": "20-0130", "start": 20.0, "end": 1.5, "name": "RMC", "tagline": "Talk & Sport en direct", "kind": "rmc", "stream_url": RMC_STREAM_URL, "year_max": None, "year_min": None},
    {"slot": "0130-06", "start": 1.5, "end": 6.0, "name": "IntelliRadio Chill", "tagline": "Ambiance nocturne", "kind": "music", "year_max": None, "year_min": None},
]


def current_program(hour: float) -> dict:
    """Retourne le programme courant. Gère les slots qui chevauchent minuit (start > end)."""
    for p in INTELLIRADIO_PROGRAMS:
        s, e = p["start"], p["end"]
        if s < e:
            if s <= hour < e:
                return p
        else:
            # Slot qui passe minuit : actif si hour >= start OU hour < end
            if hour >= s or hour < e:
                return p
    return INTELLIRADIO_PROGRAMS[-1]


def filter_tracks_by_year(tracks: List[dict], year_min: Optional[int], year_max: Optional[int]) -> List[dict]:
    if year_min is None and year_max is None:
        return tracks
    out = []
    for t in tracks:
        rd = (t.get("album") or {}).get("release_date") or ""
        try:
            year = int(rd[:4]) if rd else None
        except Exception:
            year = None
        if year is None:
            out.append(t)
            continue
        if year_min and year < year_min:
            continue
        if year_max and year > year_max:
            continue
        out.append(t)
    return out


@api_router.get("/intelliradio")
async def intelliradio(user: User = Depends(get_current_user)):
    """Programme courant + queue de titres adaptés à l'user."""
    # Heure réelle en France (gère automatiquement l'heure d'été/hiver via zoneinfo)
    now = datetime.now(ZoneInfo("Europe/Paris"))
    hour = now.hour + now.minute / 60.0
    prog = current_program(hour)

    # RMC = stream direct, pas de queue
    if prog["kind"] == "rmc":
        return {"program": prog, "user": {"name": user.name, "country": user.country}, "tracks": [], "stream_url": RMC_STREAM_URL}

    # Sinon : on construit une queue depuis genres + artistes préférés + favoris
    seeds = []
    # Top tracks d'artistes préférés (manuels + sauvés)
    saved_artists_docs = await db.saved_artists.find({"user_id": user.user_id}, {"_id": 0}).to_list(50)
    saved_artist_names = [a["artist"]["name"] for a in saved_artists_docs if a.get("artist", {}).get("name")]
    artists_pool = list(dict.fromkeys((user.favorite_artists or []) + saved_artist_names))[:5]
    for artist_name in artists_pool[:3]:
        try:
            res = await deezer_get("/search/artist", {"q": artist_name, "limit": 1})
            if res.get("data"):
                aid = res["data"][0]["id"]
                top = await deezer_get(f"/artist/{aid}/top", {"limit": 8})
                seeds.extend(top.get("data", []))
        except Exception:
            pass
    # Recherche par genre
    for genre in (user.favorite_genres or [])[:2]:
        try:
            res = await deezer_get("/search", {"q": genre, "limit": 10})
            seeds.extend(res.get("data", []))
        except Exception:
            pass
    # Favoris
    favs = await db.favorites.find({"user_id": user.user_id}, {"_id": 0}).to_list(50)
    seeds.extend([f["track"] for f in favs])

    # Fallback chart si rien
    if not seeds:
        chart = await deezer_get("/chart")
        seeds = chart.get("tracks", {}).get("data", [])

    # Dédoublonnage
    seen = set()
    unique = []
    for t in seeds:
        if t.get("id") and t["id"] not in seen and t.get("preview"):
            seen.add(t["id"])
            unique.append(t)

    filtered = filter_tracks_by_year(unique, prog["year_min"], prog["year_max"])
    if not filtered:
        filtered = unique  # fallback si filtre année trop strict

    # Mélange déterministe simple
    import random
    random.seed(user.user_id + prog["slot"] + str(now.day))
    random.shuffle(filtered)

    return {
        "program": prog,
        "user": {"name": user.name, "country": user.country},
        "tracks": filtered[:30],
        "stream_url": None,
    }


@api_router.get("/intelliradio/schedule")
async def intelliradio_schedule():
    """Planning complet de la journée."""
    return {"programs": INTELLIRADIO_PROGRAMS}


@api_router.post("/profile/avatar")
async def update_avatar(payload: dict, user: User = Depends(get_current_user)):
    """Met à jour la photo de profil (base64 data URI ou URL externe)."""
    picture = payload.get("picture")
    if not picture or not isinstance(picture, str):
        raise HTTPException(status_code=400, detail="picture requis")
    # Limite taille base64 ~2MB
    if picture.startswith("data:") and len(picture) > 2_800_000:
        raise HTTPException(status_code=413, detail="Image trop grande (max 2 MB)")
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"picture": picture}})
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**user_doc)


# ---------- History (titres écoutés) ----------
@api_router.post("/history")
async def record_history(payload: TrackPayload, user: User = Depends(get_current_user)):
    """Enregistre un titre dans l'historique d'écoute (upsert → met à jour la date de dernière écoute)."""
    track = payload.track
    if not track.get("id"):
        raise HTTPException(status_code=400, detail="track.id requis")
    await db.history.update_one(
        {"user_id": user.user_id, "track_id": track["id"]},
        {"$set": {
            "user_id": user.user_id,
            "track_id": track["id"],
            "track": track,
            "played_at": datetime.now(timezone.utc),
        }, "$inc": {"play_count": 1}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/history/recent")
async def recent_history(limit: int = 20, user: User = Depends(get_current_user)):
    docs = await db.history.find({"user_id": user.user_id}, {"_id": 0}).sort("played_at", -1).limit(limit).to_list(limit)
    return {"data": [d["track"] for d in docs]}


@api_router.get("/history/top-artists")
async def top_listened_artists(limit: int = 5, user: User = Depends(get_current_user)):
    """Retourne les artistes les plus écoutés (agrégation par play_count)."""
    pipeline = [
        {"$match": {"user_id": user.user_id}},
        {"$group": {"_id": "$track.artist.id", "name": {"$first": "$track.artist.name"}, "plays": {"$sum": "$play_count"}}},
        {"$sort": {"plays": -1}},
        {"$limit": limit},
    ]
    out = await db.history.aggregate(pipeline).to_list(limit)
    return {"data": [{"id": x["_id"], "name": x["name"], "plays": x["plays"]} for x in out if x.get("name")]}


# ---------- Track radio (pour auto-queue similaires) ----------
@api_router.get("/deezer/track/{track_id}/radio")
async def deezer_track_radio(track_id: int):
    """Tracks similaires à un track donné (Deezer endpoint)."""
    return await deezer_get(f"/track/{track_id}/radio")


@api_router.get("/deezer/artist/{artist_id}/radio")
async def deezer_artist_radio(artist_id: int):
    return await deezer_get(f"/artist/{artist_id}/radio")


# ---------- Bulk search pour import TXT/CSV ----------
class BulkSearchPayload(BaseModel):
    queries: List[str]

@api_router.post("/search-tracks-bulk")
async def search_tracks_bulk(payload: BulkSearchPayload):
    """Recherche un lot de requêtes (ex: 'Drake - One Dance') et retourne le meilleur match pour chacune.
    Utilisé par l'import TXT/CSV."""
    queries = [q.strip() for q in (payload.queries or []) if q and q.strip()]
    if not queries:
        return {"results": []}
    if len(queries) > 300:
        raise HTTPException(status_code=400, detail="Max 300 requêtes par lot")

    import asyncio
    async def one(q: str):
        try:
            r = await deezer_get("/search", {"q": q, "limit": 1})
            data = r.get("data", [])
            return {"query": q, "track": data[0] if data else None}
        except Exception:
            return {"query": q, "track": None}

    # Parallèle mais contrôlé (semaphore)
    sem = asyncio.Semaphore(8)
    async def guarded(q):
        async with sem:
            return await one(q)
    results = await asyncio.gather(*[guarded(q) for q in queries])
    return {"results": results}


# ---------- IntelliRadio — programme du jour avec horloge virtuelle ----------
INTELLIRADIO_DAILY_CACHE: dict = {}  # {user_id+slot+date : {"tracks": [...], "generated_at": ts}}


async def _build_daily_program(user: User, slot_key: str, program: dict, target_count: int = 80) -> List[dict]:
    """Construit une liste de ~80 titres pour le slot, seed jour + user_id → change chaque jour, stable durant la journée."""
    date_str = datetime.now(ZoneInfo("Europe/Paris")).strftime("%Y-%m-%d")
    cache_key = f"{user.user_id}|{slot_key}|{date_str}"
    cached = INTELLIRADIO_DAILY_CACHE.get(cache_key)
    if cached and _time.time() - cached["t"] < 6 * 3600:
        return cached["tracks"]

    seeds: List[dict] = []
    # Artistes préférés (profile + suivis)
    saved_artists_docs = await db.saved_artists.find({"user_id": user.user_id}, {"_id": 0}).to_list(50)
    saved_artist_names = [a["artist"]["name"] for a in saved_artists_docs if a.get("artist", {}).get("name")]
    artists_pool = list(dict.fromkeys((user.favorite_artists or []) + saved_artist_names))[:8]
    for artist_name in artists_pool:
        try:
            res = await deezer_get("/search/artist", {"q": artist_name, "limit": 1})
            if res.get("data"):
                aid = res["data"][0]["id"]
                top = await deezer_get(f"/artist/{aid}/top", {"limit": 15})
                seeds.extend(top.get("data", []))
                try:
                    radio = await deezer_get(f"/artist/{aid}/radio", {"limit": 15})
                    seeds.extend(radio.get("data", []))
                except Exception:
                    pass
        except Exception:
            pass

    # Genres préférés (biaisés vers pré-2016 pour Classics)
    for genre in (user.favorite_genres or [])[:3]:
        try:
            q = genre
            if program.get("year_max") and program["year_max"] < 2016:
                q = f"{genre} 2010"
            res = await deezer_get("/search", {"q": q, "limit": 25})
            seeds.extend(res.get("data", []))
        except Exception:
            pass

    # Top artistes écoutés (basé sur historique)
    try:
        pipeline = [
            {"$match": {"user_id": user.user_id}},
            {"$group": {"_id": "$track.artist.id", "plays": {"$sum": "$play_count"}}},
            {"$sort": {"plays": -1}},
            {"$limit": 5},
        ]
        top_listened = await db.history.aggregate(pipeline).to_list(5)
        for item in top_listened:
            aid = item.get("_id")
            if aid:
                try:
                    tops = await deezer_get(f"/artist/{aid}/top", {"limit": 10})
                    seeds.extend(tops.get("data", []))
                except Exception:
                    pass
    except Exception:
        pass

    # Favoris
    favs = await db.favorites.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    seeds.extend([f["track"] for f in favs])

    # Fallback chart
    if len(seeds) < 30:
        try:
            chart = await deezer_get("/chart")
            seeds.extend(chart.get("tracks", {}).get("data", []))
        except Exception:
            pass

    # Dédoublonnage
    seen = set()
    unique = []
    for t in seeds:
        if t.get("id") and t["id"] not in seen and t.get("preview"):
            seen.add(t["id"])
            unique.append(t)

    filtered = filter_tracks_by_year(unique, program.get("year_min"), program.get("year_max"))
    if len(filtered) < 20:
        filtered = unique

    # Mélange déterministe : seed = user_id + slot + date → stable durant 24h, change chaque jour
    import random as _random
    rng = _random.Random(f"{user.user_id}|{slot_key}|{date_str}")
    rng.shuffle(filtered)

    # On prend target_count titres (ou ce qu'on a)
    result = filtered[:target_count]
    INTELLIRADIO_DAILY_CACHE[cache_key] = {"t": _time.time(), "tracks": result}
    return result


@api_router.get("/intelliradio/daily")
async def intelliradio_daily(user: User = Depends(get_current_user)):
    """Programme du jour complet + position virtuelle (track "live" au moment courant).

    Calcul :
    - On construit une playlist stable pour l'user+slot+date.
    - Position virtuelle = seconds écoulées depuis le début du slot modulo la durée totale de la playlist.
    - Le client peut ainsi se "tuner" au track live et au bon timecode.
    """
    now = datetime.now(ZoneInfo("Europe/Paris"))
    hour = now.hour + now.minute / 60.0
    prog = current_program(hour)

    if prog["kind"] == "rmc":
        return {"program": prog, "live": True, "tracks": [], "stream_url": RMC_STREAM_URL, "virtual_position_sec": 0, "current_index": 0}

    slot = prog["slot"]
    tracks = await _build_daily_program(user, slot, prog)
    if not tracks:
        return {"program": prog, "live": False, "tracks": [], "virtual_position_sec": 0, "current_index": 0}

    # Calcul du début du slot en secondes depuis minuit
    slot_start = prog["start"] * 3600.0
    # Secondes écoulées depuis minuit (heure locale Paris)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elapsed_today = (now - midnight).total_seconds()
    # Gère le slot qui chevauche minuit : si on est dans le slot APRÈS minuit, on ajoute 24h à "elapsed"
    if prog["start"] > prog["end"] and hour < prog["end"]:
        elapsed_in_slot = elapsed_today + (24 * 3600 - slot_start)
    else:
        elapsed_in_slot = max(0.0, elapsed_today - slot_start)

    # Durée totale de la playlist
    total = 0
    cumulative = []  # cumul de la durée (en sec) à la fin de chaque track
    for t in tracks:
        dur = int(t.get("duration") or 30)
        total += dur
        cumulative.append(total)

    # Position virtuelle modulo la durée totale → la playlist tourne en boucle sur le slot
    if total <= 0:
        vpos = 0.0
    else:
        vpos = elapsed_in_slot % total

    # Trouve le track courant
    current_idx = 0
    offset_in_track = vpos
    for i, c in enumerate(cumulative):
        if vpos < c:
            current_idx = i
            prev = cumulative[i - 1] if i > 0 else 0
            offset_in_track = vpos - prev
            break

    return {
        "program": prog,
        "live": False,
        "tracks": tracks,
        "current_index": current_idx,
        "offset_in_track_sec": offset_in_track,
        "virtual_position_sec": vpos,
        "total_duration_sec": total,
        "slot_start_ts": midnight.timestamp() + slot_start,
    }


# ---------- Recommendations par pays ----------
@api_router.get("/recommendations")
async def recommendations(user: User = Depends(get_current_user)):
    """Charts adaptés au pays de l'user (Deezer ne fournit pas de chart par pays sur l'API publique → on biaise via recherche)."""
    chart = await deezer_get("/chart")
    return {"country": user.country, "tracks": chart.get("tracks", {}).get("data", []), "albums": chart.get("albums", {}).get("data", [])}


# ---------- Deezer proxy public ----------
@api_router.get("/")
async def root():
    return {"message": "IntelliMusic API", "status": "ok"}

@api_router.get("/deezer/chart")
async def deezer_chart():
    return await deezer_get("/chart")

@api_router.get("/deezer/search")
async def deezer_search(q: str = Query(..., min_length=1), limit: int = 25):
    return await deezer_get("/search", {"q": q, "limit": limit})

@api_router.get("/deezer/search/album")
async def deezer_search_album(q: str = Query(..., min_length=1), limit: int = 25):
    return await deezer_get("/search/album", {"q": q, "limit": limit})

@api_router.get("/deezer/search/artist")
async def deezer_search_artist(q: str = Query(..., min_length=1), limit: int = 25):
    return await deezer_get("/search/artist", {"q": q, "limit": limit})

@api_router.get("/deezer/genres")
async def deezer_genres():
    return await deezer_get("/genre")

@api_router.get("/deezer/album/{album_id}")
async def deezer_album(album_id: int):
    return await deezer_get(f"/album/{album_id}")

@api_router.get("/deezer/artist/{artist_id}/top")
async def deezer_artist_top(artist_id: int, limit: int = 10):
    return await deezer_get(f"/artist/{artist_id}/top", {"limit": limit})

@api_router.get("/deezer/artist/{artist_id}/albums")
async def deezer_artist_albums(artist_id: int, limit: int = 25):
    return await deezer_get(f"/artist/{artist_id}/albums", {"limit": limit})

@api_router.get("/deezer/artist/{artist_id}")
async def deezer_artist_info(artist_id: int):
    return await deezer_get(f"/artist/{artist_id}")

@api_router.get("/deezer/editorial/releases")
async def deezer_new_releases():
    return await deezer_get("/editorial/0/releases")


# ---------- Streaming full audio via yt-dlp (cache 4h) ----------
_stream_cache: dict = {}
_stream_cache_lock = threading.Lock()
STREAM_CACHE_TTL = 4 * 3600  # 4h (les URLs YouTube expirent ~6h)

# Auto-update yt-dlp en arrière-plan au démarrage (YouTube change souvent)
def _auto_update_ytdlp():
    try:
        subprocess.run(
            ["pip", "install", "-U", "--quiet", "yt-dlp"],
            timeout=120, check=False, capture_output=True
        )
        logger.info("yt-dlp auto-update terminé")
    except Exception as e:
        logger.warning(f"yt-dlp auto-update fail: {e}")

threading.Thread(target=_auto_update_ytdlp, daemon=True).start()


YDL_OPTS = {
    # Force m4a/mp3 (iOS AVFoundation compatible) — évite opus/webm
    "format": "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio[acodec^=mp3]/best[ext=m4a]/best",
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "noplaylist": True,
    "default_search": "ytsearch5",
    "extract_flat": False,
    "socket_timeout": 12,
    "source_address": "0.0.0.0",
    "geo_bypass": True,
    "ignoreerrors": True,
}


def _resolve_stream(query: str, expected_duration: int = 0) -> dict:
    """Recherche YouTube + filtre m4a/mp3 (iOS-compatible). Retourne le résultat valide
    avec la durée la plus proche de expected_duration (si fourni). Évite intros/extended."""
    with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
        info = ydl.extract_info(f"ytsearch5:{query}", download=False)
        entries = (info or {}).get("entries", []) if isinstance(info, dict) else []
        candidates = []
        for entry in entries:
            if not entry or not entry.get("url"):
                continue
            ext = (entry.get("ext") or "").lower()
            acodec = (entry.get("acodec") or "").lower()
            # Skip formats non décodables sur iOS
            if ext in ("webm", "opus") or "opus" in acodec or "vorbis" in acodec:
                continue
            candidates.append({
                "url": entry.get("url"),
                "title": entry.get("title"),
                "duration": entry.get("duration"),
                "uploader": entry.get("uploader"),
                "thumbnail": entry.get("thumbnail"),
                "ext": entry.get("ext"),
                "acodec": entry.get("acodec"),
                "video_id": entry.get("id"),
            })
        if not candidates:
            return {}

        # Si on a une durée attendue, on prend le candidat dont la durée est la plus proche
        # (tolérance ±20s parfaitement OK, sinon on accepte le moins pire)
        if expected_duration and expected_duration > 30:
            def diff(c):
                d = c.get("duration") or 0
                return abs(d - expected_duration) if d else 9999

            candidates.sort(key=diff)
            best = candidates[0]
            # Si la dérive reste >90s on prend quand même mais le client utilisera Deezer comme référence
            return best

        return candidates[0]


@api_router.get("/stream")
async def stream(q: str = Query(..., min_length=2), expected: int = Query(0, ge=0)):
    """Résout une requête (ex: 'Drake One Dance') vers une URL audio streamable complète.
    `expected` (s) : durée Deezer attendue, utilisée pour choisir la vidéo YouTube la plus fidèle."""
    key = f"{q.strip().lower()}|{expected}" if expected else q.strip().lower()
    now = _time.time()
    with _stream_cache_lock:
        cached = _stream_cache.get(key)
        if cached and now - cached["t"] < STREAM_CACHE_TTL:
            return cached["data"]

    import asyncio
    try:
        data = await asyncio.to_thread(_resolve_stream, q, expected)
        if not data.get("url"):
            raise HTTPException(status_code=404, detail="Aucun flux trouvé")
        with _stream_cache_lock:
            _stream_cache[key] = {"t": now, "data": data}
        return data
    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp error pour '{q}': {e}")
        raise HTTPException(status_code=502, detail="Extraction du flux échouée")
    except Exception as e:
        logger.error(f"stream error: {e}")
        raise HTTPException(status_code=500, detail="Erreur serveur")


app.include_router(api_router)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    await http_client.aclose()
    client.close()
