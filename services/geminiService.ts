import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import { Message, GroundingSource, Language, Attachment } from '../types';

// Initialize Gemini Client
// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const sendMessageToGemini = async (
  history: Message[],
  userMessage: string,
  language: Language,
  attachments?: Attachment[]
): Promise<{ text: string; sources: GroundingSource[] }> => {
  const ai = getClient();
  
  // Construct the prompt with history context manually
  // Note: We are stripping attachments from history for simplicity in this context window approach, 
  // but keeping text. Ideally, you'd pass the full chat object if using `ai.chats.create`.
  const contextString = history
    .slice(-4) // Keep last 4 messages for context window
    .map(m => `${m.role.toUpperCase()}: ${m.text}`)
    .join('\n');

  const languageDirective = language === 'am' 
    ? "RESPOND IN AMHARIC (አማርኛ). The user speaks Amharic." 
    : "RESPOND IN ENGLISH. The user speaks English.";

  const fullPrompt = `
    Context of conversation:
    ${contextString}

    User's Current Input:
    ${userMessage}
    ${attachments && attachments.length > 0 ? "[User has attached files/images/audio for context]" : ""}

    SYSTEM DIRECTIVE:
    ${languageDirective}
  `;

  // Build Parts
  const parts: Part[] = [{ text: fullPrompt }];

  if (attachments && attachments.length > 0) {
    attachments.forEach(att => {
        parts.push({
            inlineData: {
                mimeType: att.mimeType,
                data: att.data
            }
        });
    });
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      // model:'gemini-2.5-flash',
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }], // Grounding is critical for law
        thinkingConfig: { thinkingBudget: 1024 }, // Enable thinking for better reasoning
        maxOutputTokens: 4096, // Allow verbose legal explanations
      },
    });

    const text = response.text || (language === 'am' ? "ይቅርታ፣ ምላሽ መስጠት አልቻልኩም።" : "I apologize, but I couldn't generate a response based on the available information.");
    
    // Extract grounding chunks
    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title,
            uri: chunk.web.uri,
          });
        }
      });
    }

    return { text, sources };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};