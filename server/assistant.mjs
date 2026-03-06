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
