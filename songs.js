console.log('songs.js loaded');

// Optional per-song fields (all safe to leave out):
//   bpm:          song tempo -> the background pulses on the beat
//   beatOffset:   ms until the first beat (default 0)
//   previewStart: second where the song-select preview starts (default 15)
//   preview:      set to false to disable the preview for that song
//   team:         'dream' | 'love' | 'passion' -> only that team's cards are equipped
//                 (leave it out, or use null, to allow every member's cards)
window.SONGS = [
  {
    id: 'ayo_senyumlah',
    title: 'Ayo Senyumlah',
    artist: 'JKT48',
    team: null,
    audio: 'music/ayo_senyumlah.mp3',
    chart: 'charts/ayo_senyumlah.js',
    cover: 'images/ayo_senyumlah.webp'
  },
  {
    id: 'wakaka_people',
    title: 'WAKAKA People',
    artist: 'JKT48 Team Dream',
    team: 'dream',
    audio: 'music/wakaka_people.mp3',
    chart: 'charts/wakaka_people.js',
    cover: 'images/wakaka_people.webp'
  },
    {
    id: '12_seconds',
    title: '12 Seconds',
    artist: 'JKT48 Team Love',
    team: 'love',
    audio: 'music/12_seconds.mp3',
    chart: 'charts/12_seconds.js',
    cover: 'images/12_seconds.webp'
  },
    {
    id: 'dekat_namun_jauh',
    title: 'Dekat Namun Jauh',
    artist: 'JKT48 Team Passion',
    team: 'passion',
    audio: 'music/dekat_namun_jauh.mp3',
    chart: 'charts/dekat_namun_jauh.js',
    cover: 'images/dekat_namun_jauh.webp'
  },
  {
    id: 'andai_ku_bukan_idola',
  title: 'Andai \'Ku Bukan Idola',
  artist: 'JKT48',
  team: null,
  only: ['fiony', 'christy', 'olla', 'freya', 'gita', 'gracie', 'greesel', 'jessi', 'kathrina', 'marsha', 'michie', 'muthe'],
  audio: 'music/andai_ku_bukan_idola.mp3',
  chart: 'charts/andai_ku_bukan_idola.js',
  cover: 'images/andai_ku_bukan_idola.webp'
  },
    {
    id: 'beginners_gamble',
    title: 'Beginner\'s Gamble',
    artist: 'JKT48',
    team: null,
    only: ['christy', 'lia', 'fiony', 'freya', 'gita', 'gracie', 'greesel', 'jessi', 'marsha', 'michie', 'muthe', 'kathrina'],
    audio: 'music/beginners_gamble.mp3',
    chart: 'charts/beginners_gamble.js',
    cover: 'images/pertaruhan_cinta.webp'
  },
    {
    id: 'raja_hati',
    title: 'Raja Hati',
    artist: 'JKT48',
    team: null,
    only: ['christy', 'lia', 'fiony', 'freya', 'gita', 'gracie', 'greesel', 'jessi', 'marsha', 'michie', 'muthe', 'kathrina'],
    audio: 'music/raja_hati.mp3',
    chart: 'charts/raja_hati.js',
    cover: 'images/pertaruhan_cinta.webp'
  },
    {
    id: 'percik_kecil',
    title: 'Percik Kecil',
    artist: 'Bernadya, JKT48',
    team: null,
    only: ['freya', 'gita', 'christy', 'jessi', 'muthe', 'fiony', 'kathrina', 'marsha', 'ella', 'michie', 'greesel'],
    guest: 'bernadya',
    audio: 'music/percik_kecil.mp3',
    chart: 'charts/percik_kecil.js',
    cover: 'images/percik_kecil.webp'
  },
    {
    id: 'oh_my_pumpkin',
    title: 'Oh my pumpkin!',
    artist: 'JKT48',
    team: null,
    audio: 'music/oh_my_pumpkin.mp3',
    chart: 'charts/oh_my_pumpkin.js',
    cover: 'images/oh_my_pumpkin.webp'
  },
    {
    id: 'go_and_fight',
    title: 'GO AND FIGHT!',
    artist: 'JKT48',
    team: null,
    only: ['michie', 'lia', 'lana', 'elin', 'fritzy', 'ella', 'gracie', 'greesel', 'lyn', 'christy', 'fiony', 'freya'],
    audio: 'music/go_and_fight.mp3',
    chart: 'charts/go_and_fight.js',
    cover: 'images/go_and_fight.webp'
  },
    {
    id: 'bibir_yang_telah_dicuri',
    title: 'Bibir yang Telah Dicuri',
    artist: 'JKT48',
    team: null,
    only: ['indah', 'olla', 'lana', 'gracie', 'erine', 'kathrina', 'greesel', 'eli', 'ella', 'delynn'],
    audio: 'music/bibir_yang_telah_dicuri.mp3',
    chart: 'charts/bibir_yang_telah_dicuri.js',
    cover: 'images/bibir_yang_telah_dicuri.webp'
  },
    {
    id: 'kusangatsuka',
    title: '#KuSangatSuka',
    artist: 'JKT48',
    team: null,
    only: ['feni', 'christy', 'jessi', 'fiony', 'muthe', 'freya', 'gita', 'marsha', 'lia', 'lulu', 'oniel'],
    audio: 'music/kusangatsuka.mp3',
    chart: 'charts/kusangatsuka.js',
    cover: 'images/bibir_yang_telah_dicuri.webp'
  },
    {
    id: 'laptime_masa_remaja',
    title: 'LapTime Masa Remaja',
    artist: 'JKT48',
    team: null,
    audio: 'music/laptime_masa_remaja.mp3',
    chart: 'charts/laptime_masa_remaja.js',
    cover: 'images/laptime_masa_remaja.webp'
  },
    {
    id: 'belalang_yang_membangkang',
    title: 'Belalang yang Membangkang',
    artist: 'JKT48',
    team: null,
    only: ['michie', 'anindya', 'elin', 'cynthia', 'danella', 'daisy', 'aralie', 'lana', 'erine', 'fritzy', 'lily', 'trisha', 'levi', 'nayla', 'nachia', 'oline', 'nala', 'ribka', 'kimmy'],
    audio: 'music/belalang_yang_membangkang.mp3',
    chart: 'charts/belalang_yang_membangkang.js',
    cover: 'images/belalang_yang_membangkang.webp'
  },
    {
    id: 'magic_hour',
    title: 'Magic Hour',
    artist: 'JKT48',
    team: null,
    only: ['marsha', 'christy', 'feni', 'fiony', 'freya', 'gita', 'jessi', 'kathrina', 'muthe'],
    audio: 'music/magic_hour.mp3',
    chart: 'charts/magic_hour.js',
    cover: 'images/magic_hour.webp'
  },
    {
    id: 'langit_biru_cinta_searah',
    title: 'Langit Biru Cinta Searah',
    artist: 'JKT48',
    team: null,
    only: ['ella', 'lulu', 'oniel', 'eli', 'greesel', 'freya'],
    guest: 'pia',
    audio: 'music/langit_biru_cinta_searah.mp3',
    chart: 'charts/langit_biru_cinta_searah.js',
    cover: 'images/langit_biru_cinta_searah.webp'
  },
    {
    id: 'must_be_now',
    title: 'Must Be Now',
    artist: 'JKT48',
    team: null,
    audio: 'music/must_be_now.mp3',
    chart: 'charts/must_be_now.js',
    cover: 'images/must_be_now.webp'
  },
    {
    id: 'apa_yang_sang_gadis_perbuat_di_musim_panas',
    title: 'Apa yang Sang Gadis Perbuat di Musim Panas',
    artist: 'JKT48',
    team: null,
    audio: 'music/apa_yang_sang_gadis_perbuat_di_musim_panas.mp3',
    chart: 'charts/apa_yang_sang_gadis_perbuat_di_musim_panas.js',
    cover: 'images/must_be_now.webp'
  }
];