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

export async function getWeatherForecast(location = 'Manaus') {
  try {
    const response = await api.assistantWeatherForecast(location);
    if (!response?.days?.length) {
      throw new Error('O assistente retornou uma previsao vazia.');
    }
    return response;
  } catch (error: any) {
    console.error('Assistant API Error:', error);
    throw new Error(error.message || 'Erro ao consultar o assistente.');
  }
}

export async function getRealWeatherForecast(options?: { lat?: number; lon?: number; days?: number; tz?: string }) {
  try {
    const response = await api.realWeatherForecast(options);
    if (!response?.days?.length) {
      throw new Error('O provedor de clima retornou uma previsao vazia.');
    }
    return response;
  } catch (error: any) {
    console.error('Weather API Error:', error);
    throw new Error(error.message || 'Erro ao consultar o provedor de clima.');
  }
}
