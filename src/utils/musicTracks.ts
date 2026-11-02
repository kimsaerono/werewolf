export interface MusicTrack {
  id: string
  title: string
  src: string
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "pixabay-510767", title: "阳光尤克里里 · Happy Ukulele", src: "audio/music/happy-ukulele.mp3" },
  { id: "pixabay-499483", title: "欢乐儿童 · Kids Funk", src: "audio/music/kids-funk.mp3" },
  { id: "pixabay-174247", title: "夏日好心情 · Feel Good Pop", src: "audio/music/feel-good-summer-pop.mp3" },
  { id: "pixabay-187119", title: "快乐小花 · Happy Flowers", src: "audio/music/happy-flowers-xylophone.mp3" },
  { id: "pixabay-313326", title: "夏日律动 · Summer EDM", src: "audio/music/summer-edm.mp3" },
  { id: "pixabay-468332", title: "放克趣味 · Fun Funk", src: "audio/music/fun-funk.mp3" },
  { id: "pixabay-595510", title: "独立小乐趣 · Indie Fun", src: "audio/music/indie-fun.mp3" },
  { id: "pixabay-583255", title: "卡通动画 · Cartoon Fun", src: "audio/music/cartoon-fun.mp3" },
  { id: "pixabay-579511", title: "轻快爵士 · Upbeat Jazz", src: "audio/music/jazz-upbeat.mp3" },
  { id: "pixabay-308504", title: "热带风情 · Tropical Pop", src: "audio/music/tropical-pop.mp3" },
]

export const DEFAULT_TRACK_ID = MUSIC_TRACKS[0].id
