import { NextResponse } from 'next/server';
import { LLMProvider } from '@/lib/providers/config';

export async function GET() {
  try {
    // Use the default provider from environment variables or DeepSeek as fallback
    const defaultProvider = (process.env.DEFAULT_PROVIDER as LLMProvider) || LLMProvider.DEEPSEEK;
    // 新增获取默认模型的逻辑
    const defaultModel = process.env.DEFAULT_MODEL || null;

    return NextResponse.json({ defaultProvider, defaultModel });
  } catch (error) {
    console.error('Error fetching default provider:', error);

    return NextResponse.json(
      { error: 'Error fetching default provider' },
      { status: 500 }
    );
  }
}
