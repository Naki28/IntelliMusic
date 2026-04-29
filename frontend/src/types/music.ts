// MusicModel — Types des données Deezer
export interface Artist {
  id: number;
  name: string;
  picture?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  nb_fan?: number;
}

export interface Album {
  id: number;
  title: string;
  cover?: string;
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
  artist?: Artist;
  release_date?: string;
  tracks?: { data: Track[] };
}

export interface Track {
  id: number;
  title: string;
  title_short?: string;
  duration: number;
  preview: string; // URL MP3 30s
  artist: Artist;
  album: Album;
}

export interface Genre {
  id: number;
  name: string;
  picture?: string;
  picture_medium?: string;
  picture_big?: string;
}

export interface ChartResponse {
  tracks: { data: Track[] };
  albums: { data: Album[] };
  artists: { data: Artist[] };
  playlists: { data: any[] };
}
