// src/services/geminiApi.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import React from 'react';
import ReactMarkdown from 'react-markdown';

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

export const generateContent = async (prompt) => {
  try {
    // Prompt the model to return text in Markdown format
    const styledPrompt = `
      Please provide your response in Markdown format. The user wants:
      ${prompt}
    `;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent([styledPrompt]);
    return result.response.text();
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
};

// Then in your React component, you might do something like:
function GeminiChat({ content }) {
  return <ReactMarkdown>{content}</ReactMarkdown>;
}

export default GeminiChat;
