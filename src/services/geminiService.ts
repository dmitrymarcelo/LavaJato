/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Helper function to handle Gemini API errors and provide detailed feedback.
 */
async function handleGeminiCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Chave de API do Gemini não configurada no ambiente.");
    }
    return await call();
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    let message = "Ocorreu um erro inesperado ao processar sua solicitação.";
    
    if (error.message?.includes("API key not valid")) {
      message = "Chave de API inválida. Verifique as configurações do sistema.";
    } else if (error.message?.includes("quota") || error.message?.includes("429")) {
      message = "Limite de requisições atingido. Por favor, tente novamente em alguns instantes.";
    } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
      message = "Falha de conexão com os servidores da IA. Verifique sua internet.";
    } else if (error.message?.includes("safety")) {
      message = "A solicitação foi bloqueada pelos filtros de segurança da IA.";
    } else if (error.message) {
      message = `Erro na IA: ${error.message}`;
    }
    
    throw new Error(message);
  }
}

export async function getCarCareTips(query: string) {
  return handleGeminiCall(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert car detailer. Answer the following question about car care and cleaning in a concise, professional way in Portuguese: ${query}`,
    });
    
    if (!response.text) {
      throw new Error("A IA retornou uma resposta vazia.");
    }
    
    return response.text;
  });
}

export async function getWeatherRecommendation(location: string = "São Paulo") {
  return handleGeminiCall(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Check the current weather in ${location} using Google Search. Based on the weather, should I wash my car today? Give a short recommendation (max 2 sentences) in Portuguese.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    if (!response.text) {
      throw new Error("Não foi possível gerar uma recomendação climática.");
    }
    
    return response.text;
  });
}
