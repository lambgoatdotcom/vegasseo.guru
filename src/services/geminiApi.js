// src/services/geminiApi.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

export const generateContent = async (prompt) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-exp' });
    const result = await model.generateContent([prompt]);
    return result.response.text();
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
};
