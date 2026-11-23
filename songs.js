console.log('songs.js loaded');

// Optional per-song fields (all safe to leave out):
//   bpm:          song tempo -> the background pulses on the beat
//   beatOffset:   ms until the first beat (default 0)
//   previewStart: second where the song-select preview starts (default 15)
//   preview:      set to false to disable the preview for that song
//   volume:       music loudness for this song (default 1; 1.2 = 20% louder; above 1 uses a gain node)
//   fx:           gameplay effect that replaces the sakura petals: 'moon', 'sparkler', 'lightning' or 'meteors' (background meteor showers) (registered in SONG_FX in game.js)
//   theme:        'crimson' | 'white' | 'popfight' | 'blackwhite' -> petals, lights, hit effects, track and atmosphere turn crimson red (notes change only from 100 combo; see THEMES in game.js)
//                 'blackwhite': left two lanes = soft white notes, right two lanes = soft black notes, white + black petals, no colour changes at any combo
//   petalText:    a word that flies around like the sakura petals, instead of petals (e.g. 'oaoeeee')
//   team:         'dream' | 'love' | 'passion' -> only that team's cards are equipped
//                 (leave it out, or use null, to allow every member's cards)
//   petalFruit:   true -> fruits fly around instead of petals; glow from 50 combo, all turn into avocados at 100, avocados glow from 200
//   petalChoco:   true -> chocolate bars fly around instead of petals; no colour change, just more of them from 100 and 200 combo
//   petalNotes:   true -> musical notes fly around instead of petals, with the same colour changes as the petals
//   petalSpell:   true -> orange wand-spell sparkles twinkle in the background instead of petals, more at 100 and 200 combo (Magic Hour)
//   petalSakura:  true -> bright pink sakura petals (no colour change, no glow; more of them as the combo grows)
//   coldMist:     true -> from 100 combo the stage turns subtly cold (Magic Hour)
//   petalIndo:    true -> the Indonesian flag and a skull emoji fly around instead of petals (no colour change; glow from 100 combo, more from 200)
//   petalRoach:   true -> cockroaches fly around instead of petals (no colour change, no glow; more from 100 and 200 combo)
//   mascot:       'grasshopper' -> a giant grasshopper waves its arms in the top right corner of the screen
//   slots:        how many cards are equipped for this song (1-12, default 12). The highest-tier owned cards fill them.
//   duet:         true -> the equipped card bar says "DUET WITH <guest>" instead of "ALL MEMBERS WITH <guest>"
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
    id: 'jurus_rahasia_teleport_revoice',
    title: 'Jurus Rahasia Teleport',
    artist: 'JKT48 REVOICE',
    team: null,
    only: ['aralie', 'oniel', 'cynthia', 'freya', 'ella'],
    audio: 'music/jurus_rahasia_teleport_revoice.ogg',
    chart: 'charts/jurus_rahasia_teleport_revoice.js',
    cover: 'images/jurus_rahasia_teleport_revoice.webp'
  },
    {
    id: 'refrain_penuh_harapan_revoice',
    title: 'Refrain Penuh Harapan',
    artist: 'JKT48 REVOICE',
    team: null,
    only: ['greesel', 'eli', 'lyn', 'lulu'],
    audio: 'music/refrain_penuh_harapan_revoice.ogg',
    chart: 'charts/refrain_penuh_harapan_revoice.js',
    cover: 'images/refrain_penuh_harapan_revoice.webp'
  },
    {
    id: 'seesaw_game_penuh_air_mata_revoice',
    title: 'Seesaw Game Penuh Air Mata',
    artist: 'JKT48 REVOICE',
    team: null,
    only: ['lulu', 'oniel', 'freya', 'eli'],
    audio: 'music/seesaw_game_penuh_air_mata_revoice.ogg',
    chart: 'charts/seesaw_game_penuh_air_mata_revoice.js',
    cover: 'images/seesaw_game_penuh_air_mata_revoice.webp'
  },
    {
    id: 'kamulah_yang_memberi_tahu_aku',
    title: 'Kamulah yang Memberitahu Aku',
    artist: 'JKT48 REVOICE',
    team: null,
    only: ['cynthia', 'freya', 'lyn', 'nachia'],
    audio: 'music/kamulah_yang_memberi_tahu_aku_revoice.ogg',
    chart: 'charts/kamulah_yang_memberi_tahu_aku_revoice.js',
    cover: 'images/kamulah_yang_memberi_tahu_aku_revoice.webp'
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
    theme: 'popfight',
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
    petalSpell: true,    // orange sparkles twinkle in the background instead of petals
    coldMist: true,      // 100 combo: subtle cold atmosphere (200 combo: a little colder)
    cover: 'images/magic_hour.webp',
    volume: 2
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
    id: 'eureka_milik_kita',
    title: 'Eureka Milik Kita',
    artist: 'JKT48',
    team: null,
    guest: 'zee',
    audio: 'music/eureka_milik_kita.ogg',
    chart: 'charts/eureka_milik_kita.js',
    cover: 'images/jiwaru_days.webp'
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
    id: 'cara_meminum_ramune',
    title: 'Cara Meminum Ramune',
    artist: 'JKT48',
    team: null,
    audio: 'music/cara_meminum_ramune.ogg',
    chart: 'charts/cara_meminum_ramune.js',
    cover: 'images/ramune.webp'
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
  },
    {
    id: 'burung_unta_si_pembohong',
    title: 'Burung Unta si Pembohong',
    artist: 'JKT48',
    team: null,
    slots: 4,
    audio: 'music/burung_unta_si_pembohong.ogg',
    chart: 'charts/burung_unta_si_pembohong.js',
    cover: 'images/ramune.webp'
  },
    {
    id: 'finland_miracle',
    title: 'Finland Miracle',
    artist: 'JKT48',
    team: null,
    slots: 3,
    audio: 'music/finland_miracle.ogg',
    chart: 'charts/finland_miracle.js',
    cover: 'images/ramune.webp'
  },
  {
    id: 'rapsodi',
    title: 'Rapsodi',
    artist: 'JKT48',
    team: null,
    guest: 'shani',
    theme: 'white',
    audio: 'music/rapsodi.ogg',
    chart: 'charts/rapsodi.js',
    cover: 'images/rapsodi.webp'
  },
    {
    id: 'menanti',
    title: 'Menanti',
    artist: 'JKT48',
    team: null,
    slots: 2,
    duet: true,
    guest: 'shani',
    audio: 'music/menanti.ogg',
    chart: 'charts/menanti.js',
    cover: 'images/rapsodi.webp'
  },
    {
    id: 'sweet___bitter',
    title: 'Sweet & Bitter',
    artist: 'JKT48',
    team: null,
    petalChoco: true,
    audio: 'music/sweet_&_bitter.ogg',
    chart: 'charts/sweet___bitter.js',
    cover: 'images/rapsodi.webp'
  },
    {
    id: 'relax',
    title: 'Relax!',
    artist: 'JKT48',
    team: null,
    slots: 3,
    audio: 'music/relax.ogg',
    chart: 'charts/relax.js',
    cover: 'images/relax.webp'
  },
    {
    id: 'bukan_alpukat',
    title: 'Bukan Alpukat...',
    artist: 'JKT48',
    team: null,
    slots: 2,
    petalFruit: true,
    audio: 'music/bukan_alpukat.ogg',
    chart: 'charts/bukan_alpukat.js',
    cover: 'images/relax.webp'
  },
   {
    id: 'fajar_sang_idola',
    title: 'Fajar Sang Idola',
    artist: 'JKT48',
    team: null,
    petalNotes: true,
    audio: 'music/fajar_sang_idola.ogg',
    chart: 'charts/fajar_sang_idola.js',
    cover: 'images/fajar_sang_idola.webp'
  },
    {
    id: 'bersama_sama_semuanya',
    title: 'Bersama-sama Semuanya',
    artist: 'JKT48',
    team: null,
    petalIndo: true,
    audio: 'music/bersama_sama_semuanya.ogg',
    chart: 'charts/bersama_sama_semuanya.js',
    cover: 'images/fajar_sang_idola.webp'
  },
    {
    id: 'sobakasu_no_kiss',
    title: 'Sobakasu no Kiss',
    artist: 'JKT48',
    team: null,
    audio: 'music/sobakasu_no_kiss.ogg',
    chart: 'charts/sobakasu_no_kiss.js',
    cover: 'images/fajar_sang_idola.webp'
  },
    {
    id: 'high_tension',
    title: 'High Tension',
    artist: 'JKT48',
    team: null,
    fx: 'lightning',
    audio: 'music/high_tension.ogg',
    chart: 'charts/high_tension.js',
    cover: 'images/high_tension.webp'
  },
    {
    id: 'kenyataan_yang_ternoda',
    title: 'Kenyataan yang Ternoda',
    artist: 'JKT48',
    team: null,
    audio: 'music/kenyataan_yang_ternoda.ogg',
    chart: 'charts/kenyataan_yang_ternoda.js',
    cover: 'images/high_tension.webp'
  },
  {
    id: 'after_rain',
    title: 'After Rain',
    artist: 'JKT48',
    team: null,
    audio: 'music/after_rain.ogg',
    chart: 'charts/after_rain.js',
    cover: 'images/high_tension.webp'
  },
    {
    id: 'musim_yang_selanjutnya',
    title: 'Musim yang Selanjutnya',
    artist: 'JKT48',
    team: null,
    audio: 'music/musim_yang_selanjutnya.ogg',
    chart: 'charts/musim_yang_selanjutnya.js',
    cover: 'images/high_tension.webp'
  },
    {
    id: 'everyday_kachuusha',
    title: 'Everyday, Kachuusha',
    artist: 'JKT48',
    team: null,
    audio: 'music/everyday_kachuusha.ogg',
    chart: 'charts/everyday_kachuusha.js',
    cover: 'images/kachuusha.webp'
  },
    {
    id: 'seesaw_game_penuh_air_mata',
    title: 'Seesaw Game Penuh Air Mata',
    artist: 'JKT48',
    team: null,
    audio: 'music/seesaw_game_penuh_air_mata.ogg',
    chart: 'charts/seesaw_game_penuh_air_mata.js',
    cover: 'images/kachuusha.webp'
  },
    {
    id: 'uza',
    title: 'UZA',
    artist: 'JKT48',
    team: null,
    audio: 'music/uza.ogg',
    chart: 'charts/uza.js',
    cover: 'images/uza.webp'
  },
    {
    id: 'saka_agari',
    title: 'Saka Agari',
    artist: 'JKT48',
    team: null,
    audio: 'music/saka_agari.ogg',
    chart: 'charts/saka_agari.js',
    cover: 'images/saka_agari.webp'
  },
    {
    id: 'balada_serangga',
    title: 'Balada Serangga',
    artist: 'JKT48',
    team: null,
    slots: 2,
    duet: true,
    guest: 'sisca',
    petalRoach: true,
    audio: 'music/balada_serangga.ogg',
    chart: 'charts/balada_serangga.js',
    cover: 'images/saka_agari.webp'
  },
    {
    id: 'to_be_continued',
    title: 'To be continued',
    artist: 'JKT48',
    team: null,
    audio: 'music/to_be_continued.ogg',
    chart: 'charts/to_be_continued.js',
    cover: 'images/saka_agari.webp'
  },
    {
    id: 'telapak_tangan',
    title: 'Telapak Tangan',
    artist: 'JKT48',
    team: null,
    guest: 'yona',
    audio: 'music/telapak_tangan.ogg',
    chart: 'charts/telapak_tangan.js',
    cover: 'images/saka_agari.webp'
  },
    {
    id: 'dirimu_melody',
    title: 'Dirimu Melody',
    artist: 'JKT48',
    team: null,
    guest: 'melody',
    audio: 'music/dirimu_melody.ogg',
    chart: 'charts/dirimu_melody.js',
    cover: 'images/dirimu_melody.webp'
  },
    {
    id: 'cinta_pertama',
    title: 'Cinta Pertama di Jam 7 Lewat 12',
    artist: 'JKT48',
    team: null,
    slots: 5,
    audio: 'music/cinta_pertama.ogg',
    chart: 'charts/cinta_pertama.js',
    cover: 'images/rkj.webp'
  },
    {
    id: 'sungai_impian',
    title: 'Sungai Impian',
    artist: 'JKT48',
    team: null,
    slots:  7,
    guest: 'haruka',
    petalSunflower: true,
    audio: 'music/sungai_impian.ogg',
    chart: 'charts/sungai_impian.js',
    cover: 'images/saikou_kayo.webp',
    volume: 1.5
  },
    {
    id: 'pesawat_kertas_365_hari',
    title: 'Pesawat Kertas 365 Hari',
    artist: 'JKT48',
    team: null,
    audio: 'music/pesawat_kertas_365_hari.ogg',
    chart: 'charts/pesawat_kertas_365_hari.js',
    petalPlane: true,   // slow gliding paper airplanes instead of petals
    cover: 'images/mahagita.webp',
    volume: 1.2
  },
    {
    id: 'persentase_meteor',
    title: 'Persentase Meteor',
    artist: 'JKT48',
    team: null,
    fx: 'meteors',      // meteor showers in the background at 50 / 100 / 200 / 300 / 400 / 480 combo
    audio: 'music/persentase_meteor.ogg',
    chart: 'charts/persentase_meteor.js',
    cover: 'images/dewi_theater.webp'
  },
    {
    id: 'arah_sang_cinta_dan_balasannya',
    title: 'Arah Sang Cinta dan Balasannya',
    artist: 'JKT48',
    team: null,
    audio: 'music/arah_sang_cinta_dan_balasannya.ogg',
    chart: 'charts/arah_sang_cinta_dan_balasannya.js',
    cover: 'images/sambil_menggandeng_erat_tanganku.webp'
  },
    {
    id: 'papan_penanda_isi_hati',
    title: 'Papan Penanda Isi Hati',
    artist: 'JKT48',
    team: null,
    audio: 'music/papan_penanda_isi_hati.ogg',
    chart: 'charts/papan_penanda_isi_hati.js',
    cover: 'images/papan_penanda_isi_hati.webp'
  },
    {
    id: 'sakura_no_hanabiratachi',
    title: 'Sakura no Hanabiratachi',
    artist: 'JKT48',
    team: null,
    petalSakura: true,  // bright pink sakura petals, no colour change, no glow, more at higher combos
    audio: 'music/sakura_no_hanabiratachi.ogg',
    chart: 'charts/sakura_no_hanabiratachi.js',
    cover: 'images/gingham_check.webp'
  },
    {
    id: 'dua_orang_yang_terlarang',
    title: 'Dua Orang yang Terlarang',
    artist: 'JKT48',
    team: null,
    slots: 2,
    audio: 'music/dua_orang_yang_terlarang.ogg',
    chart: 'charts/dua_orang_yang_terlarang.js',
    theme: 'blackwhite',   // left lanes white, right lanes black, black & white petals
    cover: 'images/seishun_girls.webp'
  },
    {
    id: 'beach_sandal',
    title: 'Beach Sandal',
    artist: 'JKT48',
    team: null,
    audio: 'music/beach_sandal.ogg',
    chart: 'charts/beach_sandal.js',
    cover: 'images/seishun_girls.webp'
  },
    {
    id: 'fortune_cookie_yang_mencinta',
    title: 'Fortune Cookie yang Mencinta',
    artist: 'JKT48',
    team: null,
    audio: 'music/fortune_cookie_yang_mencinta.ogg',
    chart: 'charts/fortune_cookie_yang_mencinta.js',
    cover: 'images/fortune_cookie_yang_mencinta.webp'
  },
    {
    id: 'baby_baby_baby',
    title: 'Baby! Baby! Baby! (Passionate Prayer Version)',
    artist: 'JKT48',
    team: null,
    audio: 'music/baby_baby_baby.ogg',
    chart: 'charts/baby_baby_baby.js',
    cover: 'images/fortune_cookie_yang_mencinta.webp'
  },
    {
    id: 'bingo',
    title: 'BINGO!',
    artist: 'JKT48',
    team: null,
    audio: 'music/bingo.ogg',
    chart: 'charts/bingo.js',
    cover: 'images/matahari_milikku.webp'
  },
    {
    id: 'himawari',
    title: 'Himawari',
    artist: 'JKT48',
    team: null,
    slots: 4,
    guest: 'vienny',
    petalSunflower: true,
    audio: 'music/himawari.ogg',
    chart: 'charts/himawari.js',
    cover: 'images/matahari_milikku.webp'
  }
];