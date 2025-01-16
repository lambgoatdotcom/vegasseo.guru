import { Message } from '../types';

export type ModelType = 'deepseek' | 'openai' | 'gemini';

export interface Source {
  title: string;
  url: string;
  snippet?: string;
  content?: string;
}

export interface StreamChunk {
  content?: string;
  sources?: Source[];
  error?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://backend:8000/api';

export async function* streamMessage(
  messages: Message[], 
  model: ModelType = 'deepseek',
  useSearch: boolean = false
): AsyncGenerator<StreamChunk> {
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model,
        use_search: useSearch
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const chunk: StreamChunk = JSON.parse(data);
            yield chunk;
          } catch (e) {
            console.error('Error parsing chunk:', e);
            console.error('Raw data:', data);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error calling API:', error);
    yield { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}