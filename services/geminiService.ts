import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, UserSettings, ChatMessage, HistoryItem } from "../types";

// Instantiate with default environment key
const ai = new GoogleGenAI({ apiKey: 'AIzaSyBFgYGbUZUbnaiFIKiGK5QzwW-DC3M1ANQ' });

// --- Schemas ---

const promptSegmentSchema = {
  type: Type.OBJECT,
  properties: {
    original: { type: Type.STRING, description: "The content in the requested Prompt Text language (e.g., English)." },
    translated: { type: Type.STRING, description: "The content translated into the requested Target Language (e.g., Chinese)." },
  },
  required: ["original", "translated"]
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING, description: "A short, 1-sentence summary of the image content." },
    structuredPrompts: {
      type: Type.OBJECT,
      properties: {
        subject: promptSegmentSchema,
        environment: promptSegmentSchema,
        composition: promptSegmentSchema,
        lighting: promptSegmentSchema,
        mood: promptSegmentSchema,
        style: promptSegmentSchema,
      }
    },
  },
  required: ["description", "structuredPrompts"],
};

// --- API Functions ---

export const analyzeImage = async (
  base64Image: string, 
  settings: UserSettings
): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1],
            },
          },
          {
            text: `You are a Expert Prompt Engineer & Senior Art Director & Filmmaker & Art Historian, and Pop Culture Analyst. 
            Your task is to reverse-engineer this image into high-precision prompts with deep "World Knowledge."
            
            Output strictly JSON.
            
            Settings:
            - Prompt Lang: ${settings.cardFrontLanguage || 'English'}
            - Trans Lang: ${settings.cardBackLanguage || 'Chinese'}
            - Persona: ${settings.persona || "General"}
            - Style: ${settings.descriptionStyle}
            
            CRITICAL OUTPUT RULES:
            1. **Subject & Environment** MUST be detailed, descriptive SENTENCES to capture character/object's details, spatial relations and identity.
            2. **Style, Composition, Lighting, Mood** MUST be comma-separated TAGS/PHRASES. Do NOT use asterisks or markdown formatting in these fields.
            3. **WORLD KNOWLEDGE**: Identify specific real-world entities & eras & artists & artworks. Do not just say "anime style"; say "90s dark fantasy anime style similar to Hellsing."

            STRICT CATEGORIZATION GUIDELINES:

            1. [Subject]: WHO, WHERE & HOW? (Format: Detailed Sentences)
               * **HIERARCHY**: Describe the CORE SUBJECT first, then AMBIENT/SECONDARY subjects.
               * **FOCUS**: Main characters AND/OR focal objects (treat significant objects as subjects).
               * **APPEARANCE**: Anatomy/Structure, clothing/material (fabric, cut, fit), accessories, exact pose (e.g., 'contrapposto').
               * **PRECISE LOCATION**: Specify Vertical (Foreground/Midground/Background) AND Horizontal (Left/Center/Right) placement.
               * **SCALE**: Describe how much of the frame the subject occupies.
               * **CAMERA RELATION**: Explicitly state the angle relative to the subject (e.g., "viewed from behind," "3/4 profile facing right," "top-down view facing camera," "seen from below").
               * **INTERACTION**: Describe physical connection with environment (e.g., "leaning heavily against," "emerging from," "sitting cross-legged on").
               * **MICRO-EMOTION**: Describe specific facial muscle cues or body language mood (e.g., "furrowed brow indicating worry," "slumped shoulders," "manic grin").
               * **IDENTITY**: Name specific characters or archetypes.

            2. [Environment]: WHERE? (Format: Detailed Sentences)
               * **REAL-WORLD CONTEXT**: Identify specific landmarks, cities, or historical eras (e.g., "Victorian London," "Cyberpunk Tokyo").
               * **DETAILS**: Architecture, biome, weather, time of day.
               * **CONSTRAINT**: No lighting/color terms here.

            3. [Composition]: STRUCTURE & LENS. (Format: COMMA-SEPARATED TAGS, NO MARKDOWN)
               * **INSTRUCTION**: Do NOT just pick from a list. Analyze the image's specific geometry.
               * **CRITICAL ANTI-BIAS**: Do NOT default to "Eye-Level". Check horizon lines carefully. If looking down, use "High-Angle/Overhead". If looking up, use "Low-Angle/Worm's-eye".
               * **REQUIRED DIMENSIONS** (Include terms for ALL applicable):
                 - **Framing Strategy**: (e.g., Symmetrical, Rule of Thirds, Golden Ratio, Frame-in-Frame, Negative Space, Center-weighted).
                 - **Camera Angle**: (e.g., Eye-Level, High-Angle, Low-Angle, Dutch Tilt, Bird's-Eye, Worm's-Eye).
                 - **Shot Size**: (e.g., Extreme Close-Up, Medium Shot, Cowboy Shot, Wide Shot, Establishing Shot).
                 - **Lens/Optics**: (e.g., Fisheye distortion, Telephoto compression, Macro, Bokeh/Shallow Depth of Field, Deep Focus).
                 - **Narrative Type**: (e.g., POV, Over-the-Shoulder, Two-Shot, Group Shot).

            4. [Lighting]: LIGHT, ATMOSPHERE & COLOR. (Format: COMMA-SEPARATED TAGS, NO MARKDOWN)
               * **ATMOSPHERE**: E.g., "volumetric fog," "hazy glow," "atmospheric perspective," "tyndall rays."
               * **TYPE**: E.g., "Chiaroscuro," "Rembrandt," "Rim light," "Global illumination," "Bioluminescence."
               * **PALETTE**: Describe the color grading (e.g., "Teal and Orange," "Monochromatic," "Pastel," "Desaturated").

            5. [Mood]: EMOTION & VIBE. (Format: COMMA-SEPARATED TAGS, NO MARKDOWN)
               * Specific adjectives (e.g., "Ethereal," "Claustrophobic," "Nostalgic," "Cybernetic").

            6. [Style]: AESTHETIC. (Format: COMMA-SEPARATED TAGS, NO MARKDOWN)
               * **ARTIST/STUDIO**: E.g., "by Greg Rutkowski," "by Makoto Shinkai," "Studio Ghibli style," "by Alphonse Mucha." Add "inspired by" when you are not sure.
               * **MOVEMENT/GENRE**: E.g., "Art Nouveau," "Impressionism," "Ukiyo-e," "90s dark fantasy anime," "cartoon realism," "gritty aesthetic similar to Hellsing."
               * **MEDIUM/TEXTURE**: E.g., "oil on canvas," "CGI render," "Unreal Engine 5," "vinyl toy aesthetic," "analog photography."
            
            REFERENCE OUTPUT QUALITY (Mimic this density):
            - Subject: A tall spindly purple anthropomorphic rabbit, wearing a black and white French maid outfit with puffy sleeves, white gloves, thigh-high stockings, standing next to a golden column pedestal.
            - Environment: Minimalist white studio background, infinite cyclorama, seamless white floor, empty space.
            - Composition: Full-body shot, slightly low angle, asymmetrical composition, negative space on right.
            - Lighting: Soft diffuse studio lighting, global illumination, high-key setup, soft cast shadows, muted purple and monochrome scheme.
            - Mood: Humorous, quirky, deadpan, surreal.           
            - Style: 3D stylized rendering, vinyl toy aesthetic, smooth plastic textures, cartoon realism, clean edges.

            
            Task:
            1. Deconstruct image into these 6 categories.
            2. Provide BOTH 'original' (Prompt Lang) and 'translated' (Trans Lang) for EACH segment.
            3. Use comma-separated phrases for Style/Composition/Lighting/Mood without any markdown bolding.`
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

export const searchHistory = async (query: string, history: HistoryItem[]): Promise<string[]> => {
    if (!query.trim() || !history.length) return [];

    try {
        // 1. Query Expansion via Gemini (Semantic)
        // Instead of sending all history (heavy payload), we ask Gemini to expand the query into synonyms/concepts.
        // This keeps the API call fast and robust.
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [{
                    text: `Analyze the search query: "${query}". 
                    Break it down into distinct semantic concepts (keywords). 
                    For each concept, provide the original word and 3 relevant synonyms or visual descriptors.
                    
                    Output STRICT JSON format ONLY:
                    { "groups": [ ["originalWord1", "synonymA", "synonymB"], ["originalWord2", "synonymC"] ] }
                    
                    Example: "Rainy Street" -> { "groups": [ ["Rainy", "Wet", "Storm", "Drizzle"], ["Street", "Road", "Alley", "Lane"] ] }`
                }]
            },
            config: { responseMimeType: "application/json" }
        });

        const data = JSON.parse(response.text || "{}");
        const conceptGroups: string[][] = data.groups || [];

        if (conceptGroups.length === 0) throw new Error("No concepts found");

        // 2. Local Filtering with Expanded Logic
        return history.filter(item => {
            // Aggregate all searchable text from the item
            const sp = item.analysis.structuredPrompts;
            const itemText = (
                (item.analysis.description || "") + " " +
                (sp ? [
                    sp.subject.original, sp.subject.translated,
                    sp.environment.original, sp.environment.translated,
                    sp.composition.original, sp.composition.translated,
                    sp.lighting.original, sp.lighting.translated,
                    sp.mood.original, sp.mood.translated,
                    sp.style.original, sp.style.translated
                ].join(" ") : "")
            ).toLowerCase();

            // Logic: The item must match ALL concept groups (AND),
            // but within each group, it can match ANY synonym (OR).
            // "Simultaneously containing these search terms or synonyms"
            return conceptGroups.every(group => {
                return group.some(word => itemText.includes(word.toLowerCase()));
            });
        }).map(h => h.id);

    } catch (e) {
        console.warn("Semantic search expansion failed, falling back to strict matching.", e);
        
        // 3. Fallback: Strict local keyword matching
        const terms = query.toLowerCase().split(/\s+/).filter(t => t);
        return history.filter(item => {
            const sp = item.analysis.structuredPrompts;
            const itemText = (
                (item.analysis.description || "") + " " +
                (sp ? [
                    sp.subject.original, sp.subject.translated,
                    sp.environment.original, sp.environment.translated,
                    sp.composition.original, sp.composition.translated,
                    sp.lighting.original, sp.lighting.translated,
                    sp.mood.original, sp.mood.translated,
                    sp.style.original, sp.style.translated
                ].join(" ") : "")
            ).toLowerCase();
            
            // Match ALL terms
            return terms.every(term => itemText.includes(term));
        }).map(h => h.id);
    }
};

export const sendChatMessageStream = async (
  history: ChatMessage[],
  message: string,
  image: string | undefined,
  onUpdate: (text: string) => void,
  settings?: UserSettings
): Promise<void> => {
  try {
    const historyParts = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    let accumulatedText = "";
    let resultStream;

    const systemInstruction = `
      You are an AI assistant analyzing an image.
      If the user asks for specific prompts, prompt breakdown, or detailed analysis of the image (e.g., "Give me composition prompts", "Describe the lighting"):
      1. Provide **ONLY** the requested prompt text or description.
      2. Use the user's requested System Language: ${settings?.systemLanguage || 'English'}.
      3. Do **NOT** add conversational filler like "Here are the prompts:" or "Sure, based on the image...".
      4. Do **NOT** use markdown bolding (**) for the core prompt content unless specifically asked for formatting. Keep the text clean and copy-ready.
      5. Be direct and technical.
    `;

    if (image) {
      const parts: any[] = [
        { inlineData: { mimeType: "image/jpeg", data: image.split(',')[1] } } 
      ];

      let contextPrompt = "Chat History:\n";
      history.forEach(h => {
        contextPrompt += `${h.role}: ${h.text}\n`;
      });
      contextPrompt += `\nUser: ${message}`;
      parts.push({ text: contextPrompt });

      resultStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: { parts },
        config: { systemInstruction }
      });

    } else {
      const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        history: historyParts as any,
        config: { systemInstruction }
      });
      resultStream = await chat.sendMessageStream({ message: message });
    }

    for await (const chunk of resultStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        accumulatedText += chunkText;
        onUpdate(accumulatedText); 
      }
    }

  } catch (e) {
    console.error("Chat Stream Error:", e);
    onUpdate("Connection error or invalid API Key.");
  }
};
// ==========================================
// 👇 请将以下代码追加到文件的最底部
// ==========================================

// 定义解释结果的数据结构
export interface TermExplanation {
  def: string; // 定义 (Definition)
  app: string; // 应用 (Application)
}

/**
 * 专门用于复古打印机：解释一个视觉术语
 * @param term 需要解释的词 (如 "Cyberpunk")
 * @param language 目标语言 (如 "Chinese")
 */
export const explainVisualTerm = async (term: string, language: string): Promise<TermExplanation> => {
  try {
    const prompt = `
      As an expert Art Director, explain the visual style/term: "${term}".
      
      Target Language: ${language} (Must output in this language)
      
      Rules:
      1. Keep it VERY concise (for a small screen).
      2. "def": Definition/Characteristics (Max 20 words).
      3. "app": Common usage/Application (Max 15 words).
      
      Output strictly JSON:
      { "def": "...", "app": "..." }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json" 
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as TermExplanation;

  } catch (error) {
    console.error("Explain term failed:", error);
    // 兜底返回，防止打印机卡死
    return {
      def: language.startsWith("Chinese") ? "正在检索数据..." : "Retrieving data...",
      app: language.startsWith("Chinese") ? "分析历史档案中" : "Analyzing archives"
    };
  }
};