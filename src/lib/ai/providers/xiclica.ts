import { AiError } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

const XICLICA_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const XICLICA_FIXED_MODEL = 'deepseek-v4-flash'

interface XiclicaResponse {
  choices?: { message?: { content?: string } }[]
}

export async function generateXiclica(args: ProviderArgs): Promise<string> {
  const { apiKey, systemPrompt, messages, timeoutMs } = args

  let res: Response
  try {
    res = await fetch(XICLICA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: XICLICA_FIXED_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...mergeConsecutive(messages),
        ],
        max_completion_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('Xiclica', res)
  }

  const data = (await res.json().catch(() => null)) as XiclicaResponse | null
  const text = data?.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AiError('Xiclica returned an empty response.', {
      code: 'empty_response',
    })
  }
  return text
}
