import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const modelId = process.env.AWS_BEDROCK_MODEL_ID || 'us.amazon.nova-lite-v1:0';
const region = process.env.AWS_BEDROCK_REGION || process.env.AWS_REGION || 'us-east-2';

let bedrockClient = null;

function getBedrockClient() {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({ region });
  }

  return bedrockClient;
}

function extractText(response) {
  return response.output?.message?.content
    ?.map((chunk) => chunk.text || '')
    .join('')
    .trim();
}

async function askBedrock(systemPrompt, userPrompt) {
  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId,
      system: [{ text: systemPrompt }],
      messages: [
        {
          role: 'user',
          content: [{ text: userPrompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 400,
        temperature: 0.4,
        topP: 0.9,
      },
    })
  );

  const text = extractText(response);
  if (!text) {
    throw new Error('A IA da AWS retornou uma resposta vazia.');
  }

  return text;
}

export async function getAssistantTips(query) {
  const fallback = 'Priorize a pre-inspecao completa, use shampoo neutro na lataria e finalize com secagem por microfibra limpa para evitar marcas.';

  try {
    return await askBedrock(
      'Voce e um especialista em operacao de lava jato e estetica automotiva. Responda em portugues, de forma objetiva e util para a equipe.',
      query
    );
  } catch (error) {
    console.error('AWS Bedrock tips error:', error);
    return fallback;
  }
}

export async function getAssistantWeather(location = 'Manaus') {
  const fallback = 'Organize a fila do dia por horario e mantenha os veiculos ja inspecionados cobertos quando houver risco de chuva.';

  try {
    return await askBedrock(
      'Voce apoia a operacao de um lava jato. Diga em portugues, em no maximo duas frases, uma recomendacao operacional sobre lavar carros considerando clima e organizacao da fila.',
      `Considere o clima e a operacao para ${location}. Responda com uma orientacao pratica para hoje.`
    );
  } catch (error) {
    console.error('AWS Bedrock weather error:', error);
    return fallback;
  }
}

export async function getAssistantWeatherForecast(location = 'Manaus') {
  const fallback = {
    days: [
      { dayOffset: 0, condition: 'partly_cloudy', minC: 24, maxC: 32, rainMm: 0.2, note: 'Priorize veiculos ja inspecionados e mantenha panos secos a mao.' },
      { dayOffset: 1, condition: 'sun', minC: 24, maxC: 33, rainMm: 0, note: 'Dia bom para acelerar a fila e finalizar com secagem completa.' },
      { dayOffset: 2, condition: 'partly_cloudy', minC: 24, maxC: 32, rainMm: 0.4, note: 'Evite deixar carros prontos expostos; organize entregas por horario.' },
      { dayOffset: 3, condition: 'rain', minC: 23, maxC: 31, rainMm: 3.0, note: 'Reforce cobertura e priorize lavagem interna quando chover.' },
    ],
  };

  try {
    const text = await askBedrock(
      'Voce e um assistente de clima para operacao de lava jato. Retorne APENAS JSON valido, sem markdown, sem texto extra. Campos: days: [{dayOffset:0-3, condition:\"sun\"|\"partly_cloudy\"|\"cloudy\"|\"rain\", minC:number, maxC:number, rainMm:number, note:string}]. Valores realistas para o clima de Manaus e arredonde rainMm com 1 casa. note deve ser objetiva (maximo 12 palavras).',
      `Gere uma previsao simplificada para ${location} para os proximos 4 dias.`
    );

    const parsed = JSON.parse(text);
    const days = Array.isArray(parsed?.days) ? parsed.days : [];
    if (days.length !== 4) {
      return fallback;
    }

    const normalizedDays = days.map((day) => ({
      dayOffset: Number(day?.dayOffset),
      condition: String(day?.condition || ''),
      minC: Number(day?.minC),
      maxC: Number(day?.maxC),
      rainMm: Number(day?.rainMm),
      note: String(day?.note || '').trim(),
    }));

    const isValid = normalizedDays.every((day) => (
      [0, 1, 2, 3].includes(day.dayOffset)
      && ['sun', 'partly_cloudy', 'cloudy', 'rain'].includes(day.condition)
      && Number.isFinite(day.minC)
      && Number.isFinite(day.maxC)
      && Number.isFinite(day.rainMm)
      && Boolean(day.note)
    ));

    if (!isValid) {
      return fallback;
    }

    return { days: normalizedDays };
  } catch (error) {
    console.error('AWS Bedrock weather forecast error:', error);
    return fallback;
  }
}
