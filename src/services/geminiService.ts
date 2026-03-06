import { api } from './api';

async function handleAssistantCall(call: () => Promise<{ text: string }>): Promise<string> {
  try {
    const response = await call();
    if (!response.text) {
      throw new Error('O assistente retornou uma resposta vazia.');
    }

    return response.text;
  } catch (error: any) {
    console.error('Assistant API Error:', error);
    throw new Error(error.message || 'Erro ao consultar o assistente.');
  }
}

export async function getCarCareTips(query: string) {
  return handleAssistantCall(() => api.assistantTips(query));
}

export async function getWeatherRecommendation(location = 'Manaus') {
  return handleAssistantCall(() => api.assistantWeather(location));
}
