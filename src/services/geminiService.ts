/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

function getGeminiApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
}

function getGeminiClient() {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error("Chave de API do Gemini nao configurada no ambiente.");
  }

  return new GoogleGenAI({ apiKey });
}

/**
 * Helper function to handle Gemini API errors and provide detailed feedback.
 */
async function handleGeminiCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error: any) {
    console.error("Gemini API Error:", error);

    let message = "Ocorreu um erro inesperado ao processar sua solicitacao.";

    if (error.message?.includes("API key not valid")) {
      message = "Chave de API invalida. Verifique as configuracoes do sistema.";
    } else if (error.message?.includes("quota") || error.message?.includes("429")) {
      message = "Limite de requisicoes atingido. Por favor, tente novamente em alguns instantes.";
    } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
      message = "Falha de conexao com os servidores da IA. Verifique sua internet.";
    } else if (error.message?.includes("safety")) {
      message = "A solicitacao foi bloqueada pelos filtros de seguranca da IA.";
    } else if (error.message) {
      message = `Erro na IA: ${error.message}`;
    }

    throw new Error(message);
  }
}

export async function getCarCareTips(query: string) {
  return handleGeminiCall(async () => {
    const response = await getGeminiClient().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert car detailer. Answer the following question about car care and cleaning in a concise, professional way in Portuguese: ${query}`,
    });

    if (!response.text) {
      throw new Error("A IA retornou uma resposta vazia.");
    }

    return response.text;
  });
}

export async function getWeatherRecommendation(location: string = "Sao Paulo") {
  return handleGeminiCall(async () => {
    const response = await getGeminiClient().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Check the current weather in ${location} using Google Search. Based on the weather, should I wash my car today? Give a short recommendation (max 2 sentences) in Portuguese.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    if (!response.text) {
      throw new Error("Nao foi possivel gerar uma recomendacao climatica.");
    }

    return response.text;
  });
}
