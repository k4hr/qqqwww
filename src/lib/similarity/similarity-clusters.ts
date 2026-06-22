export type SimilarityClusterKind = "franchise" | "theme" | "source" | "tone";

export type SimilarityCluster = {
  id: string;
  label: string;
  kind: SimilarityClusterKind;
  weight: number;
  keywords: string[];
  negativeBroadGenres?: string[];
};

export const FRANCHISE_CLUSTERS: SimilarityCluster[] = [
  {
    id: "mcu",
    label: "Marvel / MCU",
    kind: "franchise",
    weight: 1250,
    keywords: [
      "marvel", "марвел", "mcu", "avengers", "мстители", "infinity war", "endgame", "эра альтрона", "age of ultron",
      "iron man", "железный человек", "tony stark", "тони старк", "captain america", "капитан америка", "первый мститель",
      "thor", "тор", "hulk", "халк", "black widow", "черная вдова", "doctor strange", "доктор стрэндж", "strange",
      "guardians of the galaxy", "стражи галактики", "star lord", "peter quill", "thanos", "танос", "black panther", "черная пантера",
      "captain marvel", "капитан марвел", "loki", "локи", "wanda", "ванда", "vision", "вижн", "ant-man", "человек-муравей",
      "spider-man", "spiderman", "человек-паук", "no way home", "нет пути домой", "venom", "веном",
    ],
  },
  {
    id: "dc",
    label: "DC / Лига справедливости",
    kind: "franchise",
    weight: 1100,
    keywords: [
      "dc", "batman", "бэтмен", "бетмен", "superman", "супермен", "wonder woman", "чудо-женщина", "aquaman", "аквамен",
      "justice league", "лига справедливости", "joker", "джокер", "harley quinn", "харли квинн", "flash", "флэш", "man of steel", "человек из стали",
      "suicide squad", "отряд самоубийц", "shazam", "шазам",
    ],
  },
  {
    id: "harry_potter",
    label: "Гарри Поттер / Волшебный мир",
    kind: "franchise",
    weight: 1250,
    keywords: ["harry potter", "гарри поттер", "hogwarts", "хогвартс", "wizarding world", "волшебный мир", "fantastic beasts", "фантастические твари", "дumbledore", "дамблдор", "volan", "волан-де-морт", "волдеморт"],
  },
  {
    id: "lotr",
    label: "Властелин колец / Хоббит",
    kind: "franchise",
    weight: 1250,
    keywords: ["lord of the rings", "властелин колец", "hobbit", "хоббит", "middle-earth", "средизем", "frodo", "фродо", "gandalf", "гэндальф", "кольцо всевластия"],
  },
  {
    id: "star_wars",
    label: "Звёздные войны",
    kind: "franchise",
    weight: 1250,
    keywords: ["star wars", "звездные войны", "джедай", "jedi", "sith", "ситх", "skywalker", "скайуокер", "мандалор", "mandalorian", "дарт вейдер", "darth vader"],
  },
  {
    id: "fast_furious",
    label: "Форсаж",
    kind: "franchise",
    weight: 1150,
    keywords: ["fast furious", "fast and furious", "форсаж", "dominic toretto", "доминик торетто", "toretto", "торетто", "street racing", "уличные гонки"],
  },
  {
    id: "pirates_caribbean",
    label: "Пираты Карибского моря",
    kind: "franchise",
    weight: 1150,
    keywords: ["pirates of the caribbean", "пираты карибского моря", "jack sparrow", "джек воробей", "капитан воробей", "black pearl", "черная жемчужина"],
  },
  {
    id: "jurassic",
    label: "Парк Юрского периода / Мир Юрского периода",
    kind: "franchise",
    weight: 1100,
    keywords: ["jurassic", "парк юрского периода", "мир юрского периода", "динозавр", "динозавры", "dinosaur", "dino"],
  },
  {
    id: "mission_impossible",
    label: "Миссия невыполнима",
    kind: "franchise",
    weight: 1100,
    keywords: ["mission impossible", "миссия невыполнима", "ethan hunt", "итан хант", "imf агент"],
  },
  {
    id: "james_bond",
    label: "Джеймс Бонд / 007",
    kind: "franchise",
    weight: 1100,
    keywords: ["james bond", "джеймс бонд", "007", "агент 007", "casino royale", "казино рояль", "spectre", "спектр"],
  },
  {
    id: "terminator",
    label: "Терминатор",
    kind: "franchise",
    weight: 1050,
    keywords: ["terminator", "терминатор", "skynet", "скайнет", "sarah connor", "сара коннор", "john connor", "джон коннор"],
  },
  {
    id: "avatar",
    label: "Аватар / Пандора",
    kind: "franchise",
    weight: 1050,
    keywords: ["avatar", "аватар", "pandora", "пандора", "na'vi", "нави", "way of water", "путь воды"],
  },
  {
    id: "x_men",
    label: "Люди Икс",
    kind: "franchise",
    weight: 1050,
    keywords: ["x-men", "x men", "люди икс", "wolverine", "росомаха", "logan", "логан", "deadpool", "дэдпул", "магнето", "magneto", "professor x"],
  },
  {
    id: "indiana_jones",
    label: "Индиана Джонс",
    kind: "franchise",
    weight: 1100,
    keywords: ["indiana jones", "индиана джонс", "lost ark", "ковчег", "last crusade", "последний крестовый поход", "crystal skull", "хрустальный череп"],
  },
  {
    id: "tomb_raider",
    label: "Tomb Raider / Лара Крофт",
    kind: "franchise",
    weight: 1100,
    keywords: ["tomb raider", "lara croft", "лара крофт", "расхитительница гробниц", "раcхитительница гробниц"],
  },
  {
    id: "uncharted",
    label: "Uncharted / Нейтан Дрейк",
    kind: "franchise",
    weight: 1100,
    keywords: ["uncharted", "анчартед", "nathan drake", "нейтан дрейк", "sully", "салли"],
  },
  {
    id: "national_treasure",
    label: "Сокровище нации",
    kind: "franchise",
    weight: 1000,
    keywords: ["national treasure", "сокровище нации", "книга тайн", "book of secrets"],
  },
  {
    id: "mummy",
    label: "Мумия",
    kind: "franchise",
    weight: 1000,
    keywords: ["the mummy", "мумия", "mummy returns", "мумия возвращается", "египетская гробница", "scarab", "скарабей"],
  },
  {
    id: "jumanji",
    label: "Джуманджи",
    kind: "franchise",
    weight: 1000,
    keywords: ["jumanji", "джуманджи"],
  },
];

export const THEME_CLUSTERS: SimilarityCluster[] = [
  {
    id: "superhero_comic",
    label: "супергерои / комиксы",
    kind: "theme",
    weight: 650,
    keywords: ["супергер", "superhero", "комикс", "comic", "герой в маске", "сверхспособ", "mutant", "мутант", "спасает мир", "злодей", "villain"],
    negativeBroadGenres: ["фантастика", "боевик", "приключения"],
  },
  {
    id: "superhero_team",
    label: "командная супергероика",
    kind: "theme",
    weight: 780,
    keywords: ["команда супергер", "team of heroes", "отряд героев", "мстители", "лига справедливости", "стражи галактики", "team-up", "собирает команду"],
  },
  {
    id: "treasure_hunt",
    label: "охота за сокровищами и артефактами",
    kind: "theme",
    weight: 900,
    keywords: ["сокровищ", "treasure", "клад", "artifact", "артефакт", "древн", "гробниц", "tomb", "карта", "map", "затерянный город", "lost city", "экспедиция", "археолог", "adventurer", "авантюрист"],
    negativeBroadGenres: ["боевик", "приключения"],
  },
  {
    id: "adventure_quest",
    label: "приключенческий квест по миру",
    kind: "theme",
    weight: 620,
    keywords: ["путешествие", "journey", "quest", "квест", "загадк", "тайн", "секрет", "следы", "ключ", "погоня", "джунгли", "остров", "храм", "пещер"],
  },
  {
    id: "video_game_adaptation",
    label: "экранизация видеоигры",
    kind: "source",
    weight: 650,
    keywords: ["по мотивам видеоигры", "video game", "видеоигр", "game adaptation", "based on the game", "игровой франшиз", "playstation", "nintendo", "ubisoft", "capcom", "mortal kombat", "resident evil", "prince of persia", "персидский принц", "sonic", "соник"],
  },
  {
    id: "magic_school",
    label: "магическая школа и волшебники",
    kind: "theme",
    weight: 850,
    keywords: ["магическая школа", "школа магии", "волшебник", "wizard", "маг", "заклинан", "колдов", "ведьм", "хогвартс", "wizard school"],
  },
  {
    id: "epic_fantasy",
    label: "эпическое фэнтези",
    kind: "theme",
    weight: 760,
    keywords: ["фэнтези", "fantasy", "королевство", "kingdom", "дракон", "dragon", "эльф", "гном", "магия", "меч", "пророчество", "темный властелин"],
  },
  {
    id: "space_opera",
    label: "космическая опера",
    kind: "theme",
    weight: 720,
    keywords: ["галактика", "galaxy", "космическая империя", "space opera", "звездный флот", "starfleet", "джедай", "космическая война", "планеты"],
  },
  {
    id: "alien_invasion",
    label: "инопланетное вторжение",
    kind: "theme",
    weight: 650,
    keywords: ["инопланет", "alien", "пришелец", "вторжение", "invasion", "нло", "ufo", "угроза из космоса"],
  },
  {
    id: "time_travel",
    label: "путешествия во времени",
    kind: "theme",
    weight: 700,
    keywords: ["путешествие во времени", "time travel", "машина времени", "петля времени", "временная петля", "из будущего", "прошлое изменить"],
  },
  {
    id: "zombie_apocalypse",
    label: "зомби-апокалипсис",
    kind: "theme",
    weight: 760,
    keywords: ["зомби", "zombie", "ходячие мертвецы", "walking dead", "мертвец", "инфицированные", "вирус превращает"],
  },
  {
    id: "postapocalypse",
    label: "постапокалипсис",
    kind: "theme",
    weight: 650,
    keywords: ["постапокалип", "после конца света", "выживание после", "пустош", "wasteland", "конец света", "apocalypse", "после катастрофы"],
  },
  {
    id: "heist",
    label: "ограбление / афера",
    kind: "theme",
    weight: 680,
    keywords: ["ограб", "heist", "афера", "мошенник", "план ограбления", "банк", "кража", "украсть", "команда преступников"],
  },
  {
    id: "spy_action",
    label: "шпионский экшен",
    kind: "theme",
    weight: 620,
    keywords: ["шпион", "spy", "агент", "секретная служба", "спецслужб", "разведка", "миссия", "операция", "террорист"],
  },
  {
    id: "street_racing",
    label: "гонки и автомобили",
    kind: "theme",
    weight: 700,
    keywords: ["гонки", "racing", "уличные гонки", "street race", "тачки", "автомобил", "дрифт", "водитель", "гоночный"],
  },
  {
    id: "detective_mystery",
    label: "детективное расследование",
    kind: "theme",
    weight: 620,
    keywords: ["детектив", "расслед", "убийство", "murder", "следователь", "тайна", "загадочное преступление", "улики", "подозреваем"],
  },
  {
    id: "possession_horror",
    label: "одержимость / демоны",
    kind: "theme",
    weight: 720,
    keywords: ["одержим", "демон", "exorcism", "экзорц", "дьявол", "проклятие", "сверхъестественный ужас", "паранорм"],
  },
  {
    id: "slasher",
    label: "маньяк / слэшер",
    kind: "theme",
    weight: 680,
    keywords: ["маньяк", "серийный убийца", "slasher", "убийца в маске", "резня", "жертвы", "преследует подростков"],
  },
  {
    id: "survival_disaster",
    label: "выживание / катастрофа",
    kind: "theme",
    weight: 620,
    keywords: ["выжить", "выживание", "survival", "катастрофа", "disaster", "землетрясение", "цунами", "авария", "самолет", "кораблекрушение"],
  },
  {
    id: "romantic_comedy",
    label: "романтическая комедия",
    kind: "theme",
    weight: 580,
    keywords: ["романтическая комедия", "romantic comedy", "romcom", "любовь", "отношения", "свидание", "свадьба", "влюбляется"],
  },
  {
    id: "family_animation",
    label: "семейная анимация",
    kind: "theme",
    weight: 650,
    keywords: ["мультфильм", "animation", "animated", "семейный", "family", "дети", "волшебное приключение", "говорящие животные"],
  },
  {
    id: "sports_drama",
    label: "спортивная драма",
    kind: "theme",
    weight: 580,
    keywords: ["спорт", "чемпион", "турнир", "тренер", "команда", "боксер", "футбол", "баскетбол", "гонщик", "соревнование"],
  },
];

export const ALL_SIMILARITY_CLUSTERS = [...FRANCHISE_CLUSTERS, ...THEME_CLUSTERS];

export const CLUSTER_BY_ID = new Map(ALL_SIMILARITY_CLUSTERS.map((cluster) => [cluster.id, cluster]));

export const BROAD_GENRE_WORDS = new Set([
  "боевик", "action", "фантастика", "sci-fi", "science fiction", "приключения", "adventure", "триллер", "thriller",
  "драма", "drama", "комедия", "comedy", "фэнтези", "fantasy",
]);
