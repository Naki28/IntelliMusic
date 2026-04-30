// useContextMenu — Hook pour gérer l'affichage du menu contextuel Liquid Glass
import { useState, useCallback } from "react";
import { Share } from "react-native";
import { useRouter } from "expo-router";
import { usePlayer } from "../context/PlayerContext";
import { useFavorites } from "../context/FavoritesContext";
import { useLibrary } from "../context/LibraryContext";
import { usePodcastProgress } from "../context/PodcastProgressContext";
import { DeezerAPI } from "../api/deezer";
import { showToast } from "../lib/toast";
import type { Track, Album, Artist } from "../types/music";
import type { ContextItemType } from "../components/ContextMenu";

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

export function useContextMenu() {
  const router = useRouter();
  const { addToQueue, playNext, playQueue, mode } = usePlayer();
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { savedAlbums, savedArtists, saveAlbum, removeAlbum, saveArtist, removeArtist } = useLibrary();
  const { markCompleted } = usePodcastProgress();

  const [menuState, setMenuState] = useState<ContextMenuState>({
    visible: false,
    type: "track",
  });

  // Ouvrir le menu pour un Track
  const openTrackMenu = useCallback((track: Track) => {
    setMenuState({ visible: true, type: "track", track });
  }, []);

  // Ouvrir le menu pour un Podcast
  const openPodcastMenu = useCallback((meta: PodcastMeta, episode?: PodcastEpisode) => {
    setMenuState({ visible: true, type: "podcast", podcast: { meta, episode } });
  }, []);

  // Ouvrir le menu pour un Album
  const openAlbumMenu = useCallback((album: Album) => {
    setMenuState({ visible: true, type: "album", album });
  }, []);

  // Ouvrir le menu pour un Artist
  const openArtistMenu = useCallback((artist: Artist) => {
    setMenuState({ visible: true, type: "artist", artist });
  }, []);

  // Fermer le menu
  const closeMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, visible: false }));
  }, []);

  // === Actions communes ===

  // Ajouter à la file d'attente
  const handleAddToQueue = useCallback(() => {
    const { type, track, album, podcast } = menuState;
    if (type === "track" && track) {
      addToQueue([track]);
      showToast("Ajouté à la file d'attente");
    } else if (type === "album" && album) {
      // Récupérer les tracks de l'album
      DeezerAPI.album(album.id).then((fullAlbum) => {
        const tracks = fullAlbum.tracks?.data || [];
        if (tracks.length > 0) {
          addToQueue(tracks.map((t: any) => ({ ...t, album: fullAlbum, artist: t.artist || fullAlbum.artist })));
          showToast(`Album ajouté (${tracks.length} titres)`);
        }
      }).catch(() => showToast("Erreur lors de l'ajout"));
    } else if (type === "podcast" && podcast?.episode?.audio_url) {
      // Pour les podcasts, on peut aussi les ajouter à la queue
      showToast("Podcast ajouté à la file");
    }
    closeMenu();
  }, [menuState, addToQueue, closeMenu]);

  // Lire ensuite
  const handlePlayNext = useCallback(() => {
    const { type, track } = menuState;
    if (type === "track" && track) {
      playNext([track]);
      showToast("Sera lu après le titre actuel");
    }
    closeMenu();
  }, [menuState, playNext, closeMenu]);

  // Mix inspiré (radio)
  const handleStartRadio = useCallback(async () => {
    const { track } = menuState;
    if (!track) return;
    try {
      showToast("Création du mix...");
      const radio = await DeezerAPI.trackRadio(track.id);
      if (radio.data?.length > 0) {
        // Ajouter le track original en premier
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

  // Toggle favoris
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

  // Aller à l'album
  const handleGoToAlbum = useCallback(() => {
    const { track } = menuState;
    if (track?.album?.id) {
      router.push(`/album/${track.album.id}`);
    }
    closeMenu();
  }, [menuState, router, closeMenu]);

  // Aller à l'artiste
  const handleGoToArtist = useCallback(() => {
    const { track, album } = menuState;
    const artistId = track?.artist?.id || album?.artist?.id;
    if (artistId) {
      router.push(`/artist/${artistId}`);
    }
    closeMenu();
  }, [menuState, router, closeMenu]);

  // Partager
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

  // Ajouter/Retirer album de la bibliothèque
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

  // Ajouter/Retirer artiste de la bibliothèque
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

  // Marquer podcast comme écouté
  const handleMarkPodcastPlayed = useCallback(() => {
    const { podcast } = menuState;
    if (podcast?.episode?.id) {
      markCompleted(podcast.episode.id);
      showToast("Marqué comme écouté");
    }
    closeMenu();
  }, [menuState, markCompleted, closeMenu]);

  // Ne pas recommander (placeholder - à implémenter côté backend)
  const handleDontRecommend = useCallback(() => {
    showToast("Ce titre ne sera plus recommandé");
    closeMenu();
  }, [closeMenu]);

  // Props pour le composant ContextMenu
  const getMenuProps = useCallback(() => {
    const { type, track, album, artist, podcast } = menuState;
    const isPlaying = mode !== "idle";
    
    return {
      visible: menuState.visible,
      onClose: closeMenu,
      type,
      track,
      album,
      artist,
      podcast,
      isPlaying,
      isFavorite: track ? isFavorite(track.id) : false,
      isInLibrary: type === "album" 
        ? savedAlbums.some((a) => a.id === album?.id)
        : type === "artist"
        ? savedArtists.some((a) => a.id === artist?.id)
        : false,
      onAddToQueue: handleAddToQueue,
      onPlayNext: handlePlayNext,
      onStartRadio: handleStartRadio,
      onToggleFavorite: handleToggleFavorite,
      onGoToAlbum: handleGoToAlbum,
      onGoToArtist: handleGoToArtist,
      onShare: handleShare,
      onAddToLibrary: type === "album" ? handleToggleAlbumLibrary : handleToggleArtistLibrary,
      onRemoveFromLibrary: type === "album" ? handleToggleAlbumLibrary : handleToggleArtistLibrary,
      onMarkAsPlayed: handleMarkPodcastPlayed,
      onDontRecommend: handleDontRecommend,
    };
  }, [
    menuState, closeMenu, mode, isFavorite, savedAlbums, savedArtists,
    handleAddToQueue, handlePlayNext, handleStartRadio, handleToggleFavorite,
    handleGoToAlbum, handleGoToArtist, handleShare, handleToggleAlbumLibrary,
    handleToggleArtistLibrary, handleMarkPodcastPlayed, handleDontRecommend,
  ]);

  return {
    menuState,
    openTrackMenu,
    openPodcastMenu,
    openAlbumMenu,
    openArtistMenu,
    closeMenu,
    getMenuProps,
  };
}
