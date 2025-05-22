import { NextRequest } from 'next/server';
import { LLMProvider } from '@/lib/providers/config';
import { createProviderClient, SYSTEM_PROMPT } from '@/lib/providers/provider';

export const dynamic = 'force-dynamic'; // 禁用缓存，确保每次请求都是新的

// 处理OPTIONS请求以支持CORS预检请求
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求体JSON
    const { 
      prompt, 
      model, 
      provider: providerParam, 
      systemPrompt, 
      maxTokens,
      apiKey 
    } = await request.json();

    // 验证必需的参数
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: '必须提供提示(prompt)' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // 解析maxTokens为数字（如果提供）
    const parsedMaxTokens = maxTokens ? parseInt(maxTokens.toString(), 10) : undefined;

    // 确定要使用的提供商
    let provider: LLMProvider;

    if (providerParam && Object.values(LLMProvider).includes(providerParam as LLMProvider)) {
      provider = providerParam as LLMProvider;
    } else {
      // 使用环境变量中的默认提供商或回退到DeepSeek
      provider = (process.env.DEFAULT_PROVIDER as LLMProvider) || LLMProvider.DEEPSEEK;
    }

    // 如果未提供模型，使用默认模型（如果可用）
    const modelToUse = model || process.env.DEFAULT_MODEL;
    
    if (!modelToUse) {
      return new Response(
        JSON.stringify({ error: '必须提供模型(model)参数' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // 创建提供商客户端
    const providerClient = createProviderClient(provider);

    // 使用自定义系统提示或默认提示
    const systemPromptToUse = systemPrompt || SYSTEM_PROMPT;

    // 生成代码并获取流
    const stream = await providerClient.generateCode(prompt, modelToUse, systemPromptToUse, parsedMaxTokens);

    // 返回流式响应
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error) {
    console.error('生成网站时出错:', error);

    // 返回更具体的错误信息（如果可用）
    const errorMessage = error instanceof Error ? error.message : '生成网站时出错';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
} 