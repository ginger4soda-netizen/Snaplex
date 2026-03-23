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
    homeTitle2: "Turn Visual Inspiration into Prompt Library",
    homeMainTitle: "Vision to Prompt",
    homeSubtitle1: "Turn Visual Inspiration",
    homeSubtitle2: "into Prompt Library",
    uploadDropHere: "Drag and drop images here",
    uploadDropIt: "Drop it!",
    uploadClickBrowse: "or click for batch upload",
    homeInstruction: "If this is your first time using this, please fill in the API key in settings first, then upload an image to get in-depth visual prompt inspiration.",
    errCamera: "Could not access camera. Please allow permissions or use Batch Upload.",

    // 历史页 (History)
    libraryTitle: "Library",
    searchPlaceholder: "Search snaps (e.g., 'red', 'close-up')...",
    btnFind: "Find",
    btnSelect: "Export",
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
    btnImport: "Import",
    memoPlaceholder: "Write your own notes about this image...",
    memoLabel: "MEMO",
    memoTranslationLabel: "TRANSLATION",
    memoPersonalNotes: "Personal Notes",

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
    // 1. Structured Prompt
    featureStructuredTitle: "Structured Prompt",
    featureStructuredSubtitle: "Break Any Image into a Reusable Prompt Structure",
    // 2. Deep Visual Insight
    featureInsightTitle: "Deep Visual Insight",
    featureInsightSubtitle: "Discover More Info in Chat Mode",
    // 3. Personalized Prompt Library
    featureLibraryTitle: "Personalized Prompt Library",
    featureLibrarySubtitle: "Find Past Inspirations by Semantic Search",
    // 4. Batch Operations
    featureBatchTitle: "Batch Operations",
    featureBatchSubtitle: "Get Prompts from Multiple Images in One Go",
    // 5. Visual Term Printer
    featurePrinterTitle: "Visual Term Printer",
    featurePrinterSubtitle: "Build Your Own Visual Glossary from Real Images",
    // 6. Multilanguage Support
    featureLangTitle: "7-Language Support",
    featureLangSubtitle: "Generate Prompts in 2 Languages, Instantly",
    // 7. Local History
    featureHistoryTitle: "Local History",
    featureHistorySubtitle: "Local Storage with Instant Access and Full Privacy",

    // Existing keys kept for compatibility if needed (can be cleaned up later)
    featureMiningTitle: "Deep Visual Mining",
    featureMiningSubtitle: "Use precise prompts to improve AI image generation quality",
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

    // Documentation
    doc: {
      intro: {
        title: "Welcome to Snaplex",
        greeting: "Thank you for your interest in Snaplex!",
        desc: "This is a free, open-source AI image analysis tool that runs entirely in your browser. It helps creators batch reverse-engineer image prompts, extract structured prompts, dive deeper into image details, and build personal visual prompt libraries.",
        personal: "Snaplex is a small tool I independently developed to solve some of my own troubles in the AI image generation process. I believe that accurate and effective prompts are valuable assets in collaboration with AI. I also hope that visual inspiration in life can be more easily applied and migrated. All features are built based on my understanding and value judgment of this matter. It's still being continuously improved, and I hope it brings you value. Thank you for your trust and support! Welcome to use it and give feedback, stay tuned~ 🙏",
        github: "GitHub Project: https://github.com/ginger4soda-netizen/Snaplex (If you find it useful, please give me a ⭐️)"
      },
      important: {
        title: "⚠️ Must Read Before Use",
        apiKey: {
          title: "1. You Need Your Own AI API Key",
          desc: "Snaplex is not a traditional SaaS service—it's a toolbox that requires your own AI API key. Because Snaplex calls AI services directly from your browser (like Gemini, OpenAI, etc.), I don't provide a relay server. This means:\n• More Privacy: Images and data don't pass through third-party servers\n• More Transparency: You directly control AI service usage and costs\n• Configuration Required: You need to register with AI providers and obtain keys",
          tipTitle: "💡 AI Model Provider Guide",
          tipDesc: "Different models produce prompts of varying quality. Please compare and judge after use, and combine with free plans as needed~",
          table: [
            ["Provider", "Free Tier", "Best For"],
            ["Google", "Very limited daily quota (5/min, 20/day)", "Users who already have cards linked in Google AI Studio"],
            ["SiliconFlow", "GLM model free but slow; Qwen model fast with minimal token usage (20M tokens on signup = essentially free)", "Domestic users who want free usage"],
            ["OpenAI", "Pay-per-use", "Those who want GPT model and willing to pay for API"],
            ["Anthropic", "Pay-per-use", "Those who want Claude model and willing to pay for API"]
          ]
        },
        storage: {
          title: "2. Data Stored Locally in Your Browser",
          desc: "All images, analysis results, and chat history are saved in your browser's IndexedDB (storage limit depends on your browser and device). This means I cannot access any of your data, and even if the server goes down, your history is unaffected.",
          warning: "⚠️ Clearing browser cache = Losing ALL history",
          scenariosTitle: "Common triggering scenarios:",
          scenario1: "Manually clearing browser data",
          scenario2: "Using 'Private/Incognito Mode' (data cleared when window closes)",
          scenario3: "Browser updates or system reinstallation",
          scenario4: "Switching devices or browsers",
          backupTitle: "💾 Important: Back up regularly!",
          backupDesc: "Current version supports data export:",
          backupStep1: "1. Go to the Library page",
          backupStep2: "2. Click the Select button",
          backupStep3: "3. Select All or Select New (unexported) images and prompts",
          backupStep4: "4. Click Export button (Note: the button next to Export is Delete—don't click it by mistake!)",
          exportNote: "The exported form contains 3 columns: Column 1 is the image thumbnail, Column 2 is the front-side language prompt, Column 3 is the back-side language prompt."
        },
        hosting: {
          title: "3. Free Hosting, Occasionally Unavailable",
          desc: "Snaplex is deployed on free servers to remain completely free and open-source. Under normal circumstances, it's stable most of the time. In extreme cases (traffic surge), there may be brief access slowdowns or rate limiting due to free server bandwidth limits (100GB/month). I'll monitor traffic and provide backup links if necessary. You can also deploy it to your own server and run locally."
        }
      },
      quickstart: {
        title: "👉 Quick Start",
        stepsTitle: "4 Steps for First-Time Use",
        step1: {
          title: "Step 1",
          desc: "Go to Settings page, select the model provider and corresponding model, get your own API key and fill it in. The API key will be saved in masked form in your local browser (saved by default once filled). No need to repeat this operation afterwards."
        },
        step2: {
          title: "Step 2",
          desc: "Set system language and card front/back languages. Each image will get prompts in two languages based on current settings (supports 7 languages)."
        },
        step3: {
          title: "Step 3",
          desc: "Return to home page, drag or click to upload images to the yellow panel (you can upload multiple images at once) → Wait for AI to analyze → View structured prompts"
        },
        step4: {
          title: "Step 4",
          desc: "Copy the dimension prompts you want to reference, or one-click copy multiple dimension prompts. You can select the one-click copy range in Settings."
        },
        devNote: {
          title: "Developer Note",
          desc: "Each image has 6 dimension prompts: Subject, Environment, Composition, Lighting/Color, Mood/Atmosphere, Aesthetic Style.\n\nThis is because all AI image generation models demonstrate in advanced prompt cases that prompts containing these dimensions greatly improve AI image quality.\n\nThe reverse-engineering instructions I set in the system aim to make the model accurately restore these dimensions of the uploaded image with details. However, different models have varying adherence to instructions. I spent a lot of time testing prompt quality from different models. Now even free models produce decent quality, but there are still occasional inaccuracies (e.g., overhead shots recognized as eye-level). When using, it's recommended to review AI results and correct inaccuracies. This is also an important skill in collaborating with AI: the ability to review and correct AI outputs."
        },
        advanced: {
          title: "Explore Advanced Features",
          refresh: "Refresh Button: Regenerate prompts for a specific dimension",
          chat: "Chat Mode: Deeply inquire about visual details, explore tag usage, add your own preset tags",
          history: "History: Search past inspirations, extract prompt corpus",
          printer: "Term Printer: Mine professional terminology"
        }
      },
      practices: {
        title: "✨ Best Practices",
        backup: "Back up regularly",
        testKey: "Test API Key: Verify configuration with a simple image first",
        search: "Use Search: Library history supports fuzzy search",
        batch: "Batch Operations: Upload multiple images simultaneously"
      },
      faq: {
        title: "❓ FAQ",
        q1: "Is Snaplex free? Where might I need to pay?",
        a1: "The tool itself is free, but if you use paid API services, you pay the API fees directly to the model providers—I cannot profit from this (so I specifically integrated free APIs so you can use it completely free). My intention is just to share a small tool I developed, to verify whether I can make something valuable to others starting from my own needs.",
        q2: "Analysis failed or error. What's the cause? How to fix?",
        a2: "Check network connection, whether API Key is correctly filled, API Key validity, AI provider regional restrictions.\n• If it's a VPN issue, try switching VPN nodes. VPN nodes need to be clean and in the AI provider's accessible region.\n• If API key hit free usage limit, switch to a free AI model provider (SiliconFlow), or subscribe to paid API for advanced models.\n• Check if API key is entered incorrectly or mismatched with provider, such as extra spaces, or Google API entered under OpenAI.",
        q3: "How to switch language?",
        a3: "The purple panel on home page allows quick switching of interface language. For prompt card front/back languages, go to Settings page (supports Chinese/English/Japanese and 7 languages total).",
        q4: "Multiple dimension prompts failed to parse, showing 'N/A'?",
        a4: "Sometimes the model is lazy and doesn't return all field information. Just click the refresh button above the card that's missing prompts.",
        q5: "Will version updates cause previously queried data to disappear?",
        a5: "No, version updates won't clear your queried images and prompts, but system upgrades on your own device will. Please carefully read point 2 of Must Read Before Use regarding data storage and security.",
        q6: "What does Style Preference in settings do?",
        a6: "This is an entry I reserved for ideas not yet implemented. Currently, selecting different style preferences only affects the terminology preference of output prompts, but this module hasn't been extensively tested yet. Just select the default Standard style for now.",
        q7: "How to use preset tags in chat mode?",
        a7: "Click ➕ to customize your frequently used preset tags (such as useful image reverse-engineering instructions, prompts for extracting specific dimensions, etc.). All tags can be edited (right-click), deleted (long-press to activate delete state), and reordered (drag tags to your desired position, put frequently used ones at the front). After setting up tags, clicking a tag will send the corresponding question or instruction and get AI's answer based on the current image."
      },
      feedback: {
        title: "✉️ Feedback Channels",
        github: "GitHub Issues: Technical issues and feature suggestions",
        social: "Social Media: Share your usage experience, problems encountered, and useful prompts you reverse-engineered",
        meta: "Version: v9.5 | Updated: January 2026 | License: AGPL-3.0"
      }
    },
  },

  Chinese: {
    btnBack: "返回",
    btnSave: "保存设置",
    btnCamera: "拍照",
    btnUpload: "上传",
    homeTitle: "从视觉到提示词",
    homeTitle2: "通往知识的入口",
    homeMainTitle: "从视觉到提示词",
    homeSubtitle1: "将视觉灵感",
    homeSubtitle2: "转化为提示词库",
    uploadDropHere: "拖放图片至此",
    uploadDropIt: "放开！",
    uploadClickBrowse: "或点击批量上传",
    homeInstruction: "如果这是你第一次使用，请先到设置中填写api key，然后上传图片，获取深入的视觉提示词灵感。",
    errCamera: "无法访问相机，请允许权限或使用批量上传。",
    libraryTitle: "我的图库",
    searchPlaceholder: "搜索 (如：红色、特写)...",
    btnFind: "搜索",
    btnSelect: "导出",
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
    btnImport: "导入",
    memoPlaceholder: "写下你对这张图片的个人笔记...",
    memoLabel: "备忘录",
    memoTranslationLabel: "翻译",
    memoPersonalNotes: "个人笔记",
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
    // 1. Structured Prompt
    featureStructuredTitle: "结构化提示词",
    featureStructuredSubtitle: "将任意图像拆解为可复用的Prompt结构",
    // 2. Deep Visual Insight
    featureInsightTitle: "深度视觉洞察",
    featureInsightSubtitle: "在对话模式中探索更多信息",
    // 3. Personalized Prompt Library
    featureLibraryTitle: "个性化Prompt库",
    featureLibrarySubtitle: "通过语义搜索查找过往灵感",
    // 4. Batch Operations
    featureBatchTitle: "批量操作",
    featureBatchSubtitle: "一次性获取多张图片的Prompt",
    // 5. Visual Term Printer
    featurePrinterTitle: "视觉术语打印机",
    featurePrinterSubtitle: "从真实图像构建专属视觉词汇表",
    // 6. Multilanguage Support
    featureLangTitle: "7国语言支持",
    featureLangSubtitle: "即时生成双语Prompt",
    // 7. Local History
    featureHistoryTitle: "本地历史",
    featureHistorySubtitle: "本地存储，即时访问，完全隐私",

    // Existing keys kept for compatibility
    featureMiningTitle: "深度视觉挖掘",
    featureMiningSubtitle: "用精准的提示词提升AI生图质量",
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

    // Documentation
    doc: {
      intro: {
        title: "欢迎使用 Snaplex",
        greeting: "感谢您对 Snaplex 的关注！",
        desc: "这是一个开源免费的、完全在浏览器中运行的 AI 图片分析工具，旨在帮助创作者批量反推图片提示词、提取结构化提示词、深入挖掘图片的更多信息、建立个人视觉提示词库。",
        personal: "Snaplex 是我为了解决自己在AI生图过程中的一些麻烦独立开发的小工具，我相信准确有效的提示词是与AI协作过程中相当有价值的资产，我也希望生活中的视觉灵感能更方便地应用和迁移，以及在用AI生图的时候不仅知其然，还能知其所以然，所有的功能构建都是基于我对这件事的理解和价值判断。它还在持续完善中，希望它能为您带来价值。感谢您的信任与支持！也欢迎您使用并反馈，持续关注~🙏",
        github: "Github项目页面：https://github.com/ginger4soda-netizen/Snaplex（如果对您有用，欢迎给我一颗小⭐️）"
      },
      important: {
        title: "⚠️ 使用前必读",
        apiKey: {
          title: "1. 您需要自己的 AI API Key",
          desc: "Snaplex 不是传统的 SaaS 服务，它是一个工具箱，需要您提供自己的 AI api key。因为Snaplex 直接从您的浏览器调用 AI 服务（如Gemini、OpenAI等），我不提供中转服务器，这意味着：\n• 更隐私：图片和数据不经过第三方服务器\n• 更透明：您直接控制 AI 服务的使用和费用\n• 需配置：您需要在 AI 提供商注册并获取密钥",
          tipTitle: "💡 AI模型提供商说明",
          tipDesc: "不同模型反推的提示词质量有差异，请在使用后自己对比判断，结合免费方案按需使用~",
          table: [
            ["提供商 Provider", "免费额度 Free Tier", "适合场景 Best For"],
            ["Google", "每天免费额度非常有限（每分钟5次，每天20次）", "已经在google ai studio绑过卡"],
            ["SiliconFlow", "GLM模型免费使用但速度较慢（因为是thinking模型），qwen模型速度快，消耗少量token（因为注册就送2000w token，所以也相当于是免费）", "国内用户，想免费使用"],
            ["OpenAI", "按量计费", "想用gpt模型反推且愿意为api付费"],
            ["Anthropic", "按量计费", "想用claude模型反推且愿意为api付费"]
          ]
        },
        storage: {
          title: "2. 数据存储在您的浏览器本地",
          desc: "所有图片、分析结果、聊天记录都保存在您的浏览器 IndexedDB 中（存储容量上限由浏览器和设备决定），这意味着我无法访问您的任何数据，即使服务器宕机，您的历史记录也不受影响。但这也意味着...",
          warning: "⚠️ 清除浏览器缓存 = 丢失所有历史记录",
          scenariosTitle: "常见触发场景：",
          scenario1: "手动清除浏览器数据",
          scenario2: "使用'隐私模式/无痕模式'（关闭窗口即清空）",
          scenario3: "浏览器更新或系统重装",
          scenario4: "切换设备或浏览器",
          backupTitle: "💾 重要建议：定期备份！",
          backupDesc: "当前版本已支持数据导出功能：",
          backupStep1: "1. 进入 图库 (LIBRARY) 页面",
          backupStep2: "2. 点击 选择 (Select) 按钮",
          backupStep3: "3. 全选(Select All) 或 选择未导出(Select New) 的图片和提示词",
          backupStep4: "4. 点击 导出表单 (Export) 按钮（注意导出边上的按钮是删除，不要误删了！）",
          exportNote: "导出的表单包含3列，第一列是图片缩略图，第二列是卡片正面语言提示词，第三列是卡片背面语言提示词。"
        },
        hosting: {
          title: "3. 免费托管，可能偶尔不可用",
          desc: "Snaplex 部署在免费服务器上，以保持完全免费开源。正常情况下，大部分时间稳定可用。极端情况下（流量激增），可能出现短暂访问缓慢或限流，这是由于免费服务器的带宽限制（每月 100GB）。我会监控流量，必要时提供备用链接，您也可以自行部署到您的服务器，本地运行。"
        }
      },
      quickstart: {
        title: "👉 快速开始使用",
        stepsTitle: "初次使用的4个步骤",
        step1: {
          title: "Step 1",
          desc: "前往设置页面，选择模型提供商和对应模型，获取自己的api key并填入，api key会以掩码的形式保存在你当前设备的本地浏览器中（填写默认保存），之后无需重复操作。"
        },
        step2: {
          title: "Step 2",
          desc: "设置系统语言和卡片正反面语言，每张图片都会同时得到当前设置状态下的两种语言提示词（支持7种语言）。"
        },
        step3: {
          title: "Step 3",
          desc: "回到首页，往黄色面板拖拽或点击上传图片（可以一次上传多张图片）→ 等待AI解析图片 → 查看结构化提示词"
        },
        step4: {
          title: "Step 4",
          desc: "复制想参考的维度提示词使用，或一键复制多个维度提示词使用。可在设置中选择一键复制的提示词范围。"
        },
        devNote: {
          title: "开发者说明",
          desc: "每张图片都有6个维度提示词：主体、环境、构图、光影/色彩、情绪/氛围、美学风格\n\n这是因为任何AI生图模型在高级提示词案例中都演示了，包含这些维度的提示词会大大提高AI生图质量。\n\n我在系统中设置的反推指令目的是让模型尽量准确且包含细节地还原上传图片的这些维度，但不同模型对反推指令的遵循度有差异，我花了很多时间测试不同模型反推出的提示词质量，现在能做到即使是免费的模型反推出的质量也不会太差，但还是存在有时会识别不准（比如俯拍镜头视角识别为平视），在使用的时候建议审查AI给出的结果，修改不准确的地方。这也是与AI协作的重要素养之一：有能力审核并修正AI给出的结果。"
        },
        advanced: {
          title: "探索高级功能",
          refresh: "刷新按钮：重新生成某个维度提示词",
          chat: "聊天模式：深入询问视觉细节，探索标签的使用方法，增加自己的预设标签",
          history: "历史记录：搜索过往灵感，提取提示词语料",
          printer: "词库打印机：挖掘专业术语"
        }
      },
      practices: {
        title: "✨ 最佳实践",
        backup: "定期导出备份",
        testKey: "测试 API Key：先用简单图片验证配置正确",
        search: "善用搜索：图库页面历史记录支持模糊搜索",
        batch: "批量操作：可同时上传多张图片"
      },
      faq: {
        title: "❓ 常见问题",
        q1: "Snaplex是免费的吗？有可能在哪里需要付费？",
        a1: "工具本身是免费的，但如果要使用付费的api服务，用户得自己支付api的费用，这个费用是直接付给模型厂商的，我无法从中获得收益（所以我特意接入了免费的api，让您可以在完全免费的模式下使用）。我的本意只是分享一个自己开发的小工具，验证我是否能从自己的需求出发做出对别人也有价值的产品，看自己能vibe coding到什么程度。",
        q2: "分析失败或报错是什么原因？如何解决？",
        a2: "检查网络连接、API Key 填写是否正确、API Key 有效性、AI 提供商区域限制。\n• 如果是VPN问题，请更换VPN节点后重试。VPN节点需要干净且在AI 提供商的可访问区域。\n• 如果是api key触达免费使用限额，可以更换成免费的ai模型提供商（siliconflow），或者开通高级模型的付费api。\n• 检查api key是否填写错误或是否对应错模型提供商，比如多了空格，或把google的api填写到了openai的下方。",
        q3: "如何切换语言？",
        a3: "首页紫色面板可快速切换界面语言，提示词卡片正反面语言请到设置页面选择（支持中/英/日等7种语言）。",
        q4: "多个维度提示词解析失败，出现'N/A'？",
        a4: "有时模型偷懒未返回所有字段信息就会出现这种情况，点击未出现提示词的卡片上方的刷新按钮就可以了。",
        q5: "版本更新会导致之前查询过的数据消失吗？",
        a5: "不会，更新版本不会清除你查询过的图片和提示词，但您自己设备上的系统升级会。关于数据的存储和安全问题请仔细阅读使用前必读第二点。",
        q6: "设置页的风格偏好有什么用？",
        a6: "这是我为还没实现的想法预留的入口，目前选择不同风格偏好只会影响输出提示词的术语偏好，但这个模块的表现还没经过大量测试，目前直接选默认的标准风格就可以。",
        q7: "对话模式下的预设标签如何使用？",
        a7: "点击➕号可以个性化定制自己常用的预设标签（比如好用的反推图片指令、提取特定维度的提示词等），所有标签都可以编辑（鼠标右键）、删除（长按标签会激活删除状态）、排序（按住标签拖拽到你想要的位置，把常用标签拖放到前面）。设置好标签后，点击标签就会发送出对应的问题或指令，得到AI基于当前这张图片的回答。"
      },
      feedback: {
        title: "✉️ 反馈渠道",
        github: "GitHub Issues: 技术问题和功能建议",
        social: "社交媒体: 分享您的使用体验、遇到的问题、反推出的好用的提示词",
        meta: "版本: v9.5 | 更新日期: 2026年1月 | License: AGPL-3.0"
      }
    },
  },

  Spanish: {
    btnBack: "Volver", btnSave: "Guardar", btnCamera: "Tomar Foto", btnUpload: "Subir",
    homeTitle: "De Visión a Prompt", homeTitle2: "Puerta al conocimiento",
    homeMainTitle: "De Visión a Prompt",
    homeSubtitle1: "Convierte la Inspiración Visual",
    homeSubtitle2: "en Biblioteca de Prompts",
    uploadDropHere: "Arrastra y suelta imágenes aquí",
    uploadDropIt: "¡Suéltala!",
    uploadClickBrowse: "o clic para subir en lote",
    homeInstruction: "Si es la primera vez que usa esto, complete la clave API en la configuración primero, luego suba una imagen para obtener inspiración visual profunda.",
    errCamera: "No se puede acceder a la cámara. Permita permisos o use Subir.",
    libraryTitle: "Tu Biblioteca", searchPlaceholder: "Buscar (ej. rojo, primer plano)...", btnFind: "Buscar",
    btnSelect: "Exportar", btnCancel: "Cancelar", btnSelectAll: "Todo", btnDeselectAll: "Nada",
    btnSelectNew: "Nuevos", txtSelected: "seleccionado", btnExport: "Exportar", btnDelete: "Eliminar",
    btnImport: "Importar", memoPlaceholder: "Escribe tus propias notas sobre esta imagen...",
    memoLabel: "MEMO", memoTranslationLabel: "TRADUCCIÓN", memoPersonalNotes: "Notas Personales",
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
    featureStructuredTitle: "Prompt Estructurado",
    featureStructuredSubtitle: "Descomponga cualquier imagen en una estructura de prompt reutilizable",
    featureInsightTitle: "Análisis Visual Profundo",
    featureInsightSubtitle: "Descubra más información en modo chat",
    featureLibraryTitle: "Biblioteca de Prompts Personalizada",
    featureLibrarySubtitle: "Encuentra inspiraciones pasadas por búsqueda semántica",
    featureBatchTitle: "Operaciones por Lotes",
    featureBatchSubtitle: "Obtén prompts de múltiples imágenes de una vez",
    featurePrinterTitle: "Impresora de Términos Visuales",
    featurePrinterSubtitle: "Construya su propio glosario visual a partir de imágenes reales",
    featureLangTitle: "Soporte de 7 Idiomas",
    featureLangSubtitle: "Genera prompts en 2 idiomas, instantáneamente",
    featureHistoryTitle: "Historial Local",
    featureHistorySubtitle: "Almacenamiento local con acceso instantáneo y privacidad total",
    featureMiningTitle: "Minería Visual Profunda",
    featureMiningSubtitle: "Usa prompts precisos para mejorar la generación de imágenes de IA",
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

    // Documentation
    doc: {
      intro: {
        title: "Welcome to Snaplex",
        greeting: "Thank you for your interest in Snaplex!",
        desc: "This is a free, open-source AI image analysis tool that runs entirely in your browser. It helps creators batch reverse-engineer image prompts, extract structured prompts, dive deeper into image details, and build personal visual prompt libraries.",
        personal: "Snaplex is a small tool I independently developed to solve some of my own troubles in the AI image generation process. I believe that accurate and effective prompts are valuable assets in collaboration with AI. I also hope that visual inspiration in life can be more easily applied and migrated. All features are built based on my understanding and value judgment of this matter. It's still being continuously improved, and I hope it brings you value. Thank you for your trust and support! Welcome to use it and give feedback, stay tuned~ 🙏",
        github: "GitHub Project: https://github.com/ginger4soda-netizen/Snaplex (If you find it useful, please give me a ⭐️)"
      },
      important: {
        title: "⚠️ Must Read Before Use",
        apiKey: {
          title: "1. You Need Your Own AI API Key",
          desc: "Snaplex is not a traditional SaaS service—it's a toolbox that requires your own AI API key. Because Snaplex calls AI services directly from your browser (like Gemini, OpenAI, etc.), I don't provide a relay server. This means:\n• More Privacy: Images and data don't pass through third-party servers\n• More Transparency: You directly control AI service usage and costs\n• Configuration Required: You need to register with AI providers and obtain keys",
          tipTitle: "💡 AI Model Provider Guide",
          tipDesc: "Different models produce prompts of varying quality. Please compare and judge after use, and combine with free plans as needed~",
          table: [
            ["Provider", "Free Tier", "Best For"],
            ["Google", "Very limited daily quota (5/min, 20/day)", "Users who already have cards linked in Google AI Studio"],
            ["SiliconFlow", "GLM model free but slow; Qwen model fast with minimal token usage (20M tokens on signup = essentially free)", "Domestic users who want free usage"],
            ["OpenAI", "Pay-per-use", "Those who want GPT model and willing to pay for API"],
            ["Anthropic", "Pay-per-use", "Those who want Claude model and willing to pay for API"]
          ]
        },
        storage: {
          title: "2. Data Stored Locally in Your Browser",
          desc: "All images, analysis results, and chat history are saved in your browser's IndexedDB (storage limit depends on your browser and device). This means I cannot access any of your data, and even if the server goes down, your history is unaffected.",
          warning: "⚠️ Clearing browser cache = Losing ALL history",
          scenariosTitle: "Common triggering scenarios:",
          scenario1: "Manually clearing browser data",
          scenario2: "Using 'Private/Incognito Mode' (data cleared when window closes)",
          scenario3: "Browser updates or system reinstallation",
          scenario4: "Switching devices or browsers",
          backupTitle: "💾 Important: Back up regularly!",
          backupDesc: "Current version supports data export:",
          backupStep1: "1. Go to the Library page",
          backupStep2: "2. Click the Select button",
          backupStep3: "3. Select All or Select New (unexported) images and prompts",
          backupStep4: "4. Click Export button (Note: the button next to Export is Delete—don't click it by mistake!)",
          exportNote: "The exported form contains 3 columns: Column 1 is the image thumbnail, Column 2 is the front-side language prompt, Column 3 is the back-side language prompt."
        },
        hosting: {
          title: "3. Free Hosting, Occasionally Unavailable",
          desc: "Snaplex is deployed on free servers to remain completely free and open-source. Under normal circumstances, it's stable most of the time. In extreme cases (traffic surge), there may be brief access slowdowns or rate limiting due to free server bandwidth limits (100GB/month). I'll monitor traffic and provide backup links if necessary. You can also deploy it to your own server and run locally."
        }
      },
      quickstart: {
        title: "👉 Quick Start",
        stepsTitle: "4 Steps for First-Time Use",
        step1: {
          title: "Step 1",
          desc: "Go to Settings page, select the model provider and corresponding model, get your own API key and fill it in. The API key will be saved in masked form in your local browser (saved by default once filled). No need to repeat this operation afterwards."
        },
        step2: {
          title: "Step 2",
          desc: "Set system language and card front/back languages. Each image will get prompts in two languages based on current settings (supports 7 languages)."
        },
        step3: {
          title: "Step 3",
          desc: "Return to home page, drag or click to upload images to the yellow panel (you can upload multiple images at once) → Wait for AI to analyze → View structured prompts"
        },
        step4: {
          title: "Step 4",
          desc: "Copy the dimension prompts you want to reference, or one-click copy multiple dimension prompts. You can select the one-click copy range in Settings."
        },
        devNote: {
          title: "Developer Note",
          desc: "Each image has 6 dimension prompts: Subject, Environment, Composition, Lighting/Color, Mood/Atmosphere, Aesthetic Style.\n\nThis is because all AI image generation models demonstrate in advanced prompt cases that prompts containing these dimensions greatly improve AI image quality.\n\nThe reverse-engineering instructions I set in the system aim to make the model accurately restore these dimensions of the uploaded image with details. However, different models have varying adherence to instructions. I spent a lot of time testing prompt quality from different models. Now even free models produce decent quality, but there are still occasional inaccuracies (e.g., overhead shots recognized as eye-level). When using, it's recommended to review AI results and correct inaccuracies. This is also an important skill in collaborating with AI: the ability to review and correct AI outputs."
        },
        advanced: {
          title: "Explore Advanced Features",
          refresh: "Refresh Button: Regenerate prompts for a specific dimension",
          chat: "Chat Mode: Deeply inquire about visual details, explore tag usage, add your own preset tags",
          history: "History: Search past inspirations, extract prompt corpus",
          printer: "Term Printer: Mine professional terminology"
        }
      },
      practices: {
        title: "✨ Best Practices",
        backup: "Back up regularly",
        testKey: "Test API Key: Verify configuration with a simple image first",
        search: "Use Search: Library history supports fuzzy search",
        batch: "Batch Operations: Upload multiple images simultaneously"
      },
      faq: {
        title: "❓ FAQ",
        q1: "Is Snaplex free? Where might I need to pay?",
        a1: "The tool itself is free, but if you use paid API services, you pay the API fees directly to the model providers—I cannot profit from this (so I specifically integrated free APIs so you can use it completely free). My intention is just to share a small tool I developed, to verify whether I can make something valuable to others starting from my own needs.",
        q2: "Analysis failed or error. What's the cause? How to fix?",
        a2: "Check network connection, whether API Key is correctly filled, API Key validity, AI provider regional restrictions.\n• If it's a VPN issue, try switching VPN nodes. VPN nodes need to be clean and in the AI provider's accessible region.\n• If API key hit free usage limit, switch to a free AI model provider (SiliconFlow), or subscribe to paid API for advanced models.\n• Check if API key is entered incorrectly or mismatched with provider, such as extra spaces, or Google API entered under OpenAI.",
        q3: "How to switch language?",
        a3: "The purple panel on home page allows quick switching of interface language. For prompt card front/back languages, go to Settings page (supports Chinese/English/Japanese and 7 languages total).",
        q4: "Multiple dimension prompts failed to parse, showing 'N/A'?",
        a4: "Sometimes the model is lazy and doesn't return all field information. Just click the refresh button above the card that's missing prompts.",
        q5: "Will version updates cause previously queried data to disappear?",
        a5: "No, version updates won't clear your queried images and prompts, but system upgrades on your own device will. Please carefully read point 2 of Must Read Before Use regarding data storage and security.",
        q6: "What does Style Preference in settings do?",
        a6: "This is an entry I reserved for ideas not yet implemented. Currently, selecting different style preferences only affects the terminology preference of output prompts, but this module hasn't been extensively tested yet. Just select the default Standard style for now.",
        q7: "How to use preset tags in chat mode?",
        a7: "Click ➕ to customize your frequently used preset tags (such as useful image reverse-engineering instructions, prompts for extracting specific dimensions, etc.). All tags can be edited (right-click), deleted (long-press to activate delete state), and reordered (drag tags to your desired position, put frequently used ones at the front). After setting up tags, clicking a tag will send the corresponding question or instruction and get AI's answer based on the current image."
      },
      feedback: {
        title: "✉️ Feedback Channels",
        github: "GitHub Issues: Technical issues and feature suggestions",
        social: "Social Media: Share your usage experience, problems encountered, and useful prompts you reverse-engineered",
        meta: "Version: v9.5 | Updated: January 2026 | License: AGPL-3.0"
      }
    },
  },

  Japanese: {
    btnBack: "戻る", btnSave: "保存", btnCamera: "写真を撮る", btnUpload: "アップロード",
    homeTitle: "視覚からプロンプトへ", homeTitle2: "知識への入り口",
    homeMainTitle: "ビジョンからプロンプトへ",
    homeSubtitle1: "視覚的インスピレーションを",
    homeSubtitle2: "プロンプトライブラリへ",
    uploadDropHere: "ここに画像をドラッグ＆ドロップ",
    uploadDropIt: "ドロップ！",
    uploadClickBrowse: "またはクリックして一括アップロード",
    homeInstruction: "初めて使用する場合は、設定でAPIキーを入力してから、画像をアップロードして、詳細な視覚的インスピレーションを得てください。",
    errCamera: "カメラにアクセスできません。許可するか、アップロードを使用してください。",
    libraryTitle: "ライブラリ", searchPlaceholder: "検索 (例: 赤、クローズアップ)...", btnFind: "検索",
    btnSelect: "エクスポート", btnCancel: "キャンセル", btnSelectAll: "すべて", btnDeselectAll: "解除",
    btnSelectNew: "新規のみ", txtSelected: "選択済み", btnExport: "エクスポート", btnDelete: "削除",
    btnImport: "インポート", memoPlaceholder: "この画像についてメモを書いてください...",
    memoLabel: "メモ", memoTranslationLabel: "翻訳", memoPersonalNotes: "個人メモ",
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
    featureStructuredTitle: "構造化プロンプト",
    featureStructuredSubtitle: "任意の画像を再利用可能なプロンプト構造に分解",
    featureInsightTitle: "深層視覚分析",
    featureInsightSubtitle: "チャットモードでより多くの情報を発見",
    featureLibraryTitle: "パーソナライズされたプロンプトライブラリ",
    featureLibrarySubtitle: "セマンティック検索で過去のインスピレーションを検索",
    featureBatchTitle: "バッチ操作",
    featureBatchSubtitle: "複数の画像からプロンプトを一度に取得",
    featurePrinterTitle: "ビジュアル用語プリンター",
    featurePrinterSubtitle: "実際の画像から独自の視覚用語集を作成",
    featureLangTitle: "7言語サポート",
    featureLangSubtitle: "2言語でプロンプトを即座に生成",
    featureHistoryTitle: "ローカル履歴",
    featureHistorySubtitle: "即時アクセスと完全なプライバシーを備えたローカルストレージ",
    featureMiningTitle: "ディープビジュアルマイニング",
    featureMiningSubtitle: "正確なプロンプトを使用してAI画像生成の品質を向上させます",
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

    // Documentation
    doc: {
      intro: {
        title: "Welcome to Snaplex",
        greeting: "Thank you for your interest in Snaplex!",
        desc: "This is a free, open-source AI image analysis tool that runs entirely in your browser. It helps creators batch reverse-engineer image prompts, extract structured prompts, dive deeper into image details, and build personal visual prompt libraries.",
        personal: "Snaplex is a small tool I independently developed to solve some of my own troubles in the AI image generation process. I believe that accurate and effective prompts are valuable assets in collaboration with AI. I also hope that visual inspiration in life can be more easily applied and migrated. All features are built based on my understanding and value judgment of this matter. It's still being continuously improved, and I hope it brings you value. Thank you for your trust and support! Welcome to use it and give feedback, stay tuned~ 🙏",
        github: "GitHub Project: https://github.com/ginger4soda-netizen/Snaplex (If you find it useful, please give me a ⭐️)"
      },
      important: {
        title: "⚠️ Must Read Before Use",
        apiKey: {
          title: "1. You Need Your Own AI API Key",
          desc: "Snaplex is not a traditional SaaS service—it's a toolbox that requires your own AI API key. Because Snaplex calls AI services directly from your browser (like Gemini, OpenAI, etc.), I don't provide a relay server. This means:\n• More Privacy: Images and data don't pass through third-party servers\n• More Transparency: You directly control AI service usage and costs\n• Configuration Required: You need to register with AI providers and obtain keys",
          tipTitle: "💡 AI Model Provider Guide",
          tipDesc: "Different models produce prompts of varying quality. Please compare and judge after use, and combine with free plans as needed~",
          table: [
            ["Provider", "Free Tier", "Best For"],
            ["Google", "Very limited daily quota (5/min, 20/day)", "Users who already have cards linked in Google AI Studio"],
            ["SiliconFlow", "GLM model free but slow; Qwen model fast with minimal token usage (20M tokens on signup = essentially free)", "Domestic users who want free usage"],
            ["OpenAI", "Pay-per-use", "Those who want GPT model and willing to pay for API"],
            ["Anthropic", "Pay-per-use", "Those who want Claude model and willing to pay for API"]
          ]
        },
        storage: {
          title: "2. Data Stored Locally in Your Browser",
          desc: "All images, analysis results, and chat history are saved in your browser's IndexedDB (storage limit depends on your browser and device). This means I cannot access any of your data, and even if the server goes down, your history is unaffected.",
          warning: "⚠️ Clearing browser cache = Losing ALL history",
          scenariosTitle: "Common triggering scenarios:",
          scenario1: "Manually clearing browser data",
          scenario2: "Using 'Private/Incognito Mode' (data cleared when window closes)",
          scenario3: "Browser updates or system reinstallation",
          scenario4: "Switching devices or browsers",
          backupTitle: "💾 Important: Back up regularly!",
          backupDesc: "Current version supports data export:",
          backupStep1: "1. Go to the Library page",
          backupStep2: "2. Click the Select button",
          backupStep3: "3. Select All or Select New (unexported) images and prompts",
          backupStep4: "4. Click Export button (Note: the button next to Export is Delete—don't click it by mistake!)",
          exportNote: "The exported form contains 3 columns: Column 1 is the image thumbnail, Column 2 is the front-side language prompt, Column 3 is the back-side language prompt."
        },
        hosting: {
          title: "3. Free Hosting, Occasionally Unavailable",
          desc: "Snaplex is deployed on free servers to remain completely free and open-source. Under normal circumstances, it's stable most of the time. In extreme cases (traffic surge), there may be brief access slowdowns or rate limiting due to free server bandwidth limits (100GB/month). I'll monitor traffic and provide backup links if necessary. You can also deploy it to your own server and run locally."
        }
      },
      quickstart: {
        title: "👉 Quick Start",
        stepsTitle: "4 Steps for First-Time Use",
        step1: {
          title: "Step 1",
          desc: "Go to Settings page, select the model provider and corresponding model, get your own API key and fill it in. The API key will be saved in masked form in your local browser (saved by default once filled). No need to repeat this operation afterwards."
        },
        step2: {
          title: "Step 2",
          desc: "Set system language and card front/back languages. Each image will get prompts in two languages based on current settings (supports 7 languages)."
        },
        step3: {
          title: "Step 3",
          desc: "Return to home page, drag or click to upload images to the yellow panel (you can upload multiple images at once) → Wait for AI to analyze → View structured prompts"
        },
        step4: {
          title: "Step 4",
          desc: "Copy the dimension prompts you want to reference, or one-click copy multiple dimension prompts. You can select the one-click copy range in Settings."
        },
        devNote: {
          title: "Developer Note",
          desc: "Each image has 6 dimension prompts: Subject, Environment, Composition, Lighting/Color, Mood/Atmosphere, Aesthetic Style.\n\nThis is because all AI image generation models demonstrate in advanced prompt cases that prompts containing these dimensions greatly improve AI image quality.\n\nThe reverse-engineering instructions I set in the system aim to make the model accurately restore these dimensions of the uploaded image with details. However, different models have varying adherence to instructions. I spent a lot of time testing prompt quality from different models. Now even free models produce decent quality, but there are still occasional inaccuracies (e.g., overhead shots recognized as eye-level). When using, it's recommended to review AI results and correct inaccuracies. This is also an important skill in collaborating with AI: the ability to review and correct AI outputs."
        },
        advanced: {
          title: "Explore Advanced Features",
          refresh: "Refresh Button: Regenerate prompts for a specific dimension",
          chat: "Chat Mode: Deeply inquire about visual details, explore tag usage, add your own preset tags",
          history: "History: Search past inspirations, extract prompt corpus",
          printer: "Term Printer: Mine professional terminology"
        }
      },
      practices: {
        title: "✨ Best Practices",
        backup: "Back up regularly",
        testKey: "Test API Key: Verify configuration with a simple image first",
        search: "Use Search: Library history supports fuzzy search",
        batch: "Batch Operations: Upload multiple images simultaneously"
      },
      faq: {
        title: "❓ FAQ",
        q1: "Is Snaplex free? Where might I need to pay?",
        a1: "The tool itself is free, but if you use paid API services, you pay the API fees directly to the model providers—I cannot profit from this (so I specifically integrated free APIs so you can use it completely free). My intention is just to share a small tool I developed, to verify whether I can make something valuable to others starting from my own needs.",
        q2: "Analysis failed or error. What's the cause? How to fix?",
        a2: "Check network connection, whether API Key is correctly filled, API Key validity, AI provider regional restrictions.\n• If it's a VPN issue, try switching VPN nodes. VPN nodes need to be clean and in the AI provider's accessible region.\n• If API key hit free usage limit, switch to a free AI model provider (SiliconFlow), or subscribe to paid API for advanced models.\n• Check if API key is entered incorrectly or mismatched with provider, such as extra spaces, or Google API entered under OpenAI.",
        q3: "How to switch language?",
        a3: "The purple panel on home page allows quick switching of interface language. For prompt card front/back languages, go to Settings page (supports Chinese/English/Japanese and 7 languages total).",
        q4: "Multiple dimension prompts failed to parse, showing 'N/A'?",
        a4: "Sometimes the model is lazy and doesn't return all field information. Just click the refresh button above the card that's missing prompts.",
        q5: "Will version updates cause previously queried data to disappear?",
        a5: "No, version updates won't clear your queried images and prompts, but system upgrades on your own device will. Please carefully read point 2 of Must Read Before Use regarding data storage and security.",
        q6: "What does Style Preference in settings do?",
        a6: "This is an entry I reserved for ideas not yet implemented. Currently, selecting different style preferences only affects the terminology preference of output prompts, but this module hasn't been extensively tested yet. Just select the default Standard style for now.",
        q7: "How to use preset tags in chat mode?",
        a7: "Click ➕ to customize your frequently used preset tags (such as useful image reverse-engineering instructions, prompts for extracting specific dimensions, etc.). All tags can be edited (right-click), deleted (long-press to activate delete state), and reordered (drag tags to your desired position, put frequently used ones at the front). After setting up tags, clicking a tag will send the corresponding question or instruction and get AI's answer based on the current image."
      },
      feedback: {
        title: "✉️ Feedback Channels",
        github: "GitHub Issues: Technical issues and feature suggestions",
        social: "Social Media: Share your usage experience, problems encountered, and useful prompts you reverse-engineered",
        meta: "Version: v9.5 | Updated: January 2026 | License: AGPL-3.0"
      }
    },
  },

  French: {
    btnBack: "Retour", btnSave: "Enregistrer", btnCamera: "Prendre une Photo", btnUpload: "Upload",
    homeTitle: "De la Vision au Prompt", homeTitle2: "Passerelle vers la connaissance",
    homeMainTitle: "De Vision à Prompt",
    homeSubtitle1: "Transformez l'Inspiration Visuelle",
    homeSubtitle2: "en Bibliothèque de Prompts",
    uploadDropHere: "Glissez et déposez des images ici",
    uploadDropIt: "Déposez !",
    uploadClickBrowse: "ou cliquez pour le chargement par lot",
    homeInstruction: "Si c'est votre première fois, veuillez remplir la clé API dans les paramètres, puis téléchargez une image pour obtenir une inspiration visuelle approfondie.",
    errCamera: "Impossible d'accéder à la caméra. Autorisez l'accès ou utilisez l'Upload.",
    libraryTitle: "Votre Bibliothèque", searchPlaceholder: "Rechercher (ex: rouge, gros plan)...", btnFind: "Trouver",
    btnSelect: "Exporter", btnCancel: "Annuler", btnSelectAll: "Tout", btnDeselectAll: "Rien",
    btnSelectNew: "Nouveaux", txtSelected: "sélectionné", btnExport: "Exporter", btnDelete: "Supprimer",
    btnImport: "Importer", memoPlaceholder: "Notez vos remarques sur cette image...",
    memoLabel: "MÉMO", memoTranslationLabel: "TRADUCTION", memoPersonalNotes: "Notes Personnelles",
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
    featureStructuredTitle: "Prompt Structuré",
    featureStructuredSubtitle: "Décomposez n'importe quelle image en structure de prompt réutilisable",
    featureInsightTitle: "Analyse Visuelle Profonde",
    featureInsightSubtitle: "Découvrez plus d'infos en mode chat",
    featureLibraryTitle: "Bibliothèque de Prompts Personnalisée",
    featureLibrarySubtitle: "Trouvez des inspirations passées par recherche sémantique",
    featureBatchTitle: "Opérations par Lots",
    featureBatchSubtitle: "Obtenez des prompts de plusieurs images en une fois",
    featurePrinterTitle: "Imprimante de Termes Visuels",
    featurePrinterSubtitle: "Construisez votre propre glossaire visuel à partir d'images réelles",
    featureLangTitle: "Support 7 Langues",
    featureLangSubtitle: "Générez des prompts en 2 langues, instantanément",
    featureHistoryTitle: "Historique Local",
    featureHistorySubtitle: "Stockage local avec accès instantané et confidentialité totale",
    featureMiningTitle: "Exploration Visuelle Profonde",
    featureMiningSubtitle: "Utilisez des prompts précis pour améliorer la qualité de la génération d'images par l'IA",
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

    // Documentation
    doc: {
      intro: {
        title: "Welcome to Snaplex",
        greeting: "Thank you for your interest in Snaplex!",
        desc: "This is a free, open-source AI image analysis tool that runs entirely in your browser. It helps creators batch reverse-engineer image prompts, extract structured prompts, dive deeper into image details, and build personal visual prompt libraries.",
        personal: "Snaplex is a small tool I independently developed to solve some of my own troubles in the AI image generation process. I believe that accurate and effective prompts are valuable assets in collaboration with AI. I also hope that visual inspiration in life can be more easily applied and migrated. All features are built based on my understanding and value judgment of this matter. It's still being continuously improved, and I hope it brings you value. Thank you for your trust and support! Welcome to use it and give feedback, stay tuned~ 🙏",
        github: "GitHub Project: https://github.com/ginger4soda-netizen/Snaplex (If you find it useful, please give me a ⭐️)"
      },
      important: {
        title: "⚠️ Must Read Before Use",
        apiKey: {
          title: "1. You Need Your Own AI API Key",
          desc: "Snaplex is not a traditional SaaS service—it's a toolbox that requires your own AI API key. Because Snaplex calls AI services directly from your browser (like Gemini, OpenAI, etc.), I don't provide a relay server. This means:\n• More Privacy: Images and data don't pass through third-party servers\n• More Transparency: You directly control AI service usage and costs\n• Configuration Required: You need to register with AI providers and obtain keys",
          tipTitle: "💡 AI Model Provider Guide",
          tipDesc: "Different models produce prompts of varying quality. Please compare and judge after use, and combine with free plans as needed~",
          table: [
            ["Provider", "Free Tier", "Best For"],
            ["Google", "Very limited daily quota (5/min, 20/day)", "Users who already have cards linked in Google AI Studio"],
            ["SiliconFlow", "GLM model free but slow; Qwen model fast with minimal token usage (20M tokens on signup = essentially free)", "Domestic users who want free usage"],
            ["OpenAI", "Pay-per-use", "Those who want GPT model and willing to pay for API"],
            ["Anthropic", "Pay-per-use", "Those who want Claude model and willing to pay for API"]
          ]
        },
        storage: {
          title: "2. Data Stored Locally in Your Browser",
          desc: "All images, analysis results, and chat history are saved in your browser's IndexedDB (storage limit depends on your browser and device). This means I cannot access any of your data, and even if the server goes down, your history is unaffected.",
          warning: "⚠️ Clearing browser cache = Losing ALL history",
          scenariosTitle: "Common triggering scenarios:",
          scenario1: "Manually clearing browser data",
          scenario2: "Using 'Private/Incognito Mode' (data cleared when window closes)",
          scenario3: "Browser updates or system reinstallation",
          scenario4: "Switching devices or browsers",
          backupTitle: "💾 Important: Back up regularly!",
          backupDesc: "Current version supports data export:",
          backupStep1: "1. Go to the Library page",
          backupStep2: "2. Click the Select button",
          backupStep3: "3. Select All or Select New (unexported) images and prompts",
          backupStep4: "4. Click Export button (Note: the button next to Export is Delete—don't click it by mistake!)",
          exportNote: "The exported form contains 3 columns: Column 1 is the image thumbnail, Column 2 is the front-side language prompt, Column 3 is the back-side language prompt."
        },
        hosting: {
          title: "3. Free Hosting, Occasionally Unavailable",
          desc: "Snaplex is deployed on free servers to remain completely free and open-source. Under normal circumstances, it's stable most of the time. In extreme cases (traffic surge), there may be brief access slowdowns or rate limiting due to free server bandwidth limits (100GB/month). I'll monitor traffic and provide backup links if necessary. You can also deploy it to your own server and run locally."
        }
      },
      quickstart: {
        title: "👉 Quick Start",
        stepsTitle: "4 Steps for First-Time Use",
        step1: {
          title: "Step 1",
          desc: "Go to Settings page, select the model provider and corresponding model, get your own API key and fill it in. The API key will be saved in masked form in your local browser (saved by default once filled). No need to repeat this operation afterwards."
        },
        step2: {
          title: "Step 2",
          desc: "Set system language and card front/back languages. Each image will get prompts in two languages based on current settings (supports 7 languages)."
        },
        step3: {
          title: "Step 3",
          desc: "Return to home page, drag or click to upload images to the yellow panel (you can upload multiple images at once) → Wait for AI to analyze → View structured prompts"
        },
        step4: {
          title: "Step 4",
          desc: "Copy the dimension prompts you want to reference, or one-click copy multiple dimension prompts. You can select the one-click copy range in Settings."
        },
        devNote: {
          title: "Developer Note",
          desc: "Each image has 6 dimension prompts: Subject, Environment, Composition, Lighting/Color, Mood/Atmosphere, Aesthetic Style.\n\nThis is because all AI image generation models demonstrate in advanced prompt cases that prompts containing these dimensions greatly improve AI image quality.\n\nThe reverse-engineering instructions I set in the system aim to make the model accurately restore these dimensions of the uploaded image with details. However, different models have varying adherence to instructions. I spent a lot of time testing prompt quality from different models. Now even free models produce decent quality, but there are still occasional inaccuracies (e.g., overhead shots recognized as eye-level). When using, it's recommended to review AI results and correct inaccuracies. This is also an important skill in collaborating with AI: the ability to review and correct AI outputs."
        },
        advanced: {
          title: "Explore Advanced Features",
          refresh: "Refresh Button: Regenerate prompts for a specific dimension",
          chat: "Chat Mode: Deeply inquire about visual details, explore tag usage, add your own preset tags",
          history: "History: Search past inspirations, extract prompt corpus",
          printer: "Term Printer: Mine professional terminology"
        }
      },
      practices: {
        title: "✨ Best Practices",
        backup: "Back up regularly",
        testKey: "Test API Key: Verify configuration with a simple image first",
        search: "Use Search: Library history supports fuzzy search",
        batch: "Batch Operations: Upload multiple images simultaneously"
      },
      faq: {
        title: "❓ FAQ",
        q1: "Is Snaplex free? Where might I need to pay?",
        a1: "The tool itself is free, but if you use paid API services, you pay the API fees directly to the model providers—I cannot profit from this (so I specifically integrated free APIs so you can use it completely free). My intention is just to share a small tool I developed, to verify whether I can make something valuable to others starting from my own needs.",
        q2: "Analysis failed or error. What's the cause? How to fix?",
        a2: "Check network connection, whether API Key is correctly filled, API Key validity, AI provider regional restrictions.\n• If it's a VPN issue, try switching VPN nodes. VPN nodes need to be clean and in the AI provider's accessible region.\n• If API key hit free usage limit, switch to a free AI model provider (SiliconFlow), or subscribe to paid API for advanced models.\n• Check if API key is entered incorrectly or mismatched with provider, such as extra spaces, or Google API entered under OpenAI.",
        q3: "How to switch language?",
        a3: "The purple panel on home page allows quick switching of interface language. For prompt card front/back languages, go to Settings page (supports Chinese/English/Japanese and 7 languages total).",
        q4: "Multiple dimension prompts failed to parse, showing 'N/A'?",
        a4: "Sometimes the model is lazy and doesn't return all field information. Just click the refresh button above the card that's missing prompts.",
        q5: "Will version updates cause previously queried data to disappear?",
        a5: "No, version updates won't clear your queried images and prompts, but system upgrades on your own device will. Please carefully read point 2 of Must Read Before Use regarding data storage and security.",
        q6: "What does Style Preference in settings do?",
        a6: "This is an entry I reserved for ideas not yet implemented. Currently, selecting different style preferences only affects the terminology preference of output prompts, but this module hasn't been extensively tested yet. Just select the default Standard style for now.",
        q7: "How to use preset tags in chat mode?",
        a7: "Click ➕ to customize your frequently used preset tags (such as useful image reverse-engineering instructions, prompts for extracting specific dimensions, etc.). All tags can be edited (right-click), deleted (long-press to activate delete state), and reordered (drag tags to your desired position, put frequently used ones at the front). After setting up tags, clicking a tag will send the corresponding question or instruction and get AI's answer based on the current image."
      },
      feedback: {
        title: "✉️ Feedback Channels",
        github: "GitHub Issues: Technical issues and feature suggestions",
        social: "Social Media: Share your usage experience, problems encountered, and useful prompts you reverse-engineered",
        meta: "Version: v9.5 | Updated: January 2026 | License: AGPL-3.0"
      }
    },
  },

  German: {
    btnBack: "Zurück", btnSave: "Speichern", btnCamera: "Schnappschuss", btnUpload: "Upload",
    homeTitle: "Von Vision zu Prompt", homeTitle2: "Tor zum Wissen",
    homeMainTitle: "Vision zu Prompt",
    homeSubtitle1: "Verwandeln Sie visuelle Inspiration",
    homeSubtitle2: "in Prompt-Bibliothek",
    uploadDropHere: "Bilder hierher ziehen und ablegen",
    uploadDropIt: "Loslassen!",
    uploadClickBrowse: "oder klicken für Batch-Upload",
    homeInstruction: "Wenn Sie dies zum ersten Mal verwenden, geben Sie bitte zuerst den API-Schlüssel in den Einstellungen ein und laden Sie dann ein Bild hoch.",
    errCamera: "Kamera nicht verfügbar. Bitte Berechtigungen prüfen oder Upload nutzen.",
    libraryTitle: "Deine Bibliothek", searchPlaceholder: "Suchen (z.B. Rot, Nahaufnahme)...", btnFind: "Finden",
    btnSelect: "Export", btnCancel: "Abbrechen", btnSelectAll: "Alle", btnDeselectAll: "Keine",
    btnSelectNew: "Neue", txtSelected: "ausgewählt", btnExport: "Exportieren", btnDelete: "Löschen",
    btnImport: "Importieren", memoPlaceholder: "Notieren Sie Ihre Anmerkungen zu diesem Bild...",
    memoLabel: "MEMO", memoTranslationLabel: "ÜBERSETZUNG", memoPersonalNotes: "Persönliche Notizen",
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
    featureStructuredTitle: "Strukturierter Prompt",
    featureStructuredSubtitle: "Zerlegen Sie jedes Bild in eine wiederverwendbare Prompt-Struktur",
    featureInsightTitle: "Tiefgehende visuelle Analyse",
    featureInsightSubtitle: "Entdecken Sie mehr Infos im Chat-Modus",
    featureLibraryTitle: "Personalisierte Prompt-Bibliothek",
    featureLibrarySubtitle: "Finden Sie vergangene Inspirationen durch semantische Suche",
    featureBatchTitle: "Stapelverarbeitung",
    featureBatchSubtitle: "Erhalten Sie Prompts von mehreren Bildern auf einmal",
    featurePrinterTitle: "Visueller Begriffsdrucker",
    featurePrinterSubtitle: "Erstellen Sie Ihr eigenes visuelles Glossar aus echten Bildern",
    featureLangTitle: "7-Sprachen-Unterstützung",
    featureLangSubtitle: "Generieren Sie Prompts in 2 Sprachen, sofort",
    featureHistoryTitle: "Lokaler Verlauf",
    featureHistorySubtitle: "Lokaler Speicher mit sofortigem Zugriff und voller Privatsphäre",
    featureMiningTitle: "Tiefes Visuelles Mining",
    featureMiningSubtitle: "Nutzen Sie präzise Prompts zur Verbesserung der KI-Bildqualität",
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

    // Documentation
    doc: {
      intro: {
        title: "Welcome to Snaplex",
        greeting: "Thank you for your interest in Snaplex!",
        desc: "This is a free, open-source AI image analysis tool that runs entirely in your browser. It helps creators batch reverse-engineer image prompts, extract structured prompts, dive deeper into image details, and build personal visual prompt libraries.",
        personal: "Snaplex is a small tool I independently developed to solve some of my own troubles in the AI image generation process. I believe that accurate and effective prompts are valuable assets in collaboration with AI. I also hope that visual inspiration in life can be more easily applied and migrated. All features are built based on my understanding and value judgment of this matter. It's still being continuously improved, and I hope it brings you value. Thank you for your trust and support! Welcome to use it and give feedback, stay tuned~ 🙏",
        github: "GitHub Project: https://github.com/ginger4soda-netizen/Snaplex (If you find it useful, please give me a ⭐️)"
      },
      important: {
        title: "⚠️ Must Read Before Use",
        apiKey: {
          title: "1. You Need Your Own AI API Key",
          desc: "Snaplex is not a traditional SaaS service—it's a toolbox that requires your own AI API key. Because Snaplex calls AI services directly from your browser (like Gemini, OpenAI, etc.), I don't provide a relay server. This means:\n• More Privacy: Images and data don't pass through third-party servers\n• More Transparency: You directly control AI service usage and costs\n• Configuration Required: You need to register with AI providers and obtain keys",
          tipTitle: "💡 AI Model Provider Guide",
          tipDesc: "Different models produce prompts of varying quality. Please compare and judge after use, and combine with free plans as needed~",
          table: [
            ["Provider", "Free Tier", "Best For"],
            ["Google", "Very limited daily quota (5/min, 20/day)", "Users who already have cards linked in Google AI Studio"],
            ["SiliconFlow", "GLM model free but slow; Qwen model fast with minimal token usage (20M tokens on signup = essentially free)", "Domestic users who want free usage"],
            ["OpenAI", "Pay-per-use", "Those who want GPT model and willing to pay for API"],
            ["Anthropic", "Pay-per-use", "Those who want Claude model and willing to pay for API"]
          ]
        },
        storage: {
          title: "2. Data Stored Locally in Your Browser",
          desc: "All images, analysis results, and chat history are saved in your browser's IndexedDB (storage limit depends on your browser and device). This means I cannot access any of your data, and even if the server goes down, your history is unaffected.",
          warning: "⚠️ Clearing browser cache = Losing ALL history",
          scenariosTitle: "Common triggering scenarios:",
          scenario1: "Manually clearing browser data",
          scenario2: "Using 'Private/Incognito Mode' (data cleared when window closes)",
          scenario3: "Browser updates or system reinstallation",
          scenario4: "Switching devices or browsers",
          backupTitle: "💾 Important: Back up regularly!",
          backupDesc: "Current version supports data export:",
          backupStep1: "1. Go to the Library page",
          backupStep2: "2. Click the Select button",
          backupStep3: "3. Select All or Select New (unexported) images and prompts",
          backupStep4: "4. Click Export button (Note: the button next to Export is Delete—don't click it by mistake!)",
          exportNote: "The exported form contains 3 columns: Column 1 is the image thumbnail, Column 2 is the front-side language prompt, Column 3 is the back-side language prompt."
        },
        hosting: {
          title: "3. Free Hosting, Occasionally Unavailable",
          desc: "Snaplex is deployed on free servers to remain completely free and open-source. Under normal circumstances, it's stable most of the time. In extreme cases (traffic surge), there may be brief access slowdowns or rate limiting due to free server bandwidth limits (100GB/month). I'll monitor traffic and provide backup links if necessary. You can also deploy it to your own server and run locally."
        }
      },
      quickstart: {
        title: "👉 Quick Start",
        stepsTitle: "4 Steps for First-Time Use",
        step1: {
          title: "Step 1",
          desc: "Go to Settings page, select the model provider and corresponding model, get your own API key and fill it in. The API key will be saved in masked form in your local browser (saved by default once filled). No need to repeat this operation afterwards."
        },
        step2: {
          title: "Step 2",
          desc: "Set system language and card front/back languages. Each image will get prompts in two languages based on current settings (supports 7 languages)."
        },
        step3: {
          title: "Step 3",
          desc: "Return to home page, drag or click to upload images to the yellow panel (you can upload multiple images at once) → Wait for AI to analyze → View structured prompts"
        },
        step4: {
          title: "Step 4",
          desc: "Copy the dimension prompts you want to reference, or one-click copy multiple dimension prompts. You can select the one-click copy range in Settings."
        },
        devNote: {
          title: "Developer Note",
          desc: "Each image has 6 dimension prompts: Subject, Environment, Composition, Lighting/Color, Mood/Atmosphere, Aesthetic Style.\n\nThis is because all AI image generation models demonstrate in advanced prompt cases that prompts containing these dimensions greatly improve AI image quality.\n\nThe reverse-engineering instructions I set in the system aim to make the model accurately restore these dimensions of the uploaded image with details. However, different models have varying adherence to instructions. I spent a lot of time testing prompt quality from different models. Now even free models produce decent quality, but there are still occasional inaccuracies (e.g., overhead shots recognized as eye-level). When using, it's recommended to review AI results and correct inaccuracies. This is also an important skill in collaborating with AI: the ability to review and correct AI outputs."
        },
        advanced: {
          title: "Explore Advanced Features",
          refresh: "Refresh Button: Regenerate prompts for a specific dimension",
          chat: "Chat Mode: Deeply inquire about visual details, explore tag usage, add your own preset tags",
          history: "History: Search past inspirations, extract prompt corpus",
          printer: "Term Printer: Mine professional terminology"
        }
      },
      practices: {
        title: "✨ Best Practices",
        backup: "Back up regularly",
        testKey: "Test API Key: Verify configuration with a simple image first",
        search: "Use Search: Library history supports fuzzy search",
        batch: "Batch Operations: Upload multiple images simultaneously"
      },
      faq: {
        title: "❓ FAQ",
        q1: "Is Snaplex free? Where might I need to pay?",
        a1: "The tool itself is free, but if you use paid API services, you pay the API fees directly to the model providers—I cannot profit from this (so I specifically integrated free APIs so you can use it completely free). My intention is just to share a small tool I developed, to verify whether I can make something valuable to others starting from my own needs.",
        q2: "Analysis failed or error. What's the cause? How to fix?",
        a2: "Check network connection, whether API Key is correctly filled, API Key validity, AI provider regional restrictions.\n• If it's a VPN issue, try switching VPN nodes. VPN nodes need to be clean and in the AI provider's accessible region.\n• If API key hit free usage limit, switch to a free AI model provider (SiliconFlow), or subscribe to paid API for advanced models.\n• Check if API key is entered incorrectly or mismatched with provider, such as extra spaces, or Google API entered under OpenAI.",
        q3: "How to switch language?",
        a3: "The purple panel on home page allows quick switching of interface language. For prompt card front/back languages, go to Settings page (supports Chinese/English/Japanese and 7 languages total).",
        q4: "Multiple dimension prompts failed to parse, showing 'N/A'?",
        a4: "Sometimes the model is lazy and doesn't return all field information. Just click the refresh button above the card that's missing prompts.",
        q5: "Will version updates cause previously queried data to disappear?",
        a5: "No, version updates won't clear your queried images and prompts, but system upgrades on your own device will. Please carefully read point 2 of Must Read Before Use regarding data storage and security.",
        q6: "What does Style Preference in settings do?",
        a6: "This is an entry I reserved for ideas not yet implemented. Currently, selecting different style preferences only affects the terminology preference of output prompts, but this module hasn't been extensively tested yet. Just select the default Standard style for now.",
        q7: "How to use preset tags in chat mode?",
        a7: "Click ➕ to customize your frequently used preset tags (such as useful image reverse-engineering instructions, prompts for extracting specific dimensions, etc.). All tags can be edited (right-click), deleted (long-press to activate delete state), and reordered (drag tags to your desired position, put frequently used ones at the front). After setting up tags, clicking a tag will send the corresponding question or instruction and get AI's answer based on the current image."
      },
      feedback: {
        title: "✉️ Feedback Channels",
        github: "GitHub Issues: Technical issues and feature suggestions",
        social: "Social Media: Share your usage experience, problems encountered, and useful prompts you reverse-engineered",
        meta: "Version: v9.5 | Updated: January 2026 | License: AGPL-3.0"
      }
    },
  },

  Korean: {
    btnBack: "뒤로", btnSave: "저장", btnCamera: "스냅 촬영", btnUpload: "업로드",
    homeTitle: "비전에서 프롬프트로", homeTitle2: "지식으로 가는 관문",
    homeMainTitle: "비전에서 프롬프트로",
    homeSubtitle1: "시각적 영감을",
    homeSubtitle2: "프롬프트 라이브러리로",
    uploadDropHere: "이미지를 여기에 드래그 앤 드롭",
    uploadDropIt: "드롭!",
    uploadClickBrowse: "또는 클릭하여 일괄 업로드",
    homeInstruction: "처음 사용하는 경우 설정에서 API 키를 먼저 입력한 다음 이미지를 업로드하여 심층적인 시각적 영감을 얻으십시오.",
    errCamera: "카메라에 접근할 수 없습니다. 권한을 허용하거나 업로드를 사용하세요.",
    libraryTitle: "라이브러리", searchPlaceholder: "검색 (예: 빨강, 클로즈업)...", btnFind: "검색",
    btnSelect: "내보내기", btnCancel: "취소", btnSelectAll: "전체", btnDeselectAll: "해제",
    btnSelectNew: "새 항목", txtSelected: "선택됨", btnExport: "내보내기", btnDelete: "삭제",
    btnImport: "가져오기", memoPlaceholder: "이 이미지에 대한 메모를 작성하세요...",
    memoLabel: "메모", memoTranslationLabel: "번역", memoPersonalNotes: "개인 메모",
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
    featureStructuredTitle: "구조화된 프롬프트",
    featureStructuredSubtitle: "모든 이미지를 재사용 가능한 프롬프트 구조로 분해",
    featureInsightTitle: "심층 시각 분석",
    featureInsightSubtitle: "채팅 모드에서 더 많은 정보 발견",
    featureLibraryTitle: "개인화된 프롬프트 라이브러리",
    featureLibrarySubtitle: "의미 검색으로 과거 영감 찾기",
    featureBatchTitle: "일괄 작업",
    featureBatchSubtitle: "여러 이미지에서 한 번에 프롬프트 가져오기",
    featurePrinterTitle: "시각 용어 프린터",
    featurePrinterSubtitle: "실제 이미지로 나만의 시각 용어집 만들기",
    featureLangTitle: "7개 언어 지원",
    featureLangSubtitle: "2개 언어로 즉시 프롬프트 생성",
    featureHistoryTitle: "로컬 기록",
    featureHistorySubtitle: "즉시 액세스 및 완전한 개인정보 보호를 갖춘 로컬 스토리지",
    featureMiningTitle: "딥 비주얼 마이닝",
    featureMiningSubtitle: "정밀한 프롬프트를 사용하여 AI 이미지 생성 품질 향상",
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

    // Documentation
    doc: {
      intro: {
        title: "Welcome to Snaplex",
        greeting: "Thank you for your interest in Snaplex!",
        desc: "This is a free, open-source AI image analysis tool that runs entirely in your browser. It helps creators batch reverse-engineer image prompts, extract structured prompts, dive deeper into image details, and build personal visual prompt libraries.",
        personal: "Snaplex is a small tool I independently developed to solve some of my own troubles in the AI image generation process. I believe that accurate and effective prompts are valuable assets in collaboration with AI. I also hope that visual inspiration in life can be more easily applied and migrated. All features are built based on my understanding and value judgment of this matter. It's still being continuously improved, and I hope it brings you value. Thank you for your trust and support! Welcome to use it and give feedback, stay tuned~ 🙏",
        github: "GitHub Project: https://github.com/ginger4soda-netizen/Snaplex (If you find it useful, please give me a ⭐️)"
      },
      important: {
        title: "⚠️ Must Read Before Use",
        apiKey: {
          title: "1. You Need Your Own AI API Key",
          desc: "Snaplex is not a traditional SaaS service—it's a toolbox that requires your own AI API key. Because Snaplex calls AI services directly from your browser (like Gemini, OpenAI, etc.), I don't provide a relay server. This means:\n• More Privacy: Images and data don't pass through third-party servers\n• More Transparency: You directly control AI service usage and costs\n• Configuration Required: You need to register with AI providers and obtain keys",
          tipTitle: "💡 AI Model Provider Guide",
          tipDesc: "Different models produce prompts of varying quality. Please compare and judge after use, and combine with free plans as needed~",
          table: [
            ["Provider", "Free Tier", "Best For"],
            ["Google", "Very limited daily quota (5/min, 20/day)", "Users who already have cards linked in Google AI Studio"],
            ["SiliconFlow", "GLM model free but slow; Qwen model fast with minimal token usage (20M tokens on signup = essentially free)", "Domestic users who want free usage"],
            ["OpenAI", "Pay-per-use", "Those who want GPT model and willing to pay for API"],
            ["Anthropic", "Pay-per-use", "Those who want Claude model and willing to pay for API"]
          ]
        },
        storage: {
          title: "2. Data Stored Locally in Your Browser",
          desc: "All images, analysis results, and chat history are saved in your browser's IndexedDB (storage limit depends on your browser and device). This means I cannot access any of your data, and even if the server goes down, your history is unaffected.",
          warning: "⚠️ Clearing browser cache = Losing ALL history",
          scenariosTitle: "Common triggering scenarios:",
          scenario1: "Manually clearing browser data",
          scenario2: "Using 'Private/Incognito Mode' (data cleared when window closes)",
          scenario3: "Browser updates or system reinstallation",
          scenario4: "Switching devices or browsers",
          backupTitle: "💾 Important: Back up regularly!",
          backupDesc: "Current version supports data export:",
          backupStep1: "1. Go to the Library page",
          backupStep2: "2. Click the Select button",
          backupStep3: "3. Select All or Select New (unexported) images and prompts",
          backupStep4: "4. Click Export button (Note: the button next to Export is Delete—don't click it by mistake!)",
          exportNote: "The exported form contains 3 columns: Column 1 is the image thumbnail, Column 2 is the front-side language prompt, Column 3 is the back-side language prompt."
        },
        hosting: {
          title: "3. Free Hosting, Occasionally Unavailable",
          desc: "Snaplex is deployed on free servers to remain completely free and open-source. Under normal circumstances, it's stable most of the time. In extreme cases (traffic surge), there may be brief access slowdowns or rate limiting due to free server bandwidth limits (100GB/month). I'll monitor traffic and provide backup links if necessary. You can also deploy it to your own server and run locally."
        }
      },
      quickstart: {
        title: "👉 Quick Start",
        stepsTitle: "4 Steps for First-Time Use",
        step1: {
          title: "Step 1",
          desc: "Go to Settings page, select the model provider and corresponding model, get your own API key and fill it in. The API key will be saved in masked form in your local browser (saved by default once filled). No need to repeat this operation afterwards."
        },
        step2: {
          title: "Step 2",
          desc: "Set system language and card front/back languages. Each image will get prompts in two languages based on current settings (supports 7 languages)."
        },
        step3: {
          title: "Step 3",
          desc: "Return to home page, drag or click to upload images to the yellow panel (you can upload multiple images at once) → Wait for AI to analyze → View structured prompts"
        },
        step4: {
          title: "Step 4",
          desc: "Copy the dimension prompts you want to reference, or one-click copy multiple dimension prompts. You can select the one-click copy range in Settings."
        },
        devNote: {
          title: "Developer Note",
          desc: "Each image has 6 dimension prompts: Subject, Environment, Composition, Lighting/Color, Mood/Atmosphere, Aesthetic Style.\n\nThis is because all AI image generation models demonstrate in advanced prompt cases that prompts containing these dimensions greatly improve AI image quality.\n\nThe reverse-engineering instructions I set in the system aim to make the model accurately restore these dimensions of the uploaded image with details. However, different models have varying adherence to instructions. I spent a lot of time testing prompt quality from different models. Now even free models produce decent quality, but there are still occasional inaccuracies (e.g., overhead shots recognized as eye-level). When using, it's recommended to review AI results and correct inaccuracies. This is also an important skill in collaborating with AI: the ability to review and correct AI outputs."
        },
        advanced: {
          title: "Explore Advanced Features",
          refresh: "Refresh Button: Regenerate prompts for a specific dimension",
          chat: "Chat Mode: Deeply inquire about visual details, explore tag usage, add your own preset tags",
          history: "History: Search past inspirations, extract prompt corpus",
          printer: "Term Printer: Mine professional terminology"
        }
      },
      practices: {
        title: "✨ Best Practices",
        backup: "Back up regularly",
        testKey: "Test API Key: Verify configuration with a simple image first",
        search: "Use Search: Library history supports fuzzy search",
        batch: "Batch Operations: Upload multiple images simultaneously"
      },
      faq: {
        title: "❓ FAQ",
        q1: "Is Snaplex free? Where might I need to pay?",
        a1: "The tool itself is free, but if you use paid API services, you pay the API fees directly to the model providers—I cannot profit from this (so I specifically integrated free APIs so you can use it completely free). My intention is just to share a small tool I developed, to verify whether I can make something valuable to others starting from my own needs.",
        q2: "Analysis failed or error. What's the cause? How to fix?",
        a2: "Check network connection, whether API Key is correctly filled, API Key validity, AI provider regional restrictions.\n• If it's a VPN issue, try switching VPN nodes. VPN nodes need to be clean and in the AI provider's accessible region.\n• If API key hit free usage limit, switch to a free AI model provider (SiliconFlow), or subscribe to paid API for advanced models.\n• Check if API key is entered incorrectly or mismatched with provider, such as extra spaces, or Google API entered under OpenAI.",
        q3: "How to switch language?",
        a3: "The purple panel on home page allows quick switching of interface language. For prompt card front/back languages, go to Settings page (supports Chinese/English/Japanese and 7 languages total).",
        q4: "Multiple dimension prompts failed to parse, showing 'N/A'?",
        a4: "Sometimes the model is lazy and doesn't return all field information. Just click the refresh button above the card that's missing prompts.",
        q5: "Will version updates cause previously queried data to disappear?",
        a5: "No, version updates won't clear your queried images and prompts, but system upgrades on your own device will. Please carefully read point 2 of Must Read Before Use regarding data storage and security.",
        q6: "What does Style Preference in settings do?",
        a6: "This is an entry I reserved for ideas not yet implemented. Currently, selecting different style preferences only affects the terminology preference of output prompts, but this module hasn't been extensively tested yet. Just select the default Standard style for now.",
        q7: "How to use preset tags in chat mode?",
        a7: "Click ➕ to customize your frequently used preset tags (such as useful image reverse-engineering instructions, prompts for extracting specific dimensions, etc.). All tags can be edited (right-click), deleted (long-press to activate delete state), and reordered (drag tags to your desired position, put frequently used ones at the front). After setting up tags, clicking a tag will send the corresponding question or instruction and get AI's answer based on the current image."
      },
      feedback: {
        title: "✉️ Feedback Channels",
        github: "GitHub Issues: Technical issues and feature suggestions",
        social: "Social Media: Share your usage experience, problems encountered, and useful prompts you reverse-engineered",
        meta: "Version: v9.5 | Updated: January 2026 | License: AGPL-3.0"
      }
    },
  }
};

// 2. 智能匹配助手
export const getTranslation = (langString: string | undefined) => {
  if (!langString) return translations.English;
  const key = langString.split(' ')[0]; // 例如 "Chinese (中文)" -> "Chinese"
  return (translations as any)[key] || translations.English;
};