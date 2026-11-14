/**
 * DXN Natural Life — Verified Educational Content, Default Categories, and Compliance FAQs.
 *
 * STRICT COMPLIANCE INVARIANTS:
 * 1. Dietary supplements and food/cosmetic products are NEVER described as medicines.
 * 2. Zero claims of curing, treating, preventing disease, "detoxifying/removing toxins",
 *    "cleansing blood", or guaranteeing health outcomes.
 * 3. Every educational topic explicitly distinguishes:
 *    - Scientifically established nutritional principles
 *    - Ingredient-specific research context
 *    - Traditional / historical botanical & culinary uses
 *    - Unproven claims to avoid
 *    - Official label usage, storage, and medical consultation disclaimers
 * 4. Company & founder facts strictly reflect verifiable history (DXN founded in 1993 in
 *    Kedah, Malaysia by Datuk Dr. Lim Siow Jin; integrated cultivation, manufacturing,
 *    and direct-selling distribution) with zero fabricated statistics or awards.
 */

export interface DefaultCategorySeed {
  slug: string;
  nameAr: string;
  nameFr: string;
  descriptionAr: string;
  descriptionFr: string;
  sortOrder: number;
  isActive: boolean;
}

export const DEFAULT_PRODUCT_CATEGORIES: DefaultCategorySeed[] = [
  {
    slug: "supplements",
    nameAr: "المكملات الغذائية",
    nameFr: "Compléments alimentaires",
    descriptionAr: "مكملات غذائية ومنتجات طبيعية مخصصة لدعم النظام الغذائي المتوازن وفق إرشادات العبوة الرسمية.",
    descriptionFr: "Compléments alimentaires destinés à accompagner une alimentation équilibrée selon les indications officielles.",
    sortOrder: 1,
    isActive: true,
  },
  {
    slug: "cosmetics",
    nameAr: "الكوسميتيك",
    nameFr: "Cosmétiques & Soins",
    descriptionAr: "منتجات الكوسميتيك والعناية بالبشرة والعناية الشخصية للاستخدام الظاهري اليومي.",
    descriptionFr: "Produits cosmétiques, soins de la peau et hygiène personnelle pour un usage quotidien externe.",
    sortOrder: 2,
    isActive: true,
  },
  {
    slug: "beverages",
    nameAr: "المشروبات والقهوة",
    nameFr: "Boissons & Cafés",
    descriptionAr: "تشكيلة مشروبات ساخنة وباردة وقهوة ومشروبات كاكاو للاستمتاع اليومي.",
    descriptionFr: "Sélection de boissons chaudes et froides, cafés et boissons cacaotées pour la consommation quotidienne.",
    sortOrder: 3,
    isActive: true,
  },
  {
    slug: "general",
    nameAr: "منتجات متنوعة",
    nameFr: "Autres produits",
    descriptionAr: "منتجات DXN المتنوعة للاستخدام اليومي والمنزلي.",
    descriptionFr: "Autres produits DXN destinés à un usage quotidien.",
    sortOrder: 4,
    isActive: true,
  },
];

export const MANDATORY_HEALTH_DISCLAIMER_AR =
  "تنبيه صحي مهم: المكملات الغذائية ومنتجات DXN ليست أدوية، ولا تهدف إلى تشخيص أي مرض أو علاجه أو الشفاء منه أو الوقاية منه، ولا تغني عن النظام الغذائي المتوازن أو الاستشارة الطبية. يُنصح باستشارة الطبيب أو المختص الصحي قبل الاستخدام، خاصة للحوامل والمرضعات والأطفال ومن يعانون من حالات صحية خاصة أو يتناولون أدوية.";

export const MANDATORY_HEALTH_DISCLAIMER_FR =
  "Avertissement sanitaire important : Les compléments alimentaires et produits DXN ne sont pas des médicaments et ne visent pas à diagnostiquer, traiter, guérir ou prévenir une maladie. Ils ne remplacent pas une alimentation variée et équilibrée ni un avis médical. Consultez un professionnel de santé avant utilisation, en particulier pour les femmes enceintes ou allaitantes, les personnes suivies médicalement ou sous traitement.";

export interface EducationalArticleSeed {
  slug: string;
  category: "ganoderma" | "spirulina" | "supplements" | "nutrition" | "usage" | "faq";
  sortOrder: number;
  isPublished: boolean;
  readingMinutes: number;
  ar: {
    title: string;
    summary: string;
    scientificInfo: string;
    ingredientEvidence: string;
    traditionalUses: string;
    unprovenClaimsNotice: string;
    usageAndStorage: string;
    disclaimer: string;
  };
  fr: {
    title: string;
    summary: string;
    scientificInfo: string;
    ingredientEvidence: string;
    traditionalUses: string;
    unprovenClaimsNotice: string;
    usageAndStorage: string;
    disclaimer: string;
  };
}

export const DEFAULT_EDUCATIONAL_ARTICLES: EducationalArticleSeed[] = [
  {
    slug: "what-is-ganoderma",
    category: "ganoderma",
    sortOrder: 1,
    isPublished: true,
    readingMinutes: 5,
    ar: {
      title: "ما هو فطر الجانوديرما (الريشي)؟",
      summary: "نظرة علمية وتثقيفية متوازنة حول فطر Ganoderma lucidum ومكوناته الطبيعية وطريقة تناوله كمكمل غذائي أو مكون في المشروبات.",
      scientificInfo:
        "فطر الجانوديرما (الاسم العلمي: Ganoderma lucidum، ويُعرف أيضاً باسم الريشي) هو فطر خشبي يحتوي بطبيعته على مركبات نباتية وفطرية متنوعة، من أبرزها عديدات السكاريد (Polysaccharides) مثل البيتا-غلوكان، والتربينات الثلاثية (Triterpenoids)، والألياف الغذائية وبعض المعادن الدقيقة.",
      ingredientEvidence:
        "تناولت أبحاث مخبرية وغذائية متعددة خصائص عديدات السكاريد والتربينات الثلاثية الموجودة في فطر الجانوديرما ودورها كمكونات نشطة حيوياً قيد الدراسة العلمية المستمرة. ومع ذلك، فإن وجود هذه المركبات في المكملات الغذائية يُصنَّف ضمن الدعم الغذائي العام ولا يُعد علاجاً طبياً لأي مرض.",
      traditionalUses:
        "استُخدم فطر الريشي منذ قرون في الثقافات الآسيوية الشرقية التقليدية بوصفه فطراً غذائياً وتقليدياً يدخل في تحضير الخلاصات والمشروبات الدافئة ضمن نمط الحياة اليومي.",
      unprovenClaimsNotice:
        "يجب تجنب الادعاءات غير المثبتة علمياً مثل القول إن الجانوديرما يشفي من الأمراض المزمنة أو يعالج الأورام أو يغني عن الأدوية الموصوفة أو ينقي الدم. الاستخدام الصحيح يكون كمكمل غذائي فقط ضمن نظام حياة صحي.",
      usageAndStorage:
        "تُتبع الحصة اليومية الموضحة على عبوة المنتج الرسمي حصراً (سواء كان مسحوقاً أو كبسولات أو مشروباً مضافاً إليه مستخلص الجانوديرما)، ويُحفظ المنتج في عبوته الأصلية المحكمة بعيداً عن الرطوبة والحرارة المباشرة.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_AR,
    },
    fr: {
      title: "Qu'est-ce que le Ganoderma (Reishi) ?",
      summary: "Présentation éducative et équilibrée du champignon Ganoderma lucidum, de ses composés naturels et de sa place comme complément alimentaire.",
      scientificInfo:
        "Le Ganoderma (Ganoderma lucidum, aussi appelé Reishi) est un champignon ligneux contenant naturellement des polysaccharides (dont des bêta-glucanes), des triterpénoïdes, des fibres et des oligo-éléments.",
      ingredientEvidence:
        "Divers travaux scientifiques étudient la composition biochimique des polysaccharides et triterpénoïdes du Ganoderma. Dans le cadre d'un complément alimentaire, ces ingrédients s'inscrivent dans un apport nutritionnel complémentaire et non dans une démarche thérapeutique.",
      traditionalUses:
        "Historiquement, le Reishi est utilisé depuis des siècles dans les traditions culinaires et herboristes d'Asie de l'Est sous forme d'infusions ou d'extraits.",
      unprovenClaimsNotice:
        "Il convient d'éviter toute affirmation non prouvée présentant le Ganoderma comme un remède médical, un traitement contre des maladies graves ou un substitut aux médicaments prescrits.",
      usageAndStorage:
        "Respectez strictement la portion journalière indiquée sur l'emballage officiel du produit et conservez-le au sec, à l'abri de la chaleur et de la lumière directe.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_FR,
    },
  },
  {
    slug: "what-is-spirulina",
    category: "spirulina",
    sortOrder: 2,
    isPublished: true,
    readingMinutes: 5,
    ar: {
      title: "ما هي السبيرولينا (Spirulina)؟",
      summary: "دليل معرفي حول طحالب السبيرولينا الدقيقة وقيمتها الغذائية من البروتينات النباتية والفيتامينات والمعادن.",
      scientificInfo:
        "السبيرولينا (Arthrospira platensis) هي بكتيريا زرقاء مخضرة دقيقة (تُعرف شائعاً بالطحالب الدقيقة) تُجفف وتُقدم في صورة أقراص أو مسحوق غذائي. تتميز علمياً بمحتواها من البروتين النباتي والأحماض الأمينية، والصبغات الطبيعية مثل الفيكوسيانين والكلوروفيل والبيتا-كاروتين، إضافة إلى الحديد وبعض فيتامينات المجموعة B.",
      ingredientEvidence:
        "تُصنَّف السبيرولينا في علوم التغذية كمصدر غذائي مركز بالعناصر الدقيقة والبروتين عند زراعتها وتجفيفها وفق معايير رقابة جودة صارمة تضمن خلوها من الملوثات. وتعتمد فائدتها على كونها جزءاً مكملاً لوجبات غذائية متوازنة.",
      traditionalUses:
        "عُرفت السبيرولينا تاريخياً كمصدر غذائي تقليدي لدى بعض المجتمعات القديمة حول البحيرات القلوية في إفريقيا وأمريكا الوسطى قبل أن تُستزرع حديثاً في أحواض مخصصة خاضعة للرقابة.",
      unprovenClaimsNotice:
        "السبيرولينا ليست دواءً لعلاج فقر الدم المرضي الحاد دون إشراف طبي، ولا تُستخدم لإزالة السموم من الجسم أو علاج الأمراض المناعية. يجب على مرضى الفينيل كيتون يوريا (PKU) أو المصابين بأمراض مناعية أو من يتناولون مضادات التخثر استشارة الطبيب قبل تناولها.",
      usageAndStorage:
        "تُتناول مع كمية كافية من الماء حسب الإرشادات المدونة على الملصق الرسمي للعبوة، وتُغلق العبوة بإحكام فور الاستخدام لحمايتها من الأكسدة والرطوبة.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_AR,
    },
    fr: {
      title: "Qu'est-ce que la Spiruline ?",
      summary: "Guide informatif sur la micro-algue Arthrospira platensis et ses apports nutritionnels en protéines végétales, vitamines et minéraux.",
      scientificInfo:
        "La spiruline (Arthrospira platensis) est une cyanobactérie alimentaire riche en protéines végétales, acides aminés, pigments naturels (phycocyanine, bêta-carotène, chlorophylle), fer et vitamines.",
      ingredientEvidence:
        "En nutrition, la spiruline cultivée sous contrôle de qualité est reconnue comme un aliment concentré en nutriments destiné à compléter une alimentation variée.",
      traditionalUses:
        "Elle a été consommée traditionnellement comme ressource alimentaire locale autour de certains lacs alcalins avant le développement de l'aquaculture moderne contrôlée.",
      unprovenClaimsNotice:
        "La spiruline n'est pas un médicament, ne « détoxifie » pas l'organisme au sens médical et ne remplace aucun suivi médical. Les personnes atteintes de phénylcétonurie ou sous traitement médical doivent demander l'avis d'un médecin.",
      usageAndStorage:
        "À consommer avec un grand verre d'eau selon la dose journalière figurant sur l'étiquette officielle. Refermer soigneusement après ouverture.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_FR,
    },
  },
  {
    slug: "what-are-dietary-supplements",
    category: "supplements",
    sortOrder: 3,
    isPublished: true,
    readingMinutes: 4,
    ar: {
      title: "ما هي المكملات الغذائية وما الفرق بينها وبين الأدوية؟",
      summary: "توضيح علمي وقانوني للفرق الجوهري بين المكملات الغذائية والأدوية الطبية ومتى وكيف تُستخدم بأمان.",
      scientificInfo:
        "المكملات الغذائية هي منتجات تُؤخذ عن طريق الفم وتحتوي على مكونات غذائية (مثل الفيتامينات، المعادن، الألياف، الأحماض الأمينية، أو المستخلصات النباتية والفطرية) بهدف تكملة النظام الغذائي الاعتيادي وليس استبداله. أما الأدوية فهي مستحضرات صيدلانية تخضع لتجارب سريرية علاجية وتُرخص لتشخيص الأمراض أو علاجها أو الوقاية منها.",
      ingredientEvidence:
        "تساعد المكملات الغذائية في سد بعض الفجوات الغذائية عند الحاجة، لكن تأثيرها يرتبط بنوعية المكون وتركيزه والتزام المستهلك بالحصص الموصى بها ونمط حياته الغذائي العام.",
      traditionalUses:
        "تجمع كثير من المكملات المعاصرة بين مغذيات أساسية معروفة ومكونات نباتية استُخدمت تاريخياً في التغذية التقليدية.",
      unprovenClaimsNotice:
        "يُحظر علمياً وأخلاقياً تقديم أي مكمل غذائي كبديل عن الدواء الموصوف من الطبيب أو إيقاف العلاج الطبي استناداً إلى تناول مكمل غذائي.",
      usageAndStorage:
        "اقرأ دائماً البطاقة الغذائية على العبوة، ولا تتجاوز الحصة اليومية المحددة، واحفظ جميع المكملات بعيداً عن متناول الأطفال.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_AR,
    },
    fr: {
      title: "Que sont les compléments alimentaires et en quoi diffèrent-ils des médicaments ?",
      summary: "Distinction claire entre complément nutritionnel et médicament pharmaceutique pour une consommation responsable.",
      scientificInfo:
        "Un complément alimentaire fournit des nutriments ou substances à but nutritionnel pour compléter le régime normal. Contrairement au médicament, il n'a pas vocation à traiter ni guérir une pathologie.",
      ingredientEvidence:
        "L'intérêt d'un complément repose sur la qualité de ses ingrédients, le respect des dosages journaliers et son intégration à un mode de vie équilibré.",
      traditionalUses:
        "Certains compléments associent des micronutriments essentiels à des extraits botaniques issus d'usages alimentaires traditionnels.",
      unprovenClaimsNotice:
        "Un complément alimentaire ne doit jamais remplacer un traitement médical prescrit ni retarder une consultation médicale.",
      usageAndStorage:
        "Lisez systématiquement l'étiquette, respectez les portions recommandées et tenez hors de portée des enfants.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_FR,
    },
  },
  {
    slug: "vitamins-and-minerals",
    category: "nutrition",
    sortOrder: 4,
    isPublished: true,
    readingMinutes: 4,
    ar: {
      title: "ما هي الفيتامينات والمعادن ودورها في التغذية؟",
      summary: "مقدمة علمية مبسطة حول المغذيات الدقيقة الأساسية التي يحتاجها الجسم بكميات مدروسة يومياً.",
      scientificInfo:
        "الفيتامينات والمعادن هي مغذيات دقيقة أساسية يشارك كل منها في وظائف فسيولوجية محددة مثبتة علمياً، مثل مساهمة الحديد في تكوين الهيموغلوبين ونقل الأكسجين، ومساهمة فيتامين C في تكوين الكولاجين الطبيعي ودعم امتصاص الحديد، ودور الكالسيوم وفيتامين D في الحفاظ على صحة العظام والأسنان.",
      ingredientEvidence:
        "تحدد الهيئات الغذائية الدولية الاحتياجات اليومية المرجعية لكل فيتامين ومعدن. وتُعد الأغذية الكاملة المتنوعة (الخضروات، الفواكه، البقوليات، الحبوب الكاملة، البروتينات) المصدر الأول والأساسي لهذه المغذيات.",
      traditionalUses:
        "اعتمدت الأنظمة الغذائية التقليدية المتوازنة على تنويع مصادر الغذاء الموسمي لتأمين طيف واسع من الفيتامينات والمعادن الطبيعية.",
      unprovenClaimsNotice:
        "الإفراط في تناول جرعات عالية جداً من بعض الفيتامينات أو المعادن لا يمنح فوائد مضاعفة، بل قد يكون غير مناسب صحياً؛ لذلك فإن الاعتدال والالتزام بالحصص الموصى بها أمر أساسي.",
      usageAndStorage:
        "تُحفظ المنتجات المحتوية على فيتامينات في مكان بارد وجاف لأن بعض الفيتامينات حساسة للحرارة والضوء والرطوبة.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_AR,
    },
    fr: {
      title: "Vitamines et minéraux : quel rôle dans la nutrition ?",
      summary: "Synthèse scientifique sur les micronutriments essentiels et l'importance d'apports journaliers équilibrés.",
      scientificInfo:
        "Les vitamines et minéraux participent à des fonctions physiologiques documentées : transport de l'oxygène (fer), formation normale du collagène (vitamine C), maintien d'une ossature normale (calcium, vitamine D).",
      ingredientEvidence:
        "Une alimentation variée à base d'aliments complets demeure la source principale de micronutriments ; les compléments interviennent uniquement en appoint mesuré.",
      traditionalUses:
        "Les cuisines traditionnelles équilibrées associaient légumineuses, céréales, légumes et fruits de saison pour diversifier ces apports.",
      unprovenClaimsNotice:
        "Le surdosage en vitamines ou minéraux n'améliore pas la santé et peut présenter des risques ; respectez toujours les apports journaliers indiqués.",
      usageAndStorage:
        "Conservez à l'abri de la chaleur et de l'humidité afin de préserver la stabilité des vitamines sensibles.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_FR,
    },
  },
  {
    slug: "dietary-fiber-guide",
    category: "nutrition",
    sortOrder: 5,
    isPublished: true,
    readingMinutes: 4,
    ar: {
      title: "ما هي الألياف الغذائية وأهميتها اليومية؟",
      summary: "تعرّف على الألياف القابلة وغير القابلة للذوبان ودورها الطبيعي في النظام الغذائي اليومي وشرب الماء معها.",
      scientificInfo:
        "الألياف الغذائية هي أجزاء من الأغذية النباتية لا تهضمها إنزيمات الجهاز الهضمي البشري بالكامل، وتنقسم إلى ألياف قابلة للذوبان في الماء وألياف غير قابلة للذوبان. تسهم الألياف علمياً في دعم حركة الأمعاء الطبيعية وتعزيز الإحساس بالشبع ضمن وجبات متوازنة.",
      ingredientEvidence:
        "توجد الألياف في الحبوب الكاملة، البقوليات، الخضروات، الفواكه، البذور، وبعض الخلطات النباتية الغنية بالألياف. ويُعد شرب كميات كافية من الماء عنصراً ضرورياً عند تناول الأغذية أو المكملات الغنية بالألياف.",
      traditionalUses:
        "كانت الحبوب الكاملة والخضروات والأعشاب الورقية جزءاً أصيلاً من المائدة التقليدية في منطقة المتوسط والعالم العربي.",
      unprovenClaimsNotice:
        "منتجات الألياف ليست علاجات طبية لأمراض الجهاز الهضمي المزمنة ولا تُعد وصفات سحرية لإنقاص الوزن الفوري دون توازن غذائي ونشاط بدني.",
      usageAndStorage:
        "عند إدخال مكمل غني بالألياف إلى نظامك الغذائي، ابدأ تدريجياً حسب تعليمات العبوة مع شرب كمية وافرة من الماء، واستشر الطبيب إذا كنت تعاني من اضطرابات هضمية خاصة.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_AR,
    },
    fr: {
      title: "Les fibres alimentaires et leur importance au quotidien",
      summary: "Comprendre les fibres solubles et insolubles, leur rôle nutritionnel et l'importance d'une bonne hydratation.",
      scientificInfo:
        "Les fibres alimentaires sont des glucides d'origine végétale non digérés par les enzymes digestives humaines. Elles contribuent au transit intestinal normal et à la satiété dans le cadre d'un repas équilibré.",
      ingredientEvidence:
        "Présentes dans les céréales complètes, légumineuses, légumes, fruits et mélanges végétaux, les fibres nécessitent un apport hydrique suffisant pour agir confortablement.",
      traditionalUses:
        "Les régimes traditionnels méditerranéens et nord-africains reposent largement sur des aliments riches en fibres naturelles.",
      unprovenClaimsNotice:
        "Les produits riches en fibres ne constituent ni un traitement médical digestif ni une solution miracle d'amaigrissement.",
      usageAndStorage:
        "Introduisez progressivement selon les conseils de l'étiquette en buvant suffisamment d'eau tout au long de la journée.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_FR,
    },
  },
  {
    slug: "what-are-antioxidants",
    category: "nutrition",
    sortOrder: 6,
    isPublished: true,
    readingMinutes: 4,
    ar: {
      title: "ما هي مضادات الأكسدة في الغذاء؟",
      summary: "شرح علمي لمفهوم الأكسدة والجذور الحرة ومصادر مضادات الأكسدة الطبيعية في الغذاء المتوازن.",
      scientificInfo:
        "مضادات الأكسدة هي جزيئات تساعد في حماية الخلايا من الإجهاد التأكسدي الناتج عن الجذور الحرة التي تتكون طبيعياً أثناء عمليات الأيض أو بفعل عوامل بيئية. من أمثلتها المثبتة علمياً فيتامين C وفيتامين E والسيلينيوم، إلى جانب مركبات البوليفينول والكاروتينات الموجودة في النباتات.",
      ingredientEvidence:
        "تحتوي الفواكه الملونة، الخضروات، الكاكاو، الشاي، القهوة، وبعض الفطريات والطحالب الغذائية على مركبات بوليفينولية ومضادات أكسدة طبيعية تتفاوت نسبها حسب المصدر وطريقة التحضير.",
      traditionalUses:
        "استُخدمت المشروبات النباتية كالشاي والكاكاو والفواكه المجففة تقليدياً ضمن الضيافة والغذاء اليومي في ثقافات متعددة.",
      unprovenClaimsNotice:
        "وجود مضادات أكسدة في منتج غذائي لا يعني أنه يمنع الشيخوخة كلياً أو يعالج السرطان أو يغني عن الفحوصات والعلاجات الطبية المعتمدة.",
      usageAndStorage:
        "للحفاظ على جودة المركبات الطبيعية الحساسة للأكسدة، يُحكم إغلاق العبوة بعد كل استعمال وتُحفظ بعيداً عن أشعة الشمس المباشرة.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_AR,
    },
    fr: {
      title: "Que sont les antioxydants dans l'alimentation ?",
      summary: "Explication scientifique du stress oxydatif et des sources alimentaires naturelles d'antioxydants.",
      scientificInfo:
        "Les antioxydants (comme les vitamines C et E, le sélénium, ainsi que divers polyphénols et caroténoïdes végétaux) aident à protéger les cellules contre le stress oxydatif.",
      ingredientEvidence:
        "Les fruits, légumes, cacao, thé, café et certains extraits botaniques renferment des composés phénoliques dont la teneur dépend de l'origine et de la préparation.",
      traditionalUses:
        "Les infusions végétales, le thé et le cacao occupent une place ancienne dans les habitudes alimentaires quotidiennes.",
      unprovenClaimsNotice:
        "La présence d'antioxydants n'autorise aucune allégation de guérison ou de prévention de maladies graves comme le cancer.",
      usageAndStorage:
        "Refermez hermétiquement l'emballage après ouverture et protégez-le de la lumière directe et de la chaleur.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_FR,
    },
  },
  {
    slug: "ingredients-and-nutritional-labels",
    category: "usage",
    sortOrder: 7,
    isPublished: true,
    readingMinutes: 4,
    ar: {
      title: "كيف تقرأ المكونات والمعلومات الغذائية بوعي؟",
      summary: "خطوات عملية لفهم قائمة المكونات، الحصة الغذائية، والتحذيرات الخاصة بالحساسية على عبوات المنتجات.",
      scientificInfo:
        "تُرتب المكونات على الملصقات الغذائية عادةً تنازلياً حسب الوزن، ويوضح جدول القيم الغذائية كمية الطاقة (السعرات الحرارية)، البروتين، الكربوهيدرات، السكريات، الدهون، والألياف لكل حصة أو لكل 100 غرام.",
      ingredientEvidence:
        "تساعد قراءة قائمة المكونات بعناية على التحقق من ملاءمة المنتج لنظامك الغذائي الشخصي، وملاحظة وجود أي مسببات حساسية (مثل مشتقات الحليب أو الصويا أو المكسرات في بعض المشروبات الجاهزة).",
      traditionalUses:
        "الشفافية في معرفة مكونات الغذاء والعناية الشخصية تساعد المستهلك على اختيار ما يناسب احتياجاته اليومية بمسؤولية.",
      unprovenClaimsNotice:
        "كلمة «طبيعي» على أي منتج غذائي أو تجميلي لا تعني أنه مناسب لكل شخص بلا استثناء؛ فالأشخاص الذين لديهم حساسية تجاه مكون معين يجب أن يتحققوا من الملصق دائماً.",
      usageAndStorage:
        "تحقق من تاريخ الإنتاج وتاريخ انتهاء الصلاحية ورقم التشغيلة ومكونات المنتج على العبوة الرسمية قبل الاستخدام.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_AR,
    },
    fr: {
      title: "Comment lire les ingrédients et l'étiquetage nutritionnel ?",
      summary: "Repères pratiques pour comprendre la liste des ingrédients, la taille des portions et les allergènes éventuels.",
      scientificInfo:
        "L'étiquetage mentionne la liste des ingrédients par ordre pondéral décroissant ainsi que les valeurs nutritionnelles (énergie, protéines, glucides, lipides, fibres) par portion ou pour 100 g.",
      ingredientEvidence:
        "La lecture attentive de l'étiquette permet d'identifier d'éventuels allergènes (par exemple dérivés laitiers ou soja dans certaines boissons instantanées) et d'adapter sa consommation.",
      traditionalUses:
        "Connaître la composition exacte de ses aliments et soins cosmétiques est la base d'une consommation éclairée.",
      unprovenClaimsNotice:
        "L'origine naturelle d'un ingrédient n'exclut pas une sensibilité individuelle ; vérifiez toujours la composition complète.",
      usageAndStorage:
        "Contrôlez systématiquement la date de durabilité minimale et l'intégrité de l'emballage officiel.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_FR,
    },
  },
  {
    slug: "correct-product-usage",
    category: "usage",
    sortOrder: 8,
    isPublished: true,
    readingMinutes: 4,
    ar: {
      title: "طريقة الاستخدام الصحيحة للمكملات ومنتجات العناية",
      summary: "إرشادات عامة للالتزام بتعليمات الشركة المصنعة سواء للمكملات الغذائية أو المشروبات أو الكوسميتيك.",
      scientificInfo:
        "صُممت كل فئة من منتجات DXN لطريقة استعمال محددة: فالمكملات والمشروبات مخصصة للاستخدام الغذائي الفموي وفق الحصة المقررة، بينما منتجات الكوسميتيك والعناية الشخصية مخصصة للاستعمال الظاهري الخارجي فقط.",
      ingredientEvidence:
        "بالنسبة لمنتجات العناية بالبشرة والكوسميتيك، يُنصح دائماً بإجراء اختبار تحسس بسيط على مساحة صغيرة من الجلد قبل الاستخدام المنتظم، وتجنب ملامسة العينين.",
      traditionalUses:
        "الانتظام المعتدل والالتزام بإرشادات العبوة أفضل دائماً من الاستخدام العشوائي أو المفرط.",
      unprovenClaimsNotice:
        "لا يجوز خلط المكملات مع أدوية طبية دون استشارة الطبيب أو الصيدلي، ولا يجوز استخدام منتجات العناية الخارجية على الجروح المفتوحة أو الحروق الشديدة.",
      usageAndStorage:
        "اتبع الإرشادات المكتوبة في صفحة كل منتج وعلى العبوة الأصلية بدقة، وتوقف عن الاستخدام واستشر مختصاً عند ظهور أي تحسس غير معتاد.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_AR,
    },
    fr: {
      title: "Bonnes pratiques d'utilisation des compléments et cosmétiques",
      summary: "Conseils essentiels pour respecter le mode d'emploi officiel des produits alimentaires et des soins externes.",
      scientificInfo:
        "Chaque catégorie répond à un usage précis : voie orale selon la portion recommandée pour les boissons et compléments, usage exclusivement externe pour les cosmétiques et soins d'hygiène.",
      ingredientEvidence:
        "Pour tout nouveau produit cosmétique, effectuez un test préalable sur une petite zone cutanée et évitez le contact avec les yeux.",
      traditionalUses:
        "La régularité mesurée et le respect des notices officielles garantissent la meilleure expérience d'utilisation.",
      unprovenClaimsNotice:
        "Ne combinez pas de compléments avec des traitements médicaux sans avis médical et n'appliquez pas de cosmétiques sur une peau lésée.",
      usageAndStorage:
        "Suivez les instructions propres à chaque référence et cessez l'utilisation en cas de réaction inhabituelle.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_FR,
    },
  },
  {
    slug: "product-storage-guide",
    category: "usage",
    sortOrder: 9,
    isPublished: true,
    readingMinutes: 3,
    ar: {
      title: "طريقة حفظ وتخزين المنتجات للحفاظ على جودتها",
      summary: "قواعد عملية لحماية المكملات الغذائية والمساحيق والمشروبات والكوسميتيك من الرطوبة والحرارة.",
      scientificInfo:
        "تؤثر الحرارة المرتفعة والرطوبة وأشعة الشمس المباشرة على خصائص المساحيق الغذائية والكبسولات والمستحضرات التجميلية، وقد تؤدي إلى تكتل المساحيق أو تغير قوامها ورائحتها قبل أوانها.",
      ingredientEvidence:
        "تُزوَّد كثير من عبوات المكملات بغطاء محكم وكيس ماص للرطوبة (Silica Gel) غير مخصص للأكل هدفه الحفاظ على جفاف المحتوى داخل العبوة.",
      traditionalUses:
        "حفظ الأغذية الجافة في مكان مظلم وجاف ومعتدل الحرارة قاعدة أساسية في سلامة الغذاء المنزلي.",
      unprovenClaimsNotice:
        "لا تستخدم أي منتج انتهت مدة صلاحيته أو تعرضت عبوته للتلف أو تغير لونه أو رائحته بشكل غير طبيعي.",
      usageAndStorage:
        "احفظ المنتجات في درجة حرارة الغرفة المعتدلة بعيداً عن بخار المطبخ والحمام وأشعة الشمس، واستخدم ملعقة جافة ونظيفة دائماً عند التعامل مع المساحيق.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_AR,
    },
    fr: {
      title: "Comment conserver et stocker correctement vos produits ?",
      summary: "Règles simples pour préserver vos poudres, gélules, boissons et soins cosmétiques de la chaleur et de l'humidité.",
      scientificInfo:
        "La chaleur, l'humidité ambiante et le rayonnement solaire direct peuvent altérer la texture, l'arôme et la stabilité des poudres nutritionnelles et des soins cosmétiques.",
      ingredientEvidence:
        "Conservez les produits dans leur flacon ou sachet d'origine hermétiquement refermé (sans ingérer le sachet absorbeur d'humidité lorsqu'il est présent).",
      traditionalUses:
        "L'entreposage dans un endroit frais, sec et à l'abri de la lumière est une règle fondamentale d'hygiène alimentaire.",
      unprovenClaimsNotice:
        "Ne consommez jamais un produit dont la date de péremption est dépassée ou dont l'emballage de sécurité est endommagé.",
      usageAndStorage:
        "Évitez les pièces humides, utilisez une cuillère parfaitement sèche pour les poudres et gardez hors de portée des enfants.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_FR,
    },
  },
  {
    slug: "supplement-safety-faq",
    category: "faq",
    sortOrder: 10,
    isPublished: true,
    readingMinutes: 4,
    ar: {
      title: "إرشادات السلامة والأسئلة التثقيفية قبل اختيار أي مكمل",
      summary: "أهم الأسئلة التي ينبغي طرحها قبل شراء أو استخدام أي مكمل غذائي لضمان قرار واعٍ وآمن.",
      scientificInfo:
        "اختيار المكمل الغذائي المناسب يبدأ بتحديد هدفك الغذائي الحقيقي، ومراجعة نظامك الغذائي اليومي أولاً، والتأكد من عدم وجود موانع صحية أو تداخلات مع أدوية تتناولها.",
      ingredientEvidence:
        "توصي الجهات الصحية دائماً بإبلاغ الطبيب المعالج بجميع المكملات والأعشاب التي يتناولها الفرد، خاصة قبل العمليات الجراحية أو أثناء الحمل والرضاعة أو عند وجود أمراض مزمنة كالسكري وضغط الدم وأمراض الكلى والكبد.",
      traditionalUses:
        "المعرفة الموثوقة والشفافية هما أساس الثقة المستدامة بين المستهلك وأي علامة تجارية مسؤولة.",
      unprovenClaimsNotice:
        "احذر من أي مصدر على الإنترنت يروج لوصفات علاجية عبر المكملات أو يعد بنتائج فورية مضمونة؛ في منصة DXN للحياة الطبيعية نلتزم بالمعلومة المسؤولة والشفافة فقط.",
      usageAndStorage:
        "إذا كانت لديك استفسارات حول مكونات منتج معين أو طريقة طلبه، يمكنك مراجعة بطاقة المنتج أو التواصل مع فريق DXN للحياة الطبيعية للاستفسار العام حول المنتجات المتوفرة.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_AR,
    },
    fr: {
      title: "Conseils de sécurité et questions clés avant de choisir un complément",
      summary: "Les bons réflexes à adopter avant d'intégrer un complément alimentaire dans sa routine quotidienne.",
      scientificInfo:
        "Le choix éclairé d'un complément commence par l'évaluation de son alimentation quotidienne et la vérification de l'absence de contre-indications personnelles.",
      ingredientEvidence:
        "Les autorités sanitaires recommandent d'informer son médecin de toute prise de compléments, particulièrement en cas de grossesse, d'allaitement, d'intervention chirurgicale prévue ou de maladie chronique.",
      traditionalUses:
        "Une information transparente et responsable constitue le socle d'une relation de confiance durable.",
      unprovenClaimsNotice:
        "Méfiez-vous des promesses de résultats miraculeux : DXN Natural Life s'engage strictement pour une information factuelle et conforme.",
      usageAndStorage:
        "Consultez la fiche détaillée de chaque produit ou contactez notre équipe pour toute question pratique sur les références disponibles.",
      disclaimer: MANDATORY_HEALTH_DISCLAIMER_FR,
    },
  },
];

export interface DefaultFaqSeed {
  slug: string;
  category: "company" | "products" | "ordering" | "membership" | "compliance";
  sortOrder: number;
  isPublished: boolean;
  ar: { question: string; answer: string };
  fr: { question: string; answer: string };
}

export const DEFAULT_FAQ_ITEMS: DefaultFaqSeed[] = [
  {
    slug: "what-is-dxn",
    category: "company",
    sortOrder: 1,
    isPublished: true,
    ar: {
      question: "ما هي شركة DXN؟",
      answer:
        "تأسست شركة DXN في ماليزيا عام 1993 على يد داتوك الدكتور ليم سيو جين (Datuk Dr. Lim Siow Jin)، وهي شركة عالمية تنشط في زراعة وتصنيع وتسويق المكملات الغذائية، المشروبات والقهوة، ومنتجات الكوسميتيك والعناية الشخصية عبر نظام البيع المباشر في العديد من الدول حول العالم.",
    },
    fr: {
      question: "Qu'est-ce que l'entreprise DXN ?",
      answer:
        "Fondée en Malaisie en 1993 par Datuk Dr. Lim Siow Jin, DXN est une entreprise internationale active dans la culture, la fabrication et la distribution de compléments alimentaires, de boissons et de produits cosmétiques et de soins personnels selon le modèle de la vente directe.",
    },
  },
  {
    slug: "are-dxn-products-medicines",
    category: "compliance",
    sortOrder: 2,
    isPublished: true,
    ar: {
      question: "هل منتجات DXN أدوية؟",
      answer:
        "لا، منتجات DXN ليست أدوية طبية على الإطلاق، بل هي أغذية ومشروبات ومكملات غذائية ومنتجات عناية شخصية وكوسميتيك. لا تهدف هذه المنتجات إلى تشخيص أي مرض أو علاجه أو الشفاء منه أو الوقاية منه، ولا تغني عن استشارة الطبيب أو الأدوية الموصوفة.",
    },
    fr: {
      question: "Les produits DXN sont-ils des médicaments ?",
      answer:
        "Non. Les produits DXN sont des denrées alimentaires, des boissons, des compléments alimentaires et des produits cosmétiques ou d'hygiène. Ils ne sont pas des médicaments et ne visent pas à diagnostiquer, traiter, guérir ou prévenir une maladie.",
    },
  },
  {
    slug: "do-i-need-membership-to-buy",
    category: "ordering",
    sortOrder: 3,
    isPublished: true,
    ar: {
      question: "هل أحتاج رقم عضوية للشراء من متجر DXN للحياة الطبيعية؟",
      answer:
        "لا، لا تحتاج إلى أي رقم عضوية للشراء. يمكن لأي زائر أو عميل اختيار المنتجات وإتمام الطلب مباشرة بسهولة تامة مع الدفع عند الاستلام.",
    },
    fr: {
      question: "Ai-je besoin d'un numéro de membre pour acheter sur DXN Natural Life ?",
      answer:
        "Non, aucun numéro d'adhésion n'est requis pour commander. Tout client peut acheter librement sur la boutique avec paiement à la livraison.",
    },
  },
  {
    slug: "how-to-enter-membership-at-checkout",
    category: "ordering",
    sortOrder: 4,
    isPublished: true,
    ar: {
      question: "كيف أضع رقم عضويتي عند الطلب إذا كنت عضواً في DXN؟",
      answer:
        "إذا كان لديك رقم عضوية حالي في DXN، ستجد في صفحة إتمام الطلب حقلاً اختيارياً بعنوان «رقم عضوية DXN (اختياري)». يمكنك إدخال رقمك فيه ليُرفق بطلبك لدى الإدارة، أو تركه فارغاً تماماً إذا لم تكن عضواً.",
    },
    fr: {
      question: "Comment indiquer mon numéro de membre DXN lors de la commande ?",
      answer:
        "Sur la page de validation de commande, un champ facultatif intitulé « Numéro de membre DXN (optionnel) » vous permet de saisir votre identifiant si vous êtes déjà membre, ou de le laisser vide.",
    },
  },
  {
    slug: "how-to-join-dxn-team",
    category: "membership",
    sortOrder: 5,
    isPublished: true,
    ar: {
      question: "كيف أنضم إلى فريق DXN للحياة الطبيعية؟",
      answer:
        "يمكنك التوجه إلى صفحة «انضم إلى فريقنا» وتعبئة نموذج طلب الانضمام ببياناتك الصحيحة ووسيلة التواصل المفضلة لديك. سيقوم فريقنا بالتواصل معك لشرح الخطوات الرسمية ومرافقتك في إجراءات التسجيل الرسمي خطوة بخطوة.",
    },
    fr: {
      question: "Comment rejoindre l'équipe DXN Natural Life ?",
      answer:
        "Rendez-vous sur la page « Rejoindre notre équipe » et remplissez le formulaire de contact. Notre équipe vous recontactera pour répondre à vos questions et vous accompagner dans les démarches officielles d'inscription.",
    },
  },
  {
    slug: "is-there-monthly-obligation",
    category: "membership",
    sortOrder: 6,
    isPublished: true,
    ar: {
      question: "هل هناك التزام شرائي شهري إجباري على المتسوقين؟",
      answer:
        "بالنسبة للشراء من المتجر كعميل لا يوجد أي التزام من أي نوع. أما للراغبين في بناء نشاط تسويقي والحصول على عمولات الأداء الشهرية كأعضاء موزعين، فهناك متطلبات نقاط مبيعات (PV) تحددها لوائح شركة DXN الرسمية وتُشرح بوضوح وشفافية قبل التسجيل.",
    },
    fr: {
      question: "Y a-t-il une obligation d'achat mensuel ?",
      answer:
        "Pour les clients achetant sur la boutique, il n'existe aucune obligation. Pour les distributeurs souhaitant percevoir des commissions mensuelles selon le plan officiel DXN, des critères de volume de points (PV) liés aux ventes s'appliquent et sont expliqués en toute transparence avant l'inscription.",
    },
  },
  {
    slug: "how-follow-up-works-after-registration-request",
    category: "membership",
    sortOrder: 7,
    isPublished: true,
    ar: {
      question: "كيف يتم التواصل معي بعد إرسال طلب الانضمام؟",
      answer:
        "فور إرسال النموذج يظهر لك رقم مرجعي لطلبك، ويتلقى فريق إدارة DXN للحياة الطبيعية إشعاراً فورياً لمراجعة طلبك والتواصل معك عبر الوسيلة التي اخترتها (واتساب، مكالمة هاتفية، تيليجرام، أو بريد إلكتروني) لتقديم الشرح الكامل والإجابة عن أسئلتك دون أي تسجيل تلقائي.",
    },
    fr: {
      question: "Comment se passe le suivi après l'envoi du formulaire d'adhésion ?",
      answer:
        "Vous recevez immédiatement une référence de demande et notre équipe est notifiée pour vous contacter via votre canal préféré (WhatsApp, téléphone, Telegram ou e-mail). Aucune inscription officielle automatique n'est effectuée sans votre accord et validation complète.",
    },
  },
  {
    slug: "customer-vs-member-difference",
    category: "membership",
    sortOrder: 8,
    isPublished: true,
    ar: {
      question: "ما الفرق بين الشراء كعميل والانضمام كعضو في DXN؟",
      answer:
        "العميل يطلب المنتجات لاستهلاكه الشخصي مباشرة دون تسجيل عضوية. أما العضو المسجل رسمياً فيحصل على رقم عضوية خاص في نظام DXN يتيح له الاستفادة من مزايا الأعضاء وإمكانية تسويق المنتجات وبناء فريق مبيعات وفق القواعد الرسمية للشركة.",
    },
    fr: {
      question: "Quelle est la différence entre acheter comme client et rejoindre comme membre ?",
      answer:
        "Le client achète simplement des produits pour son usage personnel sans adhésion. Le membre officiellement enregistré dispose d'un identifiant DXN lui permettant d'accéder aux avantages membres et, s'il le souhaite, de développer une activité de vente directe conforme aux règles de DXN.",
    },
  },
  {
    slug: "how-direct-selling-commissions-work",
    category: "membership",
    sortOrder: 9,
    isPublished: true,
    ar: {
      question: "كيف تعمل عمولات البيع المباشر وهل الدخل مضمون؟",
      answer:
        "تعتمد المكافآت والعمولات في نظام البيع المباشر حصرياً على حجم المبيعات الفعلية للمنتجات ونقاطها (PV/SV) وجهد العضو في التسويق والمتابعة والتعلم. لا يوجد أي دخل ثابت أو مضمون أو ربح سريع تلقائي، ولا تُمنح عمولات لمجرد تسجيل أشخاص دون حركة منتجات حقيقية.",
    },
    fr: {
      question: "Comment fonctionnent les commissions de vente directe et les revenus sont-ils garantis ?",
      answer:
        "Dans la vente directe légitime, les commissions reposent exclusivement sur les ventes réelles de produits (points PV/SV) et sur le travail personnel engagé. Aucun revenu n'est garanti ni automatique, et aucune rémunération ne provient du simple recrutement sans vente de produits.",
    },
  },
  {
    slug: "how-to-contact-dxn-nadz",
    category: "company",
    sortOrder: 10,
    isPublished: true,
    ar: {
      question: "كيف أتواصل مع فريق DXN للحياة الطبيعية؟",
      answer:
        "يمكنك التواصل معنا في أي وقت عبر صفحة «تواصل معنا» بإرسال رسالة مباشرة، أو عبر البريد الإلكتروني وقنوات التواصل الاجتماعي الرسمية وواتساب الموضحة في الموقع.",
    },
    fr: {
      question: "Comment contacter l'équipe DXN Natural Life ?",
      answer:
        "Vous pouvez nous écrire à tout moment depuis la page « Contact » via notre formulaire sécurisé, par e-mail ou via nos canaux officiels affichés sur le site.",
    },
  },
];

export const DEFAULT_CONTENT_BLOCKS = {
  about: {
    ar: {
      headline: "من هي شركة DXN؟",
      subtitle: "مسيرة انطلقت من ماليزيا عام 1993 بمعايير زراعة وتصنيع متكاملة وانتشار دولي في قطاع المنتجات الغذائية والعناية اليومية.",
      foundingYear: "1993",
      headquarters: "قدح، ماليزيا (Kedah, Malaysia)",
      founderName: "داتوك الدكتور ليم سيو جين (Datuk Dr. Lim Siow Jin)",
      philosophyTitle: "مفهوم «التنين الواحد» (One Dragon) للتكامل الصناعي",
      philosophyBody:
        "تعتمد شركة DXN نموذج إدارة متكاملاً يشرف على سلسلة الإنتاج داخل مرافقها الخاصة بدءاً من الزراعة المختبرية والمزرعية للمواد الخام، مروراً بالمعالجة والتجفيف والتصنيع والتعبئة، وصولاً إلى التوزيع عبر فروعها وشبكة أعضائها حول العالم لضمان ثبات الجودة.",
    },
    fr: {
      headline: "Qui est l'entreprise DXN ?",
      subtitle: "Une entreprise fondée en Malaisie en 1993, structurée autour de la culture, de la fabrication intégrée et de la distribution internationale.",
      foundingYear: "1993",
      headquarters: "Kedah, Malaisie",
      founderName: "Datuk Dr. Lim Siow Jin",
      philosophyTitle: "Le concept intégré « One Dragon »",
      philosophyBody:
        "DXN s'appuie sur une maîtrise intégrée de sa chaîne de valeur : culture des matières premières, transformation, conditionnement et distribution internationale, afin d'assurer la traçabilité et la régularité de ses produits.",
    },
  },
  founder: {
    ar: {
      headline: "تعرّف على مؤسس DXN",
      name: "داتوك الدكتور ليم سيو جين (Datuk Dr. Lim Siow Jin)",
      role: "المؤسس لشركة DXN القابضة في ماليزيا (1993)",
      summary:
        "تخرج داتوك الدكتور ليم سيو جين من المعهد الهندي للتكنولوجيا (Indian Institute of Technology)، وكرّس اهتمامه البحثي لدراسة علاقة الفطريات الغذائية — وعلى رأسها فطر الجانوديرما — بالتغذية المتوازنة وأساليب الاستزراع الحديثة.",
      vision:
        "في عام 1993 أسس شركة DXN في ولاية قدح بماليزيا برؤية تقوم على الجمع بين أساليب الزراعة المدارية المنضبطة والتصنيع الحديث وتوفير منتجات استهلاكية متنوعة عبر نظام البيع المباشر المنظم.",
    },
    fr: {
      headline: "Découvrir le fondateur de DXN",
      name: "Datuk Dr. Lim Siow Jin",
      role: "Fondateur de DXN en Malaisie (1993)",
      summary:
        "Diplômé de l'Indian Institute of Technology (IIT), Datuk Dr. Lim Siow Jin s'est intéressé de près à la culture contrôlée du Ganoderma et à la valorisation de ressources nutritionnelles naturelles.",
      vision:
        "En 1993, il fonde DXN dans l'État de Kedah en Malaisie avec la philosophie d'une production intégrée alliant agriculture contrôlée, transformation industrielle rigoureuse et distribution directe internationale.",
    },
  },
};
