import { UserSettings } from '../../types';

/**
 * THE MASTER ANALYSIS PROMPT
 * This is the core prompt used by ALL providers for image analysis.
 * It defines the exact structure and quality requirements for prompt extraction.
 */
export const getMasterAnalysisPrompt = (settings: UserSettings) => {
   const frontLang = settings.cardFrontLanguage || 'English';
   const backLang = settings.cardBackLanguage || 'Chinese';

   return `## GLOBAL LANGUAGE RULES
1. **Output Language**: The 'original' field MUST be written in ${frontLang}. The 'translated' field MUST be written in ${backLang}.
2. **Adherence**: Do NOT default to English if ${frontLang} is Chinese. You MUST write the analysis in ${frontLang}.

You are a Expert Prompt Engineer & Senior Art Director & Filmmaker & Art Historian, and Pop Culture Analyst. 
Your task is to reverse-engineer this image into high-precision prompts with deep "World Knowledge."

Output strictly JSON with this exact structure:
{
  "structuredPrompts": {
    "subject": { "original": "...", "translated": "..." },
    "environment": { "original": "...", "translated": "..." },
    "composition": { "original": "...", "translated": "..." },
    "lighting": { "original": "...", "translated": "..." },
    "mood": { "original": "...", "translated": "..." },
    "style": { "original": "...", "translated": "..." }
  }
}

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
3. Use comma-separated phrases for Style/Composition/Lighting/Mood without any markdown bolding.`;
};

/**
 * Get a focused prompt for regenerating a specific dimension
 */
export const getDimensionPrompt = (dimension: 'subject' | 'environment' | 'composition' | 'lighting' | 'mood' | 'style', settings: UserSettings) => {
   const dimensionInstructions = {
      subject: `1. [Subject]: WHO, WHERE & HOW? (Format: Detailed Sentences)
   * **HIERARCHY**: Describe the CORE SUBJECT first, then AMBIENT/SECONDARY subjects.
   * **FOCUS**: Main characters AND/OR focal objects (treat significant objects as subjects).
   * **APPEARANCE**: Anatomy/Structure, clothing/material (fabric, cut, fit), accessories, exact pose (e.g., 'contrapposto').
   * **PRECISE LOCATION**: Specify Vertical (Foreground/Midground/Background) AND Horizontal (Left/Center/Right) placement.
   * **SCALE**: Describe how much of the frame the subject occupies.
   * **CAMERA RELATION**: Explicitly state the angle relative to the subject (e.g., "viewed from behind," "3/4 profile facing right," "top-down view facing camera," "seen from below").
   * **INTERACTION**: Describe physical connection with environment (e.g., "leaning heavily against," "emerging from," "sitting cross-legged on").
   * **MICRO-EMOTION**: Describe specific facial muscle cues or body language mood (e.g., "furrowed brow indicating worry," "slumped shoulders," "manic grin").
   * **IDENTITY**: Name specific characters or archetypes.`,

      environment: `2. [Environment]: WHERE? (Format: Detailed Sentences)
   * **REAL-WORLD CONTEXT**: Identify specific landmarks, cities, or historical eras (e.g., "Victorian London," "Cyberpunk Tokyo").
   * **DETAILS**: Architecture, biome, weather, time of day.
   * **CONSTRAINT**: No lighting/color terms here.`,

      composition: `3. [Composition]: STRUCTURE & LENS. (Format: COMMA-SEPARATED TAGS, NO MARKDOWN)
   * **INSTRUCTION**: Do NOT just pick from a list. Analyze the image's specific geometry.
   * **CRITICAL ANTI-BIAS**: Do NOT default to "Eye-Level". Check horizon lines carefully. If looking down, use "High-Angle/Overhead". If looking up, use "Low-Angle/Worm's-eye".
   * **REQUIRED DIMENSIONS** (Include terms for ALL applicable):
     - **Framing Strategy**: (e.g., Symmetrical, Rule of Thirds, Golden Ratio, Frame-in-Frame, Negative Space, Center-weighted).
     - **Camera Angle**: (e.g., Eye-Level, High-Angle, Low-Angle, Dutch Tilt, Bird's-Eye, Worm's-Eye).
     - **Shot Size**: (e.g., Extreme Close-Up, Medium Shot, Cowboy Shot, Wide Shot, Establishing Shot).
     - **Lens/Optics**: (e.g., Fisheye distortion, Telephoto compression, Macro, Bokeh/Shallow Depth of Field, Deep Focus).
     - **Narrative Type**: (e.g., POV, Over-the-Shoulder, Two-Shot, Group Shot).`,

      lighting: `4. [Lighting]: LIGHT, ATMOSPHERE & COLOR. (Format: COMMA-SEPARATED TAGS, NO MARKDOWN)
   * **ATMOSPHERE**: E.g., "volumetric fog," "hazy glow," "atmospheric perspective," "tyndall rays."
   * **TYPE**: E.g., "Chiaroscuro," "Rembrandt," "Rim light," "Global illumination," "Bioluminescence."
   * **PALETTE**: Describe the color grading (e.g., "Teal and Orange," "Monochromatic," "Pastel," "Desaturated").`,

      mood: `5. [Mood]: EMOTION & VIBE. (Format: COMMA-SEPARATED TAGS ONLY)
   * Instructions: Use specific adjectives (e.g., "Ethereal," "Claustrophobic," "Nostalgic," "Cybernetic").
   * Constraint: Output must be a list of tags. NO sentences.`,

      style: `6. [Style]: AESTHETIC. (Format: COMMA-SEPARATED TAGS, NO MARKDOWN)
   * **ARTIST/STUDIO**: E.g., "by Greg Rutkowski," "by Makoto Shinkai," "Studio Ghibli style," "by Alphonse Mucha." Add "inspired by" when you are not sure.
   * **MOVEMENT/GENRE**: E.g., "Art Nouveau," "Impressionism," "Ukiyo-e," "90s dark fantasy anime," "cartoon realism," "gritty aesthetic similar to Hellsing."
   * **MEDIUM/TEXTURE**: E.g., "oil on canvas," "CGI render," "Unreal Engine 5," "vinyl toy aesthetic," "analog photography."`
   };

   const isTagBased = ['composition', 'lighting', 'mood', 'style'].includes(dimension);
   const formatRule = isTagBased
      ? "CRITICAL FORMAT RULE: Output MUST be a comprehensive list of at least 6 comma-separated key phrases/tags. DO NOT write complete sentences or paragraphs."
      : "CRITICAL FORMAT RULE: Output detailed, descriptive sentences (at least 3 sentences).";

   const frontLang = settings.cardFrontLanguage || 'English';
   const backLang = settings.cardBackLanguage || 'Chinese';

   return `## Role: Expert Prompt Engineer & Senior Art Director & Filmmaker & Art Historian, and Pop Culture Analyst. 
   
## Task
Regenerate the "${dimension}" dimension analysis for this image.

## Dimension Focus
${dimensionInstructions[dimension]}

## STRICT Output Rules
1. **Detail Level**: MUST be detailed, specific, and professional.
2. **Format**: Follow the format specified above (SENTENCES or TAGS).
   - For [Subject] and [Environment]: Write fluid, descriptive paragraphs.
   - For [Composition], [Lighting], [Mood], [Style]: Write ONLY comma-separated keywords/phrases. NO sentences.
3. **Constraint**: Do NOT include bullet points, label names (e.g. "Real-World Context:"), or markdown headers in the content. Just the raw analysis text.
4. **Accuracy**: strictly adhere to the visual evidence in the image.
5. **Length**: Provide substantial content (at least 3 sentences or 6+ tags).

## JSON Output Format
Output ONLY raw JSON (no markdown block markers):
{ 
  "original": "Output the analysis here, written strictly in ${frontLang}",
  "translated": "Output the direct translation here, written strictly in ${backLang}"
}

Analysis:`;
};

/**
 * Get a prompt for translating text
 */
export const getTranslationPrompt = (text: string, language: string) => {
   return `Translate the following text to ${language}.
Rules:
1. Maintain the original tone and style.
2. If it's a list of tags, keep it as comma-separated tags.
3. If it's a sentence, keep it as natural sentences.
4. Output specific art terminology correctly in the target language.

Text to translate:
"${text}"

Output ONLY JSON: { "translated": "YOUR_TRANSLATION_HERE" }`;
};
