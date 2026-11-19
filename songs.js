console.log('songs.js loaded');

// Optional per-song fields (all safe to leave out):
//   bpm:          song tempo -> the background pulses on the beat
//   beatOffset:   ms until the first beat (default 0)
//   previewStart: second where the song-select preview starts (default 15)
//   preview:      set to false to disable the preview for that song
//   volume:       music loudness for this song (default 1; 1.2 = 20% louder; above 1 uses a gain node)
//   fx:           gameplay effect that replaces the sakura petals: 'moon' or 'sparkler' (registered in SONG_FX in game.js)
//   theme:        'crimson' | 'white' -> petals, lights, hit effects, track and atmosphere turn crimson red (notes change only from 100 combo; see THEMES in game.js)
//   petalText:    a word that flies around like the sakura petals, instead of petals (e.g. 'oaoeeee')
//   team:         'dream' | 'love' | 'passion' -> only that team's cards are equipped
//                 (leave it out, or use null, to allow every member's cards)
window.SONGS = [
  {
    id: 'ayo_senyumlah',
    title: 'Ayo Senyumlah',
    artist: 'JKT48',
    team: null,
    audio: 'music/ayo_senyumlah.ogg',
    chart: 'charts/ayo_senyumlah.js',
    cover: 'images/ayo_senyumlah.webp'
  },
  {
    id: 'wakaka_people',
    title: 'WAKAKA People',
    artist: 'JKT48 Team Dream',
    team: 'dream',
    audio: 'music/wakaka_people.ogg',
    chart: 'charts/wakaka_people.js',
    cover: 'images/wakaka_people.webp'
  },
    {
    id: '12_seconds',
    title: '12 Seconds',
    artist: 'JKT48 Team Love',
    team: 'love',
    audio: 'music/12_seconds.ogg',
    chart: 'charts/12_seconds.js',
    cover: 'images/12_seconds.webp'
  },
    {
    id: 'dekat_namun_jauh',
    title: 'Dekat Namun Jauh',
    artist: 'JKT48 Team Passion',
    team: 'passion',
    audio: 'music/dekat_namun_jauh.ogg',
    chart: 'charts/dekat_namun_jauh.js',
    cover: 'images/dekat_namun_jauh.webp'
  },
  {
    id: 'andai_ku_bukan_idola',
  title: 'Andai \'Ku Bukan Idola',
  artist: 'JKT48',
  team: null,
  only: ['fiony', 'christy', 'olla', 'freya', 'gita', 'gracie', 'greesel', 'jessi', 'kathrina', 'marsha', 'michie', 'muthe'],
  audio: 'music/andai_ku_bukan_idola.ogg',
  chart: 'charts/andai_ku_bukan_idola.js',
  cover: 'images/andai_ku_bukan_idola.webp'
  },
    {
    id: 'beginners_gamble',
    title: 'Beginner\'s Gamble',
    artist: 'JKT48',
    team: null,
    only: ['christy', 'lia', 'fiony', 'freya', 'gita', 'gracie', 'greesel', 'jessi', 'marsha', 'michie', 'muthe', 'kathrina'],
    audio: 'music/beginners_gamble.ogg',
    chart: 'charts/beginners_gamble.js',
    cover: 'images/pertaruhan_cinta.webp'
  },
    {
    id: 'raja_hati',
    title: 'Raja Hati',
    artist: 'JKT48',
    team: null,
    only: ['christy', 'lia', 'fiony', 'freya', 'gita', 'gracie', 'greesel', 'jessi', 'marsha', 'michie', 'muthe', 'kathrina'],
    audio: 'music/raja_hati.ogg',
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
    fx: 'sparkler',
    audio: 'music/percik_kecil.ogg',
    chart: 'charts/percik_kecil.js',
    cover: 'images/percik_kecil.webp'
  },
    {
    id: 'oh_my_pumpkin',
    title: 'Oh my pumpkin!',
    artist: 'JKT48',
    team: null,
    audio: 'music/oh_my_pumpkin.ogg',
    chart: 'charts/oh_my_pumpkin.js',
    cover: 'images/oh_my_pumpkin.webp'
  },
    {
    id: 'go_and_fight',
    title: 'GO AND FIGHT!',
    artist: 'JKT48',
    team: null,
    only: ['michie', 'lia', 'lana', 'elin', 'fritzy', 'ella', 'gracie', 'greesel', 'lyn', 'christy', 'fiony', 'freya'],
    audio: 'music/go_and_fight.ogg',
    chart: 'charts/go_and_fight.js',
    cover: 'images/go_and_fight.webp'
  },
    {
    id: 'bibir_yang_telah_dicuri',
    title: 'Bibir yang Telah Dicuri',
    artist: 'JKT48',
    team: null,
    only: ['indah', 'olla', 'lana', 'gracie', 'erine', 'kathrina', 'greesel', 'eli', 'ella', 'delynn'],
    audio: 'music/bibir_yang_telah_dicuri.ogg',
    chart: 'charts/bibir_yang_telah_dicuri.js',
    cover: 'images/bibir_yang_telah_dicuri.webp'
  },
    {
    id: 'kusangatsuka',
    title: '#KuSangatSuka',
    artist: 'JKT48',
    team: null,
    only: ['feni', 'christy', 'jessi', 'fiony', 'muthe', 'freya', 'gita', 'marsha', 'lia', 'lulu', 'oniel'],
    audio: 'music/kusangatsuka.ogg',
    chart: 'charts/kusangatsuka.js',
    cover: 'images/bibir_yang_telah_dicuri.webp'
  },
    {
    id: 'laptime_masa_remaja',
    title: 'LapTime Masa Remaja',
    artist: 'JKT48',
    team: null,
    audio: 'music/laptime_masa_remaja.ogg',
    chart: 'charts/laptime_masa_remaja.js',
    cover: 'images/laptime_masa_remaja.webp',
    volume: 1.3
  },
    {
    id: 'belalang_yang_membangkang',
    title: 'Belalang yang Membangkang',
    artist: 'JKT48',
    team: null,
    only: ['michie', 'anindya', 'elin', 'cynthia', 'danella', 'daisy', 'aralie', 'lana', 'erine', 'fritzy', 'lily', 'trisha', 'levi', 'nayla', 'nachia', 'oline', 'nala', 'ribka', 'kimmy'],
    audio: 'music/belalang_yang_membangkang.ogg',
    chart: 'charts/belalang_yang_membangkang.js',
    cover: 'images/belalang_yang_membangkang.webp',
    volume: 1.3
  },
    {
    id: 'magic_hour',
    title: 'Magic Hour',
    artist: 'JKT48',
    team: null,
    only: ['marsha', 'christy', 'feni', 'fiony', 'freya', 'gita', 'jessi', 'kathrina', 'muthe'],
    audio: 'music/magic_hour.ogg',
    chart: 'charts/magic_hour.js',
    cover: 'images/magic_hour.webp',
    volume: 1.8
  },
    {
    id: 'langit_biru_cinta_searah',
    title: 'Langit Biru Cinta Searah',
    artist: 'JKT48',
    team: null,
    only: ['ella', 'lulu', 'oniel', 'eli', 'greesel', 'freya'],
    guest: 'pia',
    audio: 'music/langit_biru_cinta_searah.ogg',
    chart: 'charts/langit_biru_cinta_searah.js',
    cover: 'images/langit_biru_cinta_searah.webp',
    volume: 1.3
  },
    {
    id: 'must_be_now',
    title: 'Must Be Now',
    artist: 'JKT48',
    team: null,
    audio: 'music/must_be_now.ogg',
    chart: 'charts/must_be_now.js',
    cover: 'images/must_be_now.webp'
  },
    {
    id: 'apa_yang_sang_gadis_perbuat_di_musim_panas',
    title: 'Apa yang Sang Gadis Perbuat di Musim Panas',
    artist: 'JKT48',
    team: null,
    audio: 'music/apa_yang_sang_gadis_perbuat_di_musim_panas.ogg',
    chart: 'charts/apa_yang_sang_gadis_perbuat_di_musim_panas.js',
    cover: 'images/must_be_now.webp'
  },
    {
    id: 'jiwaru_days',
    title: 'Jiwaru Days',
    artist: 'JKT48',
    team: null,
    audio: 'music/jiwaru_days.ogg',
    chart: 'charts/jiwaru_days.js',
    cover: 'images/jiwaru_days.webp'
  },
    {
    id: 'green_flash',
    title: 'Green Flash',
    artist: 'JKT48',
    team: null,
    audio: 'music/green_flash.ogg',
    chart: 'charts/green_flash.js',
    cover: 'images/jiwaru_days.webp'
  },
    {
    id: 'better',
    title: 'Better',
    artist: 'JKT48',
    team: null,
    audio: 'music/better.ogg',
    chart: 'charts/better.js',
    cover: 'images/jiwaru_days.webp'
  },
    {
    id: 'seventeen',
    title: 'Seventeen',
    artist: 'JKT48',
    team: null,
    audio: 'music/seventeen.ogg',
    chart: 'charts/seventeen.js',
    cover: 'images/jiwaru_days.webp'
  },
    {
    id: 'aitakatta',
    title: 'Aitakatta',
    artist: 'JKT48',
    team: null,
    audio: 'music/aitakatta.ogg',
    chart: 'charts/aitakatta.js',
    cover: 'images/jiwaru_days.webp'
  },
    {
    id: 'sayonara_crawl',
    title: 'Sayonara Crawl',
    artist: 'JKT48',
    team: null,
    only: ['christy', 'feni', 'fiony', 'gita', 'eli', 'indah', 'kathrina', 'marsha', 'muthe'],
    audio: 'music/sayonara_crawl.ogg',
    chart: 'charts/sayonara_crawl.js',
    cover: 'images/sayonara_crawl.webp'
  },
    {
    id: 'kebun_binatang_saat_hujan',
    title: 'Kebun Binatang Saat Hujan',
    artist: 'JKT48',
    team: null,
    only: ['christy', 'freya', 'ella', 'gita', 'marsha'],
    audio: 'music/kebun_binatang_saat_hujan.ogg',
    chart: 'charts/kebun_binatang_saat_hujan.js',
    cover: 'images/kebun_binatang_saat_hujan.webp'
  },
    {
    id: 'Ponytail_dan_Shu-Shu',
    title: 'Ponytail dan Shu-Shu',
    artist: 'JKT48',
    team: null,
    audio: 'music/ponytail_dan_shu_shu.ogg',
    chart: 'charts/ponytail_dan_shu_shu.js',
    cover: 'images/ponytail_dan_shu_shu.webp',
    volume: 1.5
  },
    {
    id: 'masa_depan_yang_menyilaukan_mata',
    title: 'Masa Depan yang Menyilaukan Mata',
    artist: 'JKT48',
    team: null,
    only: ['ella', 'lia', 'lyn', 'raisha', 'greesel', 'gracie', 'anindya', 'elin', 'cynthia', 'danella', 'daisy', 'michie'],
    audio: 'music/masa_depan_yang_menyilaukan_mata.ogg',
    chart: 'charts/masa_depan_yang_menyilaukan_mata.js',
    cover: 'images/masa_depan_yang_menyilaukan_mata.webp'
  },
    {
    id: 'benang_sari_putik_dan_kupu_kupu_malam',
    title: 'Benang Sari, Putik, dan Kupu Kupu Malam',
    artist: 'JKT48',
    team: null,
    only: ['marsha', 'greesel', 'muthe', 'kathrina', 'freya'],
    fx: 'moon',
    audio: 'music/benang_sari_putik_dan_kupu_kupu_malam.ogg',
    chart: 'charts/benang_sari_putik_dan_kupu_kupu_malam.js',
    cover: 'images/new_era.webp'
  },
    {
    id: 'dialog_dengan_kenari',
    title: 'Dialog dengan Kenari',
    artist: 'JKT48',
    team: null,
    audio: 'music/dialog_dengan_kenari.ogg',
    chart: 'charts/dialog_dengan_kenari.js',
    cover: 'images/new_era.webp'
  },
    {
    id: 'only_today',
    title: 'Only Today (New Era Version)',
    artist: 'JKT48',
    team: null,
    petalText: 'oaoeeee',
    audio: 'music/only_today.ogg',
    chart: 'charts/only_today.js',
    cover: 'images/new_era.webp'
  },
    {
    id: '109_marukyuu',
    title: '109 Marukyuu',
    artist: 'JKT48',
    team: null,
    audio: 'music/109_marukyuu.ogg',
    chart: 'charts/109_marukyuu.js',
    cover: 'images/new_era.webp'
  },
    {
    id: 'flying_high',
    title: 'Flying High',
    artist: 'JKT48',
    team: null,
    audio: 'music/flying_high.ogg',
    chart: 'charts/flying_high.js',
    cover: 'images/flying_high.webp'
  },
    {
    id: 'cara_ceroboh_untuk_mencinta',
    title: 'Cara Ceroboh Untuk Mencinta',
    artist: 'JKT48',
    team: null,
    theme: 'crimson',
    audio: 'music/cara_ceroboh_untuk_mencinta.ogg',
    chart: 'charts/cara_ceroboh_untuk_mencinta.js',
    cover: 'images/cara_ceroboh_untuk_mencinta.webp'
  },
    {
    id: 'balerina_dalam_sepi',
    title: 'Balerina dalam Sepi',
    artist: 'JKT48',
    team: null,
    guest: 'tasya',
    theme: 'white',
    audio: 'music/balerina_dalam_sepi.ogg',
    chart: 'charts/balerina_dalam_sepi.js',
    cover: 'images/ramune.webp'
  }
];