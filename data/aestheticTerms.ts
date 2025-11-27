// src/data/aestheticTerms.ts

export type TermTheme = 'coral' | 'sunny' | 'blue';

export interface TermContent {
  term: string; // 术语名称
  desc: string; // 详细解释
}

export interface AestheticTerm {
  id: string;
  theme: TermTheme; // 决定 UI 主色调
  visualStyle: React.CSSProperties; // ✨ 新增：CSS 视觉皮肤 (背景图/渐变)
  languages: {
    [key: string]: TermContent;
  };
}

export const AESTHETIC_TERMS: AestheticTerm[] = [
  // --- 🔴 Memphis (Bold, Geometric) ---
  {
    id: "memphis",
    theme: "coral",
    visualStyle: {
      backgroundColor: "#fff1f2",
      backgroundImage: `radial-gradient(#FFD166 20%, transparent 20%), radial-gradient(#EF476F 20%, transparent 20%)`,
      backgroundSize: "20px 20px, 20px 20px",
      backgroundPosition: "0 0, 10px 10px"
    },
    languages: {
      English: { term: "Memphis", desc: "Characterized by bold, vibrant colors, irregular combinations of geometric shapes, and Pop Art elements." },
      Chinese: { term: "孟菲斯风格", desc: "以大胆鲜艳的色彩、不规则的几何图形组合和波普艺术元素为特征，充满活力与叛逆感。" },
      Spanish: { term: "Memphis", desc: "Caracterizado por colores vibrantes, formas geométricas y elementos del Pop Art." },
      Japanese: { term: "メンフィス", desc: "大胆で鮮やかな色、幾何学模様、ポップアートの要素が特徴です。" },
      French: { term: "Memphis", desc: "Caractérisé par des couleurs vives, des formes géométriques et des éléments Pop Art." },
      German: { term: "Memphis", desc: "Gekennzeichnet durch kräftige Farben, geometrische Formen und Pop-Art-Elemente." },
      Korean: { term: "멤피스", desc: "대담하고 생생한 색상, 기하학적 형태, 팝아트 요소가 특징입니다." }
    }
  },
  // --- 🔴 Bauhaus (Minimal, Primary Colors) ---
  {
    id: "bauhaus",
    theme: "coral",
    visualStyle: {
      backgroundColor: "#f5f5f4",
      backgroundImage: `linear-gradient(90deg, #EF476F 33%, #FFD166 33%, #FFD166 66%, #118AB2 66%)`,
      backgroundSize: "100% 10px",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center"
    },
    languages: {
      English: { term: "Bauhaus", desc: "Form follows function. Minimalist, geometric, and balanced design using primary colors." },
      Chinese: { term: "包豪斯", desc: "形式追随功能。强调极简、几何感与平衡，常使用红黄蓝三原色的现代主义设计美学。" },
      Spanish: { term: "Bauhaus", desc: "La forma sigue a la función. Diseño minimalista, geométrico y equilibrado." },
      Japanese: { term: "バウハウス", desc: "形態は機能に従う。ミニマリストで幾何学的、バランスの取れたデザイン。" },
      French: { term: "Bauhaus", desc: "La forme suit la fonction. Design minimaliste, géométrique et équilibré." },
      German: { term: "Bauhaus", desc: "Form folgt Funktion. Minimalistisches, geometrisches und ausgewogenes Design." },
      Korean: { term: "바우하우스", desc: "형태는 기능을 따릅니다. 미니멀하고 기하학적이며 균형 잡힌 디자인." }
    }
  },
  // --- 🔴 Surrealism (Dreamy) ---
  {
    id: "surrealism",
    theme: "coral",
    visualStyle: {
      background: "linear-gradient(135deg, #EECDA3 0%, #EF629F 100%)"
    },
    languages: {
      English: { term: "Surrealism", desc: "Dream-like visuals, illogical scenes, and juxtaposition of unrelated objects." },
      Chinese: { term: "超现实主义", desc: "如梦境般的视觉效果，非逻辑的场景，以及不相关物体的奇异并置。" },
      Spanish: { term: "Surrealismo", desc: "Visuales oníricos, escenas ilógicas y yuxtaposición de objetos no relacionados." },
      Japanese: { term: "シュルレアリスム", desc: "夢のような視覚効果、非論理的な場面、無関係な物体の並置。" },
      French: { term: "Surréalisme", desc: "Visuels oniriques, scènes illogiques et juxtaposition d'objets sans rapport." },
      German: { term: "Surrealismus", desc: "Traumhafte Bilder, unlogische Szenen und Gegenüberstellung unzusammenhängender Objekte." },
      Korean: { term: "초현실주의", desc: "꿈같은 시각 효과, 비논리적인 장면, 관련 없는 사물의 병치." }
    }
  },

  // --- 🟡 Chiaroscuro (High Contrast) ---
  {
    id: "chiaroscuro",
    theme: "sunny",
    visualStyle: {
      background: "radial-gradient(circle at center, #FFD166 10%, #1c1917 60%)"
    },
    languages: {
      English: { term: "Chiaroscuro", desc: "Strong contrast between light and dark to create volume and drama." },
      Chinese: { term: "明暗对照法", desc: "通过强烈的光影对比来创造体积感和戏剧性的视觉效果。" },
      Spanish: { term: "Claroscuro", desc: "Fuerte contraste entre luz y oscuridad para crear volumen y drama." },
      Japanese: { term: "キアロスクーロ", desc: "光と闇の強いコントラストを用いて、立体感とドラマを生み出します。" },
      French: { term: "Clair-obscur", desc: "Fort contraste entre clair et obscur pour créer du volume et du drame." },
      German: { term: "Chiaroscuro", desc: "Starker Kontrast zwischen Hell und Dunkel zur Erzeugung von Volumen und Dramatik." },
      Korean: { term: "키아로스쿠로", desc: "빛과 어둠의 강한 대비를 통해 볼륨감과 드라마를 연출합니다." }
    }
  },
  // --- 🟡 Rule of Thirds (Grid) ---
  {
    id: "rule_of_thirds",
    theme: "sunny",
    visualStyle: {
      backgroundColor: "#fff",
      backgroundImage: `linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)`,
      backgroundSize: "33% 33%",
      backgroundPosition: "center center"
    },
    languages: {
      English: { term: "Rule of Thirds", desc: "Placing the subject on grid lines or intersections for balanced composition." },
      Chinese: { term: "三分法构图", desc: "将主体放置在网格线或交点上，创造平衡且自然的构图。" },
      Spanish: { term: "Regla de Tercios", desc: "Colocar el sujeto en líneas de cuadrícula o intersecciones para equilibrar." },
      Japanese: { term: "三分割法", desc: "被写体をグリッド線または交点に配置し、バランスの取れた構図を作ります。" },
      French: { term: "Règle des Tiers", desc: "Placer le sujet sur les lignes de grille pour une composition équilibrée." },
      German: { term: "Drittel-Regel", desc: "Platzierung des Motivs auf Rasterlinien für eine ausgewogene Komposition." },
      Korean: { term: "삼분할 법칙", desc: "피사체를 격자선이나 교차점에 배치하여 균형 잡힌 구도를 만듭니다." }
    }
  },
  // --- 🟡 Bokeh (Blur) ---
  {
    id: "bokeh",
    theme: "sunny",
    visualStyle: {
      background: "radial-gradient(circle at 30% 30%, rgba(255,209,102,0.8) 0%, transparent 20%), radial-gradient(circle at 70% 70%, rgba(255,209,102,0.6) 0%, transparent 30%)",
      backgroundColor: "#fef3c7",
      filter: "blur(4px)"
    },
    languages: {
      English: { term: "Bokeh", desc: "The aesthetic quality of the blur produced in the out-of-focus parts of an image." },
      Chinese: { term: "焦外散景", desc: "影像中焦外模糊部分产生的独特美学质量，常呈现柔和的光斑。" },
      Spanish: { term: "Bokeh", desc: "La calidad estética del desenfoque producido en las partes fuera de foco." },
      Japanese: { term: "ボケ味", desc: "画像の焦点が合っていない部分に生じるぼけの美的品質。" },
      French: { term: "Bokeh", desc: "La qualité esthétique du flou produit dans les parties hors foyer d'une image." },
      German: { term: "Bokeh", desc: "Die ästhetische Qualität der Unschärfe in den unscharfen Bereichen eines Bildes." },
      Korean: { term: "보케", desc: "이미지의 초점이 맞지 않는 부분에서 생성되는 흐림의 미적 품질." }
    }
  },

  // --- 🔵 Cyberpunk (Neon) ---
  {
    id: "cyberpunk",
    theme: "blue",
    visualStyle: {
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      boxShadow: "inset 0 0 20px #0ff"
    },
    languages: {
      English: { term: "Cyberpunk", desc: "High-tech low-life. Neon lights, rain, cybernetics, and dystopian cities." },
      Chinese: { term: "赛博朋克", desc: "高科技，低生活。充满霓虹灯、雨水、机械义肢和反乌托邦城市的氛围。" },
      Spanish: { term: "Cyberpunk", desc: "Alta tecnología, baja calidad de vida. Luces de neón, lluvia y distopía." },
      Japanese: { term: "サイバーパンク", desc: "ハイテク・ローライフ。ネオン、雨、サイバネティクス、ディストピア都市。" },
      French: { term: "Cyberpunk", desc: "High-tech, low-life. Néons, pluie, cybernétique et villes dystopiques." },
      German: { term: "Cyberpunk", desc: "High-Tech Low-Life. Neonlichter, Regen, Kybernetik und dystopische Städte." },
      Korean: { term: "사이버펑크", desc: "하이테크 로우라이프. 네온 사인, 비, 사이버네틱스, 디스토피아 도시." }
    }
  },
  // --- 🔵 Film Noir (Black & White) ---
  {
    id: "film_noir",
    theme: "blue",
    visualStyle: {
      background: "repeating-linear-gradient(45deg, #1c1917, #1c1917 10px, #44403c 10px, #44403c 20px)"
    },
    languages: {
      English: { term: "Film Noir", desc: "Stylized crime dramas. High contrast lighting, shadows, silhouettes, and cynicism." },
      Chinese: { term: "黑色电影", desc: "风格化的犯罪题材。高反差光影、阴影、剪影以及愤世嫉俗的基调。" },
      Spanish: { term: "Cine Negro", desc: "Dramas criminales estilizados. Iluminación de alto contraste, sombras y cinismo." },
      Japanese: { term: "フィルム・ノワール", desc: "様式化された犯罪ドラマ。高コントラストの照明、影、シルエット。" },
      French: { term: "Film Noir", desc: "Drames policiers stylisés. Éclairage à fort contraste, ombres et cynisme." },
      German: { term: "Film Noir", desc: "Stilisierte Kriminaldramen. Kontrastreiche Beleuchtung, Schatten und Zynismus." },
      Korean: { term: "필름 누아르", desc: "양식화된 범죄 드라마. 높은 대비의 조명, 그림자, 실루엣, 냉소주의." }
    }
  },
  // --- 🔵 Vaporwave (Pastel Neon) ---
  {
    id: "vaporwave",
    theme: "blue",
    visualStyle: {
      background: "linear-gradient(to bottom, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)"
    },
    languages: {
      English: { term: "Vaporwave", desc: "80s/90s nostalgia, pastel neon, glitches, anime aesthetics, and surreal consumerism." },
      Chinese: { term: "蒸气波", desc: "80/90年代怀旧，粉彩霓虹，故障艺术，动漫美学与超现实消费主义。" },
      Spanish: { term: "Vaporwave", desc: "Nostalgia 80s/90s, neón pastel, glitches, estética anime y consumismo surrealista." },
      Japanese: { term: "ヴェイパーウェイヴ", desc: "80/90年代ノスタルジー、パステルネオン、グリッチ、アニメ美学。" },
      French: { term: "Vaporwave", desc: "Nostalgie 80s/90s, néon pastel, glitches, esthétique anime et surréalisme." },
      German: { term: "Vaporwave", desc: "80er/90er Nostalgie, Pastell-Neon, Glitches und surrealer Konsumismus." },
      Korean: { term: "베이퍼웨이브", desc: "80/90년대 향수, 파스텔 네온, 글리치, 애니메이션 미학." }
    }
  }
];

// 辅助函数：根据系统语言获取随机术语
export const getRandomTerm = (systemLanguage: string = 'English'): { term: TermContent, theme: TermTheme, id: string, visualStyle: React.CSSProperties } => {
  const randomItem = AESTHETIC_TERMS[Math.floor(Math.random() * AESTHETIC_TERMS.length)];
  const langKey = systemLanguage.split(' ')[0];
  const content = randomItem.languages[langKey] || randomItem.languages['English'];
  
  return {
    term: content,
    theme: randomItem.theme,
    id: randomItem.id,
    visualStyle: randomItem.visualStyle // ✅ 现在返回视觉样式了
  };
};