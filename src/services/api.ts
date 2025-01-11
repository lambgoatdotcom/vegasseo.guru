import { Message } from '../types';

export type ModelType = 'deepseek' | 'openai' | 'gemini';

const DEEPSEEK_API_KEY = 'sk-5c1d1a57a53246a79869b2d64b4da379';
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const API_URLS = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
};

export async function sendMessage(messages: Message[], model: ModelType = 'deepseek'): Promise<string> {
  try {
    if (model === 'gemini') {
      return await sendGeminiMessage(messages);
    }

    const apiKey = model === 'deepseek' ? DEEPSEEK_API_KEY : OPENAI_API_KEY;
    const response = await fetch(API_URLS[model], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model === 'deepseek' ? 'deepseek-chat' : 'chatgpt-4o-latest',
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`${model} API request failed`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error(`Error calling ${model} API:`, error);
    throw error;
  }
}

async function sendGeminiMessage(messages: Message[]): Promise<string> {
  try {
    // Format the conversation history without role prefixes
    const prompt = messages
      .slice(0, -1) // Get all messages except the last one
      .map(msg => msg.content)
      .join('\n');

    // Add the last user message with instructions
    const lastMessage = messages[messages.length - 1];
    const systemInstruction = "You are a Las Vegas SEO Guru and digital marketing expert. Never mention that you are an AI or assistant. Never use phrases like 'As an AI' 'Assistant:' or similar self-references. Respond directly to questions and provide expert, practical advice based on your experience with the Las Vegas market.\n\n";
    const finalPrompt = prompt 
      ? `${systemInstruction}${prompt}\n${lastMessage.content}`
      : `${systemInstruction}${lastMessage.content}`;

    const response = await fetch(`${API_URLS.gemini}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: finalPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topP: 1,
          topK: 1,
          maxOutputTokens: 1000,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error('Gemini API request failed');
    }

    const data = await response.json();
    let responseText = data.candidates[0].content.parts[0].text;
    
    // Remove various forms of assistant prefixes
    const prefixesToRemove = [
      'Assistant: ',
      'A: ',
      'AI: ',
      'As an AI assistant, ',
      'As an AI, '
    ];
    
    for (const prefix of prefixesToRemove) {
      if (responseText.startsWith(prefix)) {
        responseText = responseText.substring(prefix.length);
        break;
      }
    }
    
    return responseText;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}