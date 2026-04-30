// ContextMenuProvider — Contexte global pour le menu contextuel Liquid Glass
import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Share } from "react-native";
import { useRouter } from "expo-router";
import ContextMenu, { ContextItemType } from "../components/ContextMenu";
import { usePlayer } from "./PlayerContext";
import { useFavorites } from "./FavoritesContext";
import { useLibrary } from "./LibraryContext";
import { usePodcastProgress } from "./PodcastProgressContext";
import { DeezerAPI } from "../api/deezer";
import { showToast } from "../lib/toast";
import { Track, Album, Artist } from "../types/music";

interface PodcastEpisode {
  id: string;
  title: string;
  audio_url?: string;
  duration?: number;
  pub_date?: string;
  description?: string;
}

interface PodcastMeta {
  id: number;
  name: string;
  artist?: string;
  artwork?: string;
}

interface ContextMenuState {
  visible: boolean;
  type: ContextItemType;
  track?: Track;
  podcast?: { meta: PodcastMeta; episode?: PodcastEpisode };
  album?: Album;
  artist?: Artist;
}

interface ContextMenuContextValue {
  openTrackMenu: (track: Track) => void;
  openPodcastMenu: (meta: PodcastMeta, episode?: PodcastEpisode) => void;
  openAlbumMenu: (album: Album) => void;
  openArtistMenu: (artist: Artist) => void;
  closeMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | undefined>(undefined);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { addToQueue, playNext, playQueue, mode } = usePlayer();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { savedAlbums, savedArtists, saveAlbum, removeAlbum, saveArtist, removeArtist } = useLibrary();
  const { markCompleted } = usePodcastProgress();

  const [menuState, setMenuState] = useState<ContextMenuState>({
    visible: false,
    type: "track",
  });

  // Ouvrir le menu
  const openTrackMenu = useCallback((track: Track) => {
    setMenuState({ visible: true, type: "track", track });
  }, []);

  const openPodcastMenu = useCallback((meta: PodcastMeta, episode?: PodcastEpisode) => {
    setMenuState({ visible: true, type: "podcast", podcast: { meta, episode } });
  }, []);

  const openAlbumMenu = useCallback((album: Album) => {
    setMenuState({ visible: true, type: "album", album });
  }, []);

  const openArtistMenu = useCallback((artist: Artist) => {
    setMenuState({ visible: true, type: "artist", artist });
  }, []);

  const closeMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, visible: false }));
  }, []);

  // === Actions ===
  const handleAddToQueue = useCallback(() => {
    const { type, track, album } = menuState;
    if (type === "track" && track) {
      addToQueue([track]);
      showToast("Ajouté à la file d'attente");
    } else if (type === "album" && album) {
      DeezerAPI.album(album.id).then((fullAlbum) => {
        const tracks = fullAlbum.tracks?.data || [];
        if (tracks.length > 0) {
          addToQueue(tracks.map((t: any) => ({ ...t, album: fullAlbum, artist: t.artist || fullAlbum.artist })));
          showToast(`Album ajouté (${tracks.length} titres)`);
        }
      }).catch(() => showToast("Erreur lors de l'ajout"));
    }
    closeMenu();
  }, [menuState, addToQueue, closeMenu]);

  const handlePlayNext = useCallback(() => {
    const { type, track } = menuState;
    if (type === "track" && track) {
      playNext([track]);
      showToast("Sera lu après le titre actuel");
    }
    closeMenu();
  }, [menuState, playNext, closeMenu]);

  const handleStartRadio = useCallback(async () => {
    const { track } = menuState;
    if (!track) return;
    try {
      showToast("Création du mix...");
      const radio = await DeezerAPI.trackRadio(track.id);
      if (radio.data?.length > 0) {
        const radioTracks = [track, ...radio.data.filter((t: Track) => t.id !== track.id)];
        playQueue(radioTracks, 0);
        showToast(`Mix inspiré de "${track.title}"`);
      } else {
        showToast("Impossible de créer le mix");
      }
    } catch {
      showToast("Erreur lors de la création du mix");
    }
    closeMenu();
  }, [menuState, playQueue, closeMenu]);

  const handleToggleFavorite = useCallback(() => {
    const { track } = menuState;
    if (!track) return;
    if (isFavorite(track.id)) {
      removeFavorite(track.id);
      showToast("Retiré des favoris");
    } else {
      addFavorite(track);
      showToast("Ajouté aux favoris");
    }
    closeMenu();
  }, [menuState, isFavorite, addFavorite, removeFavorite, closeMenu]);

  const handleGoToAlbum = useCallback(() => {
    const { track } = menuState;
    if (track?.album?.id) {
      router.push(`/album/${track.album.id}`);
    }
    closeMenu();
  }, [menuState, router, closeMenu]);

  const handleGoToArtist = useCallback(() => {
    const { track, album } = menuState;
    const artistId = track?.artist?.id || album?.artist?.id;
    if (artistId) {
      router.push(`/artist/${artistId}`);
    }
    closeMenu();
  }, [menuState, router, closeMenu]);

  const handleShare = useCallback(async () => {
    const { type, track, album, artist, podcast } = menuState;
    let message = "";
    
    switch (type) {
      case "track":
        if (track) message = `🎵 Écoute "${track.title}" de ${track.artist?.name} sur IntelliMusic!`;
        break;
      case "album":
        if (album) message = `💿 Découvre l'album "${album.title}" de ${album.artist?.name} sur IntelliMusic!`;
        break;
      case "artist":
        if (artist) message = `🎤 Découvre ${artist.name} sur IntelliMusic!`;
        break;
      case "podcast":
        if (podcast?.episode) message = `🎙️ Écoute "${podcast.episode.title}" sur IntelliMusic!`;
        break;
    }

    if (message) {
      try {
        await Share.share({ message });
      } catch {}
    }
    closeMenu();
  }, [menuState, closeMenu]);

  const handleToggleAlbumLibrary = useCallback(() => {
    const { album } = menuState;
    if (!album) return;
    const isInLib = savedAlbums.some((a) => a.id === album.id);
    if (isInLib) {
      removeAlbum(album.id);
      showToast("Album retiré de la bibliothèque");
    } else {
      saveAlbum(album);
      showToast("Album ajouté à la bibliothèque");
    }
    closeMenu();
  }, [menuState, savedAlbums, saveAlbum, removeAlbum, closeMenu]);

  const handleToggleArtistLibrary = useCallback(() => {
    const { artist } = menuState;
    if (!artist) return;
    const isFollowing = savedArtists.some((a) => a.id === artist.id);
    if (isFollowing) {
      removeArtist(artist.id);
      showToast("Vous ne suivez plus cet artiste");
    } else {
      saveArtist(artist);
      showToast("Artiste suivi");
    }
    closeMenu();
  }, [menuState, savedArtists, saveArtist, removeArtist, closeMenu]);

  const handleMarkPodcastPlayed = useCallback(() => {
    const { podcast } = menuState;
    if (podcast?.episode?.id) {
      markCompleted(podcast.episode.id);
      showToast("Marqué comme écouté");
    }
    closeMenu();
  }, [menuState, markCompleted, closeMenu]);

  const handleDontRecommend = useCallback(() => {
    showToast("Ce titre ne sera plus recommandé");
    closeMenu();
  }, [closeMenu]);

  const handleAddToPlaylist = useCallback(() => {
    // TODO: Ouvrir un modal de sélection de playlist
    showToast("Fonctionnalité à venir");
    closeMenu();
  }, [closeMenu]);

  // Calcul des props pour le ContextMenu
  const { type, track, album, artist, podcast } = menuState;
  const isPlaying = mode !== "idle";
  const isTrackFavorite = track ? isFavorite(track.id) : false;
  const isAlbumInLibrary = type === "album" && album ? savedAlbums.some((a) => a.id === album.id) : false;
  const isArtistFollowed = type === "artist" && artist ? savedArtists.some((a) => a.id === artist.id) : false;

  return (
    <ContextMenuContext.Provider value={{ openTrackMenu, openPodcastMenu, openAlbumMenu, openArtistMenu, closeMenu }}>
      {children}
      <ContextMenu
        visible={menuState.visible}
        onClose={closeMenu}
        type={type}
        track={track}
        album={album}
        artist={artist}
        podcast={podcast}
        isPlaying={isPlaying}
        isFavorite={isTrackFavorite}
        isInLibrary={isAlbumInLibrary || isArtistFollowed}
        onAddToQueue={handleAddToQueue}
        onPlayNext={handlePlayNext}
        onStartRadio={handleStartRadio}
        onToggleFavorite={handleToggleFavorite}
        onAddToPlaylist={handleAddToPlaylist}
        onGoToAlbum={handleGoToAlbum}
        onGoToArtist={handleGoToArtist}
        onShare={handleShare}
        onAddToLibrary={type === "album" ? handleToggleAlbumLibrary : handleToggleArtistLibrary}
        onRemoveFromLibrary={type === "album" ? handleToggleAlbumLibrary : handleToggleArtistLibrary}
        onMarkAsPlayed={handleMarkPodcastPlayed}
        onDontRecommend={handleDontRecommend}
      />
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error("useContextMenu must be used within ContextMenuProvider");
  return ctx;
}
