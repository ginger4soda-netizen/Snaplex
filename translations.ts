// --- translations.ts (修复版：包含 Chips 数据结构) ---

export interface ChipData {
  label: string;
  prompt: string;
}

// 1. 完整词典 (7 国语言)
export const translations = {
  English: {
    // 通用按钮
    btnBack: "Back",
    btnSave: "Save Settings",
    btnCamera: "Snap a Shot",
    btnUpload: "Batch Upload",

    // 首页 (Home)
    homeTitle: "Vision to Prompt",
    homeTitle2: "Gateway to knowledge",
    homeInstruction: "If this is your first time using this, please fill in the API key in settings first, then upload an image to get in-depth visual prompt inspiration.",
    errCamera: "Could not access camera. Please allow permissions or use Batch Upload.",

    // 历史页 (History)
    libraryTitle: "Library",
    searchPlaceholder: "Search snaps (e.g., 'red', 'close-up')...",
    btnFind: "Find",
    btnSelect: "Select",
    btnCancel: "Cancel",
    btnSelectAll: "Select All",
    btnDeselectAll: "Deselect All",
    btnSelectNew: "Select New",
    txtSelected: "selected",
    btnExport: "Export",
    btnDelete: "Delete",
    emptyHistory: "No history yet. Snap a shot!",
    noMatches: "No matches found.",
    sectionNew: "New Snaps",
    sectionRecent: "Recent",
    sectionExported: "Exported Library",
    confirmDelete: "Delete these items?",

    // 设置页 (Settings)
    settingsTitle: "Personalize",
    lblCopyConfig: "\"Copy All\" Configuration",
    lblLangSettings: "Language Settings",
    lblSystemLang: "App System Language",
    lblFrontLang: "Card Front Language",
    lblBackLang: "Card Back Language",
    lblStylePref: "Style Preferences",
    styleStandard: "Standard",
    styleArtistic: "Artistic",
    styleCinematic: "Cinematic",
    styleTechnical: "Technical",
    styleUIUX: "UI/UX",
    styleLiterary: "Literary",

    // 分析页 (AnalysisView)
    tabAnalysis: "Analysis",
    tabChat: "Chat",
    btnCopyAll: "Copy All",
    msgCopiedConfig: "Copied configured translated prompts!",
    msgCopied: "Copied configured prompts!",
    msgImgCopied: "Image copied to clipboard!",
    msgImgFail: "Failed to copy image.",
    transUnavailable: "Translation unavailable.",
    // 模块标题
    lblSubject: "SUBJECT",
    lblEnvironment: "ENVIRONMENT",
    lblComposition: "COMPOSITION",
    lblLighting: "LIGHTING",
    lblMood: "MOOD",
    lblStyle: "STYLE",
    lblDescription: "DESCRIPTION",
    // Category labels for Wordbank
    categoryStyle: "STYLE",
    categoryLighting: "LIGHTING",
    categoryComposition: "COMPOSITION",
    categoryMood: "MOOD",

    // Home Features
    featureMiningTitle: "Deep Visual Mining",
    featureMiningSubtitle: "Use precise prompts to improve AI image generation quality",
    featureLangTitle: "Multilanguage Support",
    featureLangSubtitle: "Please select prompt language in settings first",
    featureSearchTitle: "Semantic Search",
    featureSearchSubtitle: "Quickly find your inspiration images",
    searchKeywords: ["Horror", "Close-up", "Red", "Cover Design"],

    // 聊天 (ChatBot)
    chatGreeting: "What else do you want to know about this image?",
    chatPlaceholder: "Ask something...",
    chatThinking: "AI is thinking...",

    // ✅ 新增：Chat Chips (English Prompts)
    chatChips: [
      {
        label: "Inspiration",
        prompt: "Please recommend inspiration resource websites for images of this type, along with corresponding search keywords."
      },
      {
        label: "Terms&Functions",
        prompt: "Please provide professional tagging for this image. From broad categories (e.g., Illustration) to precise industry terms (e.g., Isometric Vector Art). Explain the typical industry applications and functions of this type of image."
      },
      {
        label: "Text&Font",
        prompt: "Please extract all text content from the image. Professionally analyze the font design: speculate on the font family (e.g., Serif/Sans/Script), font characteristics, font weight, font personality (e.g., modern, retro, handwritten), and graphical treatment of the text."
      },
      {
        label: "Material&Texture",
        prompt: "Please analyze the materials and textures of objects in the scene in detail. Extract prompt words that precisely describe these textures."
      },
      {
        label: "Camera&Lens",
        prompt: "If this is a photograph or realistic render, please analyze its photography parameters: speculate on the camera model, camera format, lens focal length (e.g., 35mm, 85mm), and specific filters or post-processing color grading used."
      },
      {
        label: "Color Scheme",
        prompt: "Please analyze the color scheme. List dominant, secondary, and accent colors. Analyze the mood and information hierarchy conveyed by the colors."
      },
      {
        label: "Cultural Symbol",
        prompt: "Please conduct a semiotic analysis: What shapes, totems, visual symbols, or colors appear in the scene? First, describe their cross-cultural unified symbolism, then describe their specific symbolism in certain cultures. Are there metaphors or cultural symbols?"
      }
    ] as ChipData[],

    // 等待页 (Loader)
    loaderTitle: "Visual Decoding...",
    loaderSubtitle: "Learn visual terms while waiting.",
    loaderDone: "Decoding Complete",
    btnView: "View Result",
    miningTags: ["Subject", "Environment", "Composition", "Lighting", "Mood", "Style", "Inspiration Site", "Text & Font", "Material & Texture", "Camera & Lens"],
  },

  Chinese: {
    btnBack: "返回",
    btnSave: "保存设置",
    btnCamera: "拍照",
    btnUpload: "上传",
    homeTitle: "从视觉到提示词",
    homeTitle2: "通往知识的入口",
    homeInstruction: "如果这是你第一次使用，请先到设置中填写api key，然后上传图片，获取深入的视觉提示词灵感。",
    errCamera: "无法访问相机，请允许权限或使用批量上传。",
    libraryTitle: "我的图库",
    searchPlaceholder: "搜索 (如：红色、特写)...",
    btnFind: "搜索",
    btnSelect: "选择",
    btnCancel: "取消",
    btnSelectAll: "全选",
    btnDeselectAll: "取消全选",
    btnSelectNew: "选择未导出",
    txtSelected: "项已选",
    btnExport: "导出表单",
    btnDelete: "删除",
    emptyHistory: "暂无记录，快去拍一张吧！",
    noMatches: "没有找到匹配的图片。",
    sectionNew: "新上传",
    sectionRecent: "最近浏览",
    sectionExported: "已归档",
    confirmDelete: "确定删除这些图片吗？",
    settingsTitle: "个性化设置",
    lblCopyConfig: "“一键复制”配置",
    lblLangSettings: "语言设置",
    lblSystemLang: "App界面语言",
    lblFrontLang: "卡片正面语言",
    lblBackLang: "卡片背面语言",
    lblStylePref: "风格偏好",
    styleStandard: "标准",
    styleArtistic: "艺术",
    styleCinematic: "影视",
    styleTechnical: "技术",
    styleUIUX: "UI/UX",
    styleLiterary: "文学",
    tabAnalysis: "分析结果",
    tabChat: "AI对话",
    btnCopyAll: "一键复制",
    msgCopiedConfig: "已复制配置的译文提示词！",
    msgCopied: "已复制配置的提示词！",
    msgImgCopied: "图片已复制到剪贴板！",
    msgImgFail: "图片复制失败。",
    transUnavailable: "暂无翻译。",
    lblSubject: "主体",
    lblEnvironment: "环境",
    lblComposition: "构图",
    lblLighting: "光影/色彩",
    lblMood: "情绪/氛围",
    lblStyle: "美学风格",
    lblDescription: "描述",
    // Category labels for Wordbank
    categoryStyle: "风格",
    categoryLighting: "光影",
    categoryComposition: "构图",
    categoryMood: "情绪",
    // Home Features
    // Home Features
    featureMiningTitle: "深度视觉挖掘",
    featureMiningSubtitle: "用精准的提示词提升AI生图质量",
    featureLangTitle: "多语言支持",
    featureLangSubtitle: "请先到设置中选择提示词语言",
    featureSearchTitle: "语义搜索",
    featureSearchSubtitle: "快速查找你的灵感图片",
    searchKeywords: ["恐怖", "特写镜头", "红色", "封面设计"],

    chatGreeting: "对这张图你还有什么想了解的？",
    chatPlaceholder: "输入你的问题...",
    chatThinking: "AI 思考中...",

    // ✅ 新增：Chat Chips (中文 Prompt)
    chatChips: [
      {
        label: "灵感资源",
        prompt: "请推荐同类型图的灵感资源网址及对应的搜索关键词。"
      },
      {
        label: "术语&功能",
        prompt: "请给出这张图片的专业定位词（Tagging）。从宽泛分类（如插画）到精准术语（如等轴矢量图）。并解释这种类型的图通常应用在哪些行业领域，起什么作用？"
      },
      {
        label: "文字&字体",
        prompt: "请提取图中的所有文字内容。并专业分析字体设计：推测所属字体家族（如衬线/无衬线/手写）、字体特征、字重、字体性格（如现代、复古、手写）、以及文字的图形化处理方式。"
      },
      {
        label: "材质&纹理",
        prompt: "请详细分析画面中物体的材质和纹理。请提取能精准描述这些质感的提示词。"
      },
      {
        label: "相机&镜头",
        prompt: "如果这是一张摄影作品或写实渲染，请分析其摄影参数：推测相机型号、相机画幅、镜头焦段（如35mm, 85mm）、以及使用的滤镜或后期色调风格。"
      },
      {
        label: "配色方案",
        prompt: "请分析这张图的配色方案。列出主色、辅色、强调色。分析色彩传递出的情感和信息层级。"
      },
      {
        label: "文化象征",
        prompt: "请进行符号学分析：画面中出现了哪些图形、图腾、视觉符号或色彩？首先描述其跨文化统一的象征义，再描述其在特定文化中的特殊象征义。是否存在隐喻或文化象征？"
      }
    ] as ChipData[],

    loaderTitle: "视觉解码中...",
    loaderSubtitle: "等待时学点词条吧",
    loaderDone: "解码完成",
    btnView: "查看结果",
    miningTags: ["主体", "环境", "构图", "光影", "氛围", "风格", "灵感网站", "文字&字体", "材质&纹理", "相机/镜头"],
  },

  Spanish: {
    btnBack: "Volver", btnSave: "Guardar", btnCamera: "Tomar Foto", btnUpload: "Subir",
    homeTitle: "De Visión a Prompt", homeTitle2: "Puerta al conocimiento",
    homeInstruction: "Si es la primera vez que usa esto, complete la clave API en la configuración primero, luego suba una imagen para obtener inspiración visual profunda.",
    errCamera: "No se puede acceder a la cámara. Permita permisos o use Subir.",
    libraryTitle: "Tu Biblioteca", searchPlaceholder: "Buscar (ej. rojo, primer plano)...", btnFind: "Buscar",
    btnSelect: "Seleccionar", btnCancel: "Cancelar", btnSelectAll: "Todo", btnDeselectAll: "Nada",
    btnSelectNew: "Nuevos", txtSelected: "seleccionado", btnExport: "Exportar", btnDelete: "Eliminar",
    emptyHistory: "Sin historial. ¡Toma una foto!", noMatches: "No se encontraron coincidencias.",
    sectionNew: "Nuevas Fotos", sectionRecent: "Reciente", sectionExported: "Biblioteca Exportada", confirmDelete: "¿Eliminar estos elementos?",
    settingsTitle: "Personalizar", lblCopyConfig: "Configuración de Copia", lblLangSettings: "Configuración de Idioma",
    lblSystemLang: "Idioma del Sistema", lblFrontLang: "Idioma Frontal", lblBackLang: "Idioma Dorsal",
    lblStylePref: "Preferencias de Estilo", styleStandard: "Estándar", styleArtistic: "Artístico",
    styleCinematic: "Cinematográfico", styleTechnical: "Técnico", styleUIUX: "UI/UX", styleLiterary: "Literario",
    tabAnalysis: "Análisis", tabChat: "Chat", btnCopyAll: "Copiar Todo",
    msgCopiedConfig: "¡Prompts traducidos copiados!", msgCopied: "¡Prompts copiados!",
    msgImgCopied: "¡Imagen copiada!", msgImgFail: "Fallo al copiar imagen.", transUnavailable: "Traducción no disponible.",
    lblSubject: "SUJETO", lblEnvironment: "ENTORNO", lblComposition: "COMPOSICIÓN",
    lblLighting: "ILUMINACIÓN/COLOR", lblMood: "ESTADO DE ÁNIMO/VIBRA", lblStyle: "ESTILO ESTÉTICO", lblDescription: "DESCRIPCIÓN",
    categoryStyle: "ESTILO", categoryLighting: "ILUMINACIÓN", categoryComposition: "COMPOSICIÓN", categoryMood: "ESTADO DE ÁNIMO",

    // Home Features
    featureMiningTitle: "Minería Visual Profunda",
    featureMiningSubtitle: "Usa prompts precisos para mejorar la generación de imágenes de IA",
    featureLangTitle: "Soporte Multilingüe",
    featureLangSubtitle: "Seleccione primero el idioma del prompt",
    featureSearchTitle: "Búsqueda Semántica",
    featureSearchSubtitle: "Encuentra tus imágenes de inspiración",
    searchKeywords: ["Terror", "Primer plano", "Rojo", "Diseño de portada"],

    chatGreeting: "¿Qué más quieres saber sobre esta imagen?", chatPlaceholder: "Pregunta algo...", chatThinking: "IA pensando...",

    // ✅ Nuevo: Chat Chips (Español)
    chatChips: [
      { label: "Inspiración", prompt: "Recomiende sitios web de recursos de inspiración para imágenes de este tipo, junto con las palabras clave de búsqueda correspondientes." },
      { label: "Términos&Funciones", prompt: "Proporcione etiquetas profesionales (de amplias a precisas). Explique las aplicaciones industriales típicas y funciones." },
      { label: "Texto&Fuente", prompt: "Extraiga todo el texto. Analice la fuente: familia, peso, características, personalidad y tratamiento gráfico." },
      { label: "Material&Textura", prompt: "Analice materiales y texturas en detalle. Extraiga palabras clave que describan estas cualidades táctiles." },
      { label: "Cámara&Lente", prompt: "Analice parámetros fotográficos: especule sobre el modelo de cámara, formato, distancia focal (35mm/85mm), filtros y gradación de color." },
      { label: "Esquema de Color", prompt: "Analice el esquema de color (Dominante/Secundario/Acento). Analice el estado de ánimo y jerarquía." },
      { label: "Símbolo Cultural", prompt: "Análisis semiótico: ¿Qué formas, símbolos o colores aparecen? Describa su simbolismo transcultural y luego sus significados culturales específicos." }
    ] as ChipData[],

    loaderTitle: "Decodificación Visual...", loaderSubtitle: "Aprende estilos mientras esperas.",
    loaderDone: "Decodificación Completa", btnView: "Ver Resultado",
    miningTags: ["Sujeto", "Entorno", "Composición", "Iluminación", "Ánimo", "Estilo", "Sitio de inspiración", "Texto y Fuente", "Material y Textura", "Cámara y Lente"],
  },

  Japanese: {
    btnBack: "戻る", btnSave: "保存", btnCamera: "写真を撮る", btnUpload: "アップロード",
    homeTitle: "視覚からプロンプトへ", homeTitle2: "知識への入り口",
    homeInstruction: "初めて使用する場合は、設定でAPIキーを入力してから、画像をアップロードして、詳細な視覚的インスピレーションを得てください。",
    errCamera: "カメラにアクセスできません。許可するか、アップロードを使用してください。",
    libraryTitle: "ライブラリ", searchPlaceholder: "検索 (例: 赤、クローズアップ)...", btnFind: "検索",
    btnSelect: "選択", btnCancel: "キャンセル", btnSelectAll: "すべて", btnDeselectAll: "解除",
    btnSelectNew: "新規のみ", txtSelected: "選択済み", btnExport: "エクスポート", btnDelete: "削除",
    emptyHistory: "履歴なし。写真を撮りましょう！", noMatches: "見つかりません。",
    sectionNew: "新しいスナップ", sectionRecent: "最近", sectionExported: "エクスポート済み", confirmDelete: "これらを削除しますか？",
    settingsTitle: "パーソナライズ", lblCopyConfig: "「全コピー」設定", lblLangSettings: "言語設定",
    lblSystemLang: "システム言語", lblFrontLang: "カード表面言語", lblBackLang: "カード裏面言語",
    lblStylePref: "スタイル設定", styleStandard: "標準", styleArtistic: "芸術的",
    styleCinematic: "映画的", styleTechnical: "技術的", styleUIUX: "UI/UX", styleLiterary: "文学的",
    tabAnalysis: "分析", tabChat: "チャット", btnCopyAll: "すべてコピー",
    msgCopiedConfig: "翻訳されたプロンプトをコピーしました！", msgCopied: "プロンプトをコピーしました！",
    msgImgCopied: "画像をコピーしました！", msgImgFail: "画像のコピーに失敗しました。", transUnavailable: "翻訳なし。",
    lblSubject: "主題", lblEnvironment: "環境", lblComposition: "構図",
    lblLighting: "照明/色彩", lblMood: "ムード/雰囲気", lblStyle: "美的スタイル", lblDescription: "説明",
    categoryStyle: "スタイル", categoryLighting: "照明", categoryComposition: "構図", categoryMood: "ムード",

    // Home Features
    featureMiningTitle: "ディープビジュアルマイニング",
    featureMiningSubtitle: "正確なプロンプトを使用してAI画像生成の品質を向上させます",
    featureLangTitle: "多言語サポート",
    featureLangSubtitle: "設定でプロンプト言語を選択してください",
    featureSearchTitle: "セマンティック検索",
    featureSearchSubtitle: "インスピレーション画像をすばやく見つける",
    searchKeywords: ["ホラー", "クローズアップ", "赤", "カバーデザイン"],

    chatGreeting: "この画像について他に知りたいことは？", chatPlaceholder: "質問を入力...", chatThinking: "AI思考中...",

    // ✅ 新規: Chat Chips (日本語)
    chatChips: [
      { label: "インスピレーション", prompt: "このタイプの画像のインスピレーションリソースのウェブサイトと、対応する検索キーワードを推奨してください。" },
      { label: "用語&機能", prompt: "画像の専門的なタグ付けを行ってください（広義から狭義まで）。典型的な業界での用途と機能について説明してください。" },
      { label: "テキスト&フォント", prompt: "テキストを抽出してください。フォントの分析：ファミリー、太さ、特徴、性格（モダン/レトロ）、およびグラフィック処理について。" },
      { label: "素材&テクスチャ", prompt: "素材とテクスチャを詳細に分析してください。これらの質感を正確に描写するプロンプト単語を抽出してください。" },
      { label: "カメラ&レンズ", prompt: "撮影パラメータの分析：カメラモデル、フォーマット、焦点距離（35mm/85mm）、フィルター、およびカラーグレーディングについて推測してください。" },
      { label: "配色スキーム", prompt: "配色を分析してください（主色/補助色/アクセント）。色が伝える雰囲気と情報の階層を分析してください。" },
      { label: "文化的シンボル", prompt: "記号論的分析：どのような形、シンボル、色が現れていますか？異文化共通の象徴性と、特定の文化における意味を説明してください。" }
    ] as ChipData[],

    loaderTitle: "視覚的解読中...", loaderSubtitle: "待機中にスタイルを学ぶ",
    loaderDone: "解読完了", btnView: "結果を見る",
    miningTags: ["主題", "環境", "構図", "照明", "ムード", "スタイル", "インスピレーション", "テキスト＆フォント", "素材＆テクスチャ", "カメラ＆レンズ"],
  },

  French: {
    btnBack: "Retour", btnSave: "Enregistrer", btnCamera: "Prendre une Photo", btnUpload: "Upload",
    homeTitle: "De la Vision au Prompt", homeTitle2: "Passerelle vers la connaissance",
    homeInstruction: "Si c'est votre première fois, veuillez remplir la clé API dans les paramètres, puis téléchargez une image pour obtenir une inspiration visuelle approfondie.",
    errCamera: "Impossible d'accéder à la caméra. Autorisez l'accès ou utilisez l'Upload.",
    libraryTitle: "Votre Bibliothèque", searchPlaceholder: "Rechercher (ex: rouge, gros plan)...", btnFind: "Trouver",
    btnSelect: "Sélectionner", btnCancel: "Annuler", btnSelectAll: "Tout", btnDeselectAll: "Rien",
    btnSelectNew: "Nouveaux", txtSelected: "sélectionné", btnExport: "Exporter", btnDelete: "Supprimer",
    emptyHistory: "Pas d'historique. Prenez une photo !", noMatches: "Aucun résultat.",
    sectionNew: "Nouveaux Snaps", sectionRecent: "Récent", sectionExported: "Bibliothèque exportée", confirmDelete: "Supprimer ces éléments ?",
    settingsTitle: "Personnaliser", lblCopyConfig: "Config. Copier Tout", lblLangSettings: "Paramètres de Langue",
    lblSystemLang: "Langue Système", lblFrontLang: "Langue Recto", lblBackLang: "Langue Verso",
    lblStylePref: "Préférences de Style", styleStandard: "Standard", styleArtistic: "Artistique",
    styleCinematic: "Cinématographique", styleTechnical: "Technique", styleUIUX: "UI/UX", styleLiterary: "Littéraire",
    tabAnalysis: "Analyse", tabChat: "Chat", btnCopyAll: "Copier Tout",
    msgCopiedConfig: "Prompts traduits copiés !", msgCopied: "Prompts copiés !",
    msgImgCopied: "Image copiée !", msgImgFail: "Échec de la copie.", transUnavailable: "Traduction indisponible.",
    lblSubject: "SUJET", lblEnvironment: "ENVIRONNEMENT", lblComposition: "COMPOSITION",
    lblLighting: "ÉCLAIRAGE/COULEUR", lblMood: "AMBIANCE/VIBE", lblStyle: "STYLE ESTHÉTIQUE", lblDescription: "DESCRIPTION",
    categoryStyle: "STYLE", categoryLighting: "ÉCLAIRAGE", categoryComposition: "COMPOSITION", categoryMood: "AMBIANCE",

    // Home Features
    featureMiningTitle: "Exploration Visuelle Profonde",
    featureMiningSubtitle: "Utilisez des prompts précis pour améliorer la qualité de la génération d'images par l'IA",
    featureLangTitle: "Support Multilingue",
    featureLangSubtitle: "Sélectionnez d'abord la langue du prompt",
    featureSearchTitle: "Recherche Sémantique",
    featureSearchSubtitle: "Trouvez rapidement vos images d'inspiration",
    searchKeywords: ["Horreur", "Gros plan", "Rouge", "Design de couverture"],

    chatGreeting: "Que voulez-vous savoir d'autre ?", chatPlaceholder: "Posez une question...", chatThinking: "L'IA réfléchit...",

    // ✅ Nouveau: Chat Chips (Français)
    chatChips: [
      { label: "Inspiration", prompt: "Veuillez recommander des sites de ressources d'inspiration pour ce type d'image, ainsi que les mots-clés de recherche correspondants." },
      { label: "Termes&Fonctions", prompt: "Fournissez un balisage professionnel (du général au précis). Expliquez les applications industrielles typiques et les fonctions." },
      { label: "Texte&Police", prompt: "Extrayez tout le texte. Analysez la police : famille, graisse, caractéristiques, personnalité et traitement graphique." },
      { label: "Matériau&Texture", prompt: "Analysez les matériaux et textures en détail. Extrayez des mots-clés décrivant ces qualités tactiles." },
      { label: "Caméra&Objectif", prompt: "Analysez les paramètres photo : modèle d'appareil, format, focale, filtres et étalonnage des couleurs." },
      { label: "Palette Couleurs", prompt: "Analysez la palette de couleurs (Dominante/Secondaire). Analysez l'ambiance et la hiérarchie." },
      { label: "Symbole Culturel", prompt: "Analyse sémiotique : Quels formes, symboles ou couleurs apparaissent ? Décrivez leur symbolisme unifié puis leurs significations spécifiques." }
    ] as ChipData[],

    loaderTitle: "Décodage Visuel...", loaderSubtitle: "Apprenez des styles en attendant.",
    loaderDone: "Décodage Terminé", btnView: "Voir le Résultat",
    miningTags: ["Sujet", "Environnement", "Composition", "Éclairage", "Ambiance", "Style", "Site d'inspiration", "Texte et Police", "Matériau et Texture", "Caméra et Objectif"],
  },

  German: {
    btnBack: "Zurück", btnSave: "Speichern", btnCamera: "Schnappschuss", btnUpload: "Upload",
    homeTitle: "Von Vision zu Prompt", homeTitle2: "Tor zum Wissen",
    homeInstruction: "Wenn Sie dies zum ersten Mal verwenden, geben Sie bitte zuerst den API-Schlüssel in den Einstellungen ein und laden Sie dann ein Bild hoch.",
    errCamera: "Kamera nicht verfügbar. Bitte Berechtigungen prüfen oder Upload nutzen.",
    libraryTitle: "Deine Bibliothek", searchPlaceholder: "Suchen (z.B. Rot, Nahaufnahme)...", btnFind: "Finden",
    btnSelect: "Wählen", btnCancel: "Abbrechen", btnSelectAll: "Alle", btnDeselectAll: "Keine",
    btnSelectNew: "Neue", txtSelected: "ausgewählt", btnExport: "Exportieren", btnDelete: "Löschen",
    emptyHistory: "Kein Verlauf. Mach einen Schnappschuss!", noMatches: "Kein Treffer.",
    sectionNew: "Neue Snaps", sectionRecent: "Kürzlich", sectionExported: "Archiv", confirmDelete: "Diese Elemente löschen?",
    settingsTitle: "Personalisieren", lblCopyConfig: "Konfig. Alles Kopieren", lblLangSettings: "Spracheinstellungen",
    lblSystemLang: "Systemsprache", lblFrontLang: "Vorderseite Sprache", lblBackLang: "Rückseite Sprache",
    lblStylePref: "Stil-Präferenzen", styleStandard: "Standard", styleArtistic: "Künstlerisch",
    styleCinematic: "Filmisch", styleTechnical: "Technisch", styleUIUX: "UI/UX", styleLiterary: "Literarisch",
    tabAnalysis: "Analyse", tabChat: "Chat", btnCopyAll: "Alles Kopieren",
    msgCopiedConfig: "Übersetzte Prompts kopiert!", msgCopied: "Prompts kopiert!",
    msgImgCopied: "Bild kopiert!", msgImgFail: "Kopieren fehlgeschlagen.", transUnavailable: "Keine Übersetzung.",
    lblSubject: "SUBJEKT", lblEnvironment: "UMGEBUNG", lblComposition: "KOMPOSITION",
    lblLighting: "BELEUCHTUNG/FARBE", lblMood: "STIMMUNG/VIBE", lblStyle: "ÄSTHETISCHER STIL", lblDescription: "BESCHREIBUNG",
    categoryStyle: "STIL", categoryLighting: "BELEUCHTUNG", categoryComposition: "KOMPOSITION", categoryMood: "STIMMUNG",
    // Home Features
    featureMiningTitle: "Tiefes Visuelles Mining",
    featureMiningSubtitle: "Nutzen Sie präzise Prompts zur Verbesserung der KI-Bildqualität",
    featureLangTitle: "Mehrsprachiger Support",
    featureLangSubtitle: "Bitte wählen Sie zuerst die Prompt-Sprache",
    featureSearchTitle: "Semantische Suche",
    featureSearchSubtitle: "Finden Sie schnell Ihre Inspirationsbilder",
    searchKeywords: ["Horror", "Nahaufnahme", "Rot", "Cover-Design"],

    chatGreeting: "Was möchtest du noch wissen?", chatPlaceholder: "Stelle eine Frage...", chatThinking: "KI denkt nach...",

    // ✅ Neu: Chat Chips (Deutsch)
    chatChips: [
      { label: "Inspiration", prompt: "Bitte empfehlen Sie Inspirationsquellen-Websites für Bilder dieser Art sowie entsprechende Suchbegriffe." },
      { label: "Begriffe&Funktionen", prompt: "Bieten Sie professionelles Tagging (breit bis präzise). Erklären Sie typische Branchenanwendungen und Funktionen." },
      { label: "Text&Schrift", prompt: "Extrahieren Sie Text. Analysieren Sie die Schriftart: Familie, Stärke, Merkmale, Persönlichkeit und grafische Behandlung." },
      { label: "Material&Textur", prompt: "Analysieren Sie Materialien und Texturen im Detail. Extrahieren Sie Prompt-Wörter für diese haptischen Qualitäten." },
      { label: "Kamera&Objektiv", prompt: "Foto-Parameter analysieren: Kameramodell, Format, Brennweite, Filter und Farbkorrektur." },
      { label: "Farbschema", prompt: "Analysieren Sie das Farbschema (Dominant/Sekundär). Analysieren Sie Stimmung und Hierarchie." },
      { label: "Kultursymbol", prompt: "Semiotische Analyse: Welche Formen, Symbole oder Farben erscheinen? Beschreiben Sie die kulturübergreifende Symbolik, dann spezifische Bedeutungen." }
    ] as ChipData[],

    loaderTitle: "Visuelle Dekodierung...", loaderSubtitle: "Lerne Stile beim Warten.",
    loaderDone: "Dekodierung Abgeschlossen", btnView: "Ergebnis Ansehen",
    miningTags: ["Subjekt", "Umgebung", "Komposition", "Beleuchtung", "Stimmung", "Stil", "Inspirationsseite", "Text & Schrift", "Material & Textur", "Kamera & Objektiv"],
  },

  Korean: {
    btnBack: "뒤로", btnSave: "저장", btnCamera: "스냅 촬영", btnUpload: "업로드",
    homeTitle: "비전에서 프롬프트로", homeTitle2: "지식으로 가는 관문",
    homeInstruction: "처음 사용하는 경우 설정에서 API 키를 먼저 입력한 다음 이미지를 업로드하여 심층적인 시각적 영감을 얻으십시오.",
    errCamera: "카메라에 접근할 수 없습니다. 권한을 허용하거나 업로드를 사용하세요.",
    libraryTitle: "라이브러리", searchPlaceholder: "검색 (예: 빨강, 클로즈업)...", btnFind: "검색",
    btnSelect: "선택", btnCancel: "취소", btnSelectAll: "전체", btnDeselectAll: "해제",
    btnSelectNew: "새 항목", txtSelected: "선택됨", btnExport: "내보내기", btnDelete: "삭제",
    emptyHistory: "기록이 없습니다. 스냅을 찍어보세요!", noMatches: "결과 없음.",
    sectionNew: "새로운 스냅", sectionRecent: "최근", sectionExported: "보관함", confirmDelete: "삭제하시겠습니까?",
    settingsTitle: "개인화", lblCopyConfig: "전체 복사 설정", lblLangSettings: "언어 설정",
    lblSystemLang: "앱 시스템 언어", lblFrontLang: "카드 앞면 언어", lblBackLang: "카드 뒷면 언어",
    lblStylePref: "스타일 환경설정", styleStandard: "표준", styleArtistic: "예술적",
    styleCinematic: "영화적", styleTechnical: "기술적", styleUIUX: "UI/UX", styleLiterary: "문학적",
    tabAnalysis: "분석", tabChat: "채팅", btnCopyAll: "전체 복사",
    msgCopiedConfig: "번역된 프롬프트 복사됨!", msgCopied: "프롬프트 복사됨!",
    msgImgCopied: "이미지 복사됨!", msgImgFail: "이미지 복사 실패.", transUnavailable: "번역 없음.",
    lblSubject: "주제", lblEnvironment: "환경", lblComposition: "구도",
    lblLighting: "조명/색상", lblMood: "무드/분위기", lblStyle: "미적 스타일", lblDescription: "설명",
    categoryStyle: "스타일", categoryLighting: "조명", categoryComposition: "구도", categoryMood: "무드",
    // Home Features
    featureMiningTitle: "딥 비주얼 마이닝",
    featureMiningSubtitle: "정밀한 프롬프트를 사용하여 AI 이미지 생성 품질 향상",
    featureLangTitle: "다국어 지원",
    featureLangSubtitle: "설정에서 프롬프트 언어를 먼저 선택하십시오",
    featureSearchTitle: "시맨틱 검색",
    featureSearchSubtitle: "영감 이미지를 빠르게 찾으세요",
    searchKeywords: ["공포", "클로즈업", "빨강", "표지 디자인"],

    chatGreeting: "이 이미지에 대해 더 알고 싶은 것이 있나요?", chatPlaceholder: "질문하세요...", chatThinking: "AI 생각 중...",

    // ✅ 신규: Chat Chips (한국어)
    chatChips: [
      { label: "영감 리소스", prompt: "이 유형의 이미지에 대한 영감 리소스 웹사이트와 해당 검색 키워드를 추천해 주십시오." },
      { label: "용어&기능", prompt: "전문적인 태그(광범위한 분류에서 정밀한 용어까지)를 제공하십시오. 전형적인 산업 응용 분야와 기능을 설명하십시오." },
      { label: "텍스트&폰트", prompt: "모든 텍스트를 추출하세요. 폰트 디자인(패밀리, 두께, 특징, 성격, 그래픽 처리)을 전문적으로 분석하십시오." },
      { label: "재질&텍스처", prompt: "재질과 텍스처를 자세히 분석하십시오. 이러한 질감을 정확하게 묘사하는 프롬프트 단어를 추출하십시오." },
      { label: "카메라&렌즈", prompt: "촬영 매개변수 분석: 카메라 모델, 포맷, 초점 거리, 필터 및 색보정 스타일을 추측하십시오." },
      { label: "색상 구성", prompt: "색상 구성을 분석하십시오 (주조색/보조색). 색상이 전달하는 분위기와 정보 계층을 분석하십시오." },
      { label: "문화적 상징", prompt: "기호학적 분석: 어떤 모양, 상징 또는 색상이 나타납니까? 문화 간 보편적 상징성을 먼저 설명한 다음 특정 문화의 의미를 설명하십시오." }
    ] as ChipData[],

    loaderTitle: "시각적 해독 중...", loaderSubtitle: "기다리는 동안 스타일 배우기",
    loaderDone: "해독 완료", btnView: "결과 보기",
    miningTags: ["주제", "환경", "구도", "조명", "무드", "스타일", "영감 사이트", "텍스트 & 폰트", "재질 & 텍스처", "카메라 & 렌즈"],
  }
};

// 2. 智能匹配助手
export const getTranslation = (langString: string | undefined) => {
  if (!langString) return translations.English;
  const key = langString.split(' ')[0]; // 例如 "Chinese (中文)" -> "Chinese"
  return (translations as any)[key] || translations.English;
};