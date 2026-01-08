/**
 * @file raceNames.ts
 * Provides collections of names and surnames for various fantasy races.
 * Data is sourced from standard D&D 5e sets to ensure lore consistency.
 */
export const RACE_NAMES: Record<string, { male: string[], female: string[], surnames: string[] }> = {
  /**
   * Dwarven names typically feature hard consonants and focus on clan heritage.
   */
  dwarf: {
    male: ['Adrik', 'Baern', 'Brottor', 'Dain', 'Eberk', 'Fargrim', 'Gardain', 'Harbek', 'Kildrak', 'Morgran', 'Orsik', 'Rangrim', 'Thoradin', 'Thorin', 'Tordek', 'Travok', 'Ulfgar', 'Veit', 'Vondal'],
    female: ['Amber', 'Artin', 'Audhild', 'Bardryn', 'Dagnal', 'Diesa', 'Eldeth', 'Falkrunn', 'Finellen', 'Gunnloda', 'Gurdis', 'Helja', 'Hlin', 'Kathra', 'Kristryd', 'Ilde', 'Liftrasa', 'Mardred', 'Riswynn', 'Sannl', 'Torbera', 'Torgga', 'Vistra'],
    surnames: ['Balderk', 'Battlehammer', 'Brawnanvil', 'Dankil', 'Fireforge', 'Frostbeard', 'Gorunn', 'Holderhek', 'Ironfist', 'Loderr', 'Lutgehr', 'Rumnaheim', 'Strakeln', 'Torunn', 'Ungart']
  },
  /**
   * Elven names are melodic and often flow between vowels.
   */
  elf: {
    male: ['Adran', 'Aelar', 'Aramil', 'Arannis', 'Aust', 'Beiro', 'Berrian', 'Carric', 'Enialis', 'Erdan', 'Erevan', 'Galinndan', 'Hadarai', 'Heian', 'Himo', 'Immeral', 'Ivellios', 'Laucian', 'Mindartis', 'Paelias', 'Peren', 'Quarion', 'Riardon', 'Rolen', 'Soveliss', 'Thamior', 'Tharivol', 'Theren', 'Varis'],
    female: ['Adrie', 'Althaea', 'Anastrianna', 'Andraste', 'Antinua', 'Bethrynna', 'Birel', 'Caelynn', 'Drusilia', 'Enna', 'Felosial', 'Ielenia', 'Jelenneth', 'Keyleth', 'Leshanna', 'Lia', 'Meriele', 'Mialee', 'Naivara', 'Quelenna', 'Quillathe', 'Sariel', 'Shanairra', 'Shava', 'Silaqui', 'Theirastra', 'Thia', 'Vadania', 'Valanthe', 'Xanaphia'],
    surnames: ['Amakiir', 'Amastacia', 'Galanodel', 'Holimion', 'Ilphelkiir', 'Liadon', 'Meliamne', 'Naïlo', 'Siannodel', 'Xiloscient']
  },
  /**
   * Human names are diverse, representing the wide array of cultures in Aralia.
   */
  human: {
    male: ['Alden', 'Bram', 'Cederic', 'Darian', 'Eldrin', 'Faelan', 'Gareth', 'Hollis', 'Ivor', 'Jareth', 'Anton', 'Dero', 'Marcon', 'Perrin', 'Regdar'],
    female: ['Adela', 'Brea', 'Caelia', 'Dara', 'Elara', 'Fianna', 'Gwyn', 'Hana', 'Isolde', 'Jessa', 'Kethra', 'Mara', 'Olma', 'Sana', 'Valeri'],
    surnames: ['Ashford', 'Blackwood', 'Crane', 'Dunne', 'Eldridge', 'Frost', 'Glover', 'Hawthorne', 'Ironwood', 'Jorvik', 'Miller', 'Smith', 'Tanner', 'Wright']
  },
  /**
   * Halfling names often sound cozy or playful.
   */
  halfling: {
    male: ['Alton', 'Ander', 'Cade', 'Corrin', 'Eldon', 'Errich', 'Finnan', 'Garret', 'Lindal', 'Lyle', 'Merric', 'Milo', 'Osborn', 'Perrin', 'Reed', 'Roscoe', 'Wellby'],
    female: ['Andry', 'Bree', 'Callie', 'Cora', 'Euphemia', 'Jillian', 'Kithri', 'Lavinia', 'Lidda', 'Merla', 'Nedda', 'Paela', 'Portia', 'Seraphina', 'Shaena', 'Trym', 'Vani', 'Verna'],
    surnames: ['Brushgather', 'Goodbarrel', 'Greenbottle', 'High-hill', 'Hilltopple', 'Leagallow', 'Tealeaf', 'Thorngage', 'Tosscobble', 'Underbough']
  },
  /**
   * Tiefling names can be virtue-based or derived from infernal roots.
   */
  tiefling: {
    male: ['Akmenos', 'Amnon', 'Barakas', 'Damakos', 'Ekemon', 'Iados', 'Kairon', 'Leucis', 'Melech', 'Mordai', 'Morthos', 'Pelaios', 'Skamos', 'Therai'],
    female: ['Akta', 'Anakis', 'Bryseis', 'Criella', 'Damaia', 'Ea', 'Kallista', 'Lerissa', 'Makaria', 'Nemeia', 'Orianna', 'Phelaia', 'Rieta'],
    surnames: ['Art', 'Carrion', 'Chant', 'Creed', 'Despair', 'Excellence', 'Fear', 'Glory', 'Hope', 'Ideal', 'Music', 'Nowhere', 'Open', 'Poetry', 'Quest', 'Random', 'Reverence', 'Sorrow', 'Temerity', 'Torment', 'Weary']
  }
};
