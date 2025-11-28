import React from 'react';

export type TermTheme = 'coral' | 'sunny' | 'blue';

export interface TermContent {
  term: string;
  def: string;
  app: string;
}

export interface AestheticTerm {
  id: string;
  category: string; // ✅ 新增：分类字段 (如 Style, Lighting)
  theme: TermTheme;
  visualStyle: React.CSSProperties;
  languages: {
    [key: string]: TermContent;
  };
}

export const AESTHETIC_TERMS: AestheticTerm[] = [
  // --- 🔴 Memphis ---
  {
    id: "memphis",
    category: "Style", // ✅ 分类
    theme: "coral",
    visualStyle: {
      backgroundColor: "#fff1f2",
      backgroundImage: `radial-gradient(#FFD166 20%, transparent 20%), radial-gradient(#EF476F 20%, transparent 20%)`,
      backgroundSize: "20px 20px, 20px 20px",
      backgroundPosition: "0 0, 10px 10px"
    },
    languages: {
      English: { 
        term: "Memphis Style", 
        def: "Characterized by bold, vibrant colors, clashing patterns, and irregular geometric shapes. It rejects minimalism.",
        app: "Used in 80s graphic design, furniture, modern packaging, and playful UI interfaces."
      },
      Chinese: { 
        term: "孟菲斯风格", 
        def: "以大胆鲜艳的色彩、冲突的图案和不规则几何形状为特征。它反对极简主义，强调装饰性。",
        app: "常见于80年代平面设计、家具设计、现代潮牌包装及活泼的UI界面。"
      }
    }
  },
  // --- 🔴 Bauhaus ---
  {
    id: "bauhaus",
    category: "Style",
    theme: "coral",
    visualStyle: {
      backgroundColor: "#f5f5f4",
      backgroundImage: `linear-gradient(90deg, #EF476F 33%, #FFD166 33%, #FFD166 66%, #118AB2 66%)`,
      backgroundSize: "100% 10px",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center"
    },
    languages: {
      English: { 
        term: "Bauhaus", 
        def: "Form follows function. Features clean lines, primary colors (red/blue/yellow), and geometric balance.",
        app: "Foundational in modern architecture, web layout grids, and minimalist typography."
      },
      Chinese: { 
        term: "包豪斯", 
        def: "形式追随功能。特征是简洁的线条、三原色（红黄蓝）的使用以及几何平衡感。",
        app: "现代建筑、网页栅格布局和极简排版设计的基石。"
      }
    }
  },
  // --- 🔴 Surrealism ---
  {
    id: "surrealism",
    category: "Style",
    theme: "coral",
    visualStyle: {
      background: "linear-gradient(135deg, #EECDA3 0%, #EF629F 100%)"
    },
    languages: {
      English: { 
        term: "Surrealism", 
        def: "Dream-like visuals blending reality with bizarre, illogical elements. Juxtaposition of unrelated objects.",
        app: "High fashion photography, conceptual advertising, and creative music videos."
      },
      Chinese: { 
        term: "超现实主义", 
        def: "如梦境般的视觉效果，将现实与怪诞、非逻辑元素融合。常使用不相关物体的并置。",
        app: "常见于高级时尚摄影、概念广告和创意MV中。"
      }
    }
  },

  // --- 🟡 Chiaroscuro ---
  {
    id: "chiaroscuro",
    category: "Lighting", // ✅ 分类
    theme: "sunny",
    visualStyle: {
      background: "radial-gradient(circle at center, #FFD166 10%, #1c1917 60%)"
    },
    languages: {
      English: { 
        term: "Chiaroscuro", 
        def: "Strong contrast between light and dark to create volume, depth, and dramatic tension.",
        app: "Portrait photography, moody cinema lighting (Film Noir), and dramatic rendering."
      },
      Chinese: { 
        term: "明暗对照法", 
        def: "通过强烈的光影对比来创造体积感、深度和戏剧张力。",
        app: "用于人像摄影、情绪化电影布光（如黑色电影）和戏剧性渲染。"
      }
    }
  },
  // --- 🟡 Rule of Thirds ---
  {
    id: "rule_of_thirds",
    category: "Composition", // ✅ 分类
    theme: "sunny",
    visualStyle: {
      backgroundColor: "#fff",
      backgroundImage: `linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)`,
      backgroundSize: "33% 33%",
      backgroundPosition: "center center"
    },
    languages: {
      English: { 
        term: "Rule of Thirds", 
        def: "Dividing the frame into a 3x3 grid. Placing subjects on lines or intersections creates balance.",
        app: "The golden rule for landscape photography, cinematography framing, and UI layout."
      },
      Chinese: { 
        term: "三分法构图", 
        def: "将画面分割为3x3网格。将主体放置在网格线或交点上，以创造视觉平衡。",
        app: "风景摄影、电影运镜和UI布局设计的黄金法则。"
      }
    }
  },
  // --- 🟡 Bokeh ---
  {
    id: "bokeh",
    category: "Lighting", // ✅ 分类
    theme: "sunny",
    visualStyle: {
      background: "radial-gradient(circle at 30% 30%, rgba(255,209,102,0.8) 0%, transparent 20%), radial-gradient(circle at 70% 70%, rgba(255,209,102,0.6) 0%, transparent 30%)",
      backgroundColor: "#fef3c7",
      filter: "blur(4px)"
    },
    languages: {
      English: { 
        term: "Bokeh", 
        def: "The aesthetic quality of the blur in out-of-focus areas, often rendering lights as soft circles.",
        app: "Portrait mode, product photography to isolate subjects, and macro shots."
      },
      Chinese: { 
        term: "焦外散景", 
        def: "影像中焦外模糊部分的美学质量，通常将点光源渲染为柔和的光斑。",
        app: "常用于人像模式、产品摄影（突出主体）和微距摄影。"
      }
    }
  },

  // --- 🔵 Cyberpunk ---
  {
    id: "cyberpunk",
    category: "Style",
    theme: "blue",
    visualStyle: {
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      boxShadow: "inset 0 0 20px #0ff"
    },
    languages: {
      English: { 
        term: "Cyberpunk", 
        def: "High-tech, low-life. Features neon lights (purple/cyan), rain, circuitry, and dystopian urban vibes.",
        app: "Sci-fi game design, futuristic concept art, and tech-focused branding."
      },
      Chinese: { 
        term: "赛博朋克", 
        def: "高科技，低生活。特征包括霓虹灯（紫/青色）、雨水、电路板纹理和反乌托邦城市氛围。",
        app: "科幻游戏设计、未来主义概念艺术和科技品牌视觉。"
      }
    }
  },
  // --- 🔵 Film Noir ---
  {
    id: "film_noir",
    category: "Style",
    theme: "blue",
    visualStyle: {
      background: "repeating-linear-gradient(45deg, #1c1917, #1c1917 10px, #44403c 10px, #44403c 20px)"
    },
    languages: {
      English: { 
        term: "Film Noir", 
        def: "Stylized crime drama aesthetic. High contrast black & white, venetian blind shadows, and silhouettes.",
        app: "Mystery storytelling, retro posters, and atmospheric black & white photography."
      },
      Chinese: { 
        term: "黑色电影", 
        def: "风格化的犯罪题材美学。高反差黑白画面、百叶窗阴影和剪影效果。",
        app: "悬疑叙事、复古海报设计和氛围感黑白摄影。"
      }
    }
  },
  // --- 🔵 Vaporwave ---
  {
    id: "vaporwave",
    category: "Style",
    theme: "blue",
    visualStyle: {
      background: "linear-gradient(to bottom, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)"
    },
    languages: {
      English: { 
        term: "Vaporwave", 
        def: "80s/90s nostalgia mixed with surrealism. Pastel neon, glitches, Greek statues, and old computer UI.",
        app: "Retro-futuristic art, music album covers, and internet subculture visuals."
      },
      Chinese: { 
        term: "蒸气波", 
        def: "80/90年代怀旧与超现实主义的混合。粉彩霓虹、故障效果、希腊雕像和旧电脑界面。",
        app: "复古未来主义艺术、音乐专辑封面和网络亚文化视觉。"
      }
    }
  }
];

export const getRandomTerm = (systemLanguage: string = 'English'): { term: TermContent, theme: TermTheme, id: string, category: string, visualStyle: React.CSSProperties } => {
  const randomItem = AESTHETIC_TERMS[Math.floor(Math.random() * AESTHETIC_TERMS.length)];
  const langKey = systemLanguage.split(' ')[0];
  const content = randomItem.languages[langKey] || randomItem.languages['English'];
  
  return {
    term: content,
    theme: randomItem.theme,
    id: randomItem.id,
    category: randomItem.category, // ✅ 返回分类
    visualStyle: randomItem.visualStyle
  };
};