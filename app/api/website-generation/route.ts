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

// 检查HTML是否完整
function isHtmlComplete(html: string): boolean {
  const docTypeCheck = html.includes('<!DOCTYPE') || html.includes('<!doctype');
  const htmlTagsCheck = html.includes('<html') && html.includes('</html>');
  const headTagsCheck = html.includes('<head') && html.includes('</head>');
  const bodyTagsCheck = html.includes('<body') && html.includes('</body>');
  
  return docTypeCheck && htmlTagsCheck && headTagsCheck && bodyTagsCheck;
}

// 清理生成的代码，移除思考块和markdown格式
function cleanGeneratedCode(code: string): string {
  let cleanedCode = code;
  
  // 移除思考块
  const thinkingStartIndex = cleanedCode.indexOf("<think>");
  const thinkingEndIndex = cleanedCode.indexOf("</think>");
  
  if (thinkingStartIndex !== -1 && thinkingEndIndex !== -1) {
    cleanedCode = cleanedCode.substring(0, thinkingStartIndex) +
                 cleanedCode.substring(thinkingEndIndex + 8);
  }
  
  // 移除markdown格式
  cleanedCode = cleanedCode.replace(/^```html\n/, '');
  cleanedCode = cleanedCode.replace(/```$/, '');
  
  return cleanedCode;
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
      apiKey,
      continuationMode = false,
      existingCode = '',
      maxContinuationAttempts = 2  // 最大继续生成尝试次数
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

    // 创建流式输出变换器，处理完整性检查和自动继续生成
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        // 传递当前块
        controller.enqueue(chunk);
      },
    });

    // 初始生成
    let stream = await providerClient.generateCode(prompt, modelToUse, systemPromptToUse, parsedMaxTokens);
    
    // 创建响应
    const response = new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      },
    });

    // 处理完整性检查和自动继续生成
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取生成流');
    }

    // 创建新的流来处理完整性检查和自动继续生成
    const processedStream = new ReadableStream({
      async start(controller) {
        let fullContent = continuationMode ? existingCode : '';
        let continuationAttempts = 0;
        
        // 辅助函数：继续生成
        async function continueGeneration() {
          if (continuationAttempts >= maxContinuationAttempts) {
            console.log(`达到最大继续生成尝试次数(${maxContinuationAttempts})，停止生成`);
            return false;
          }
          
          continuationAttempts++;
          console.log(`进行第 ${continuationAttempts} 次继续生成`);
          
          try {
            // 构建继续生成的提示
            const continuationPrompt = `继续按照原始需求完成以下HTML代码，保持一致的风格和结构。\n\n${fullContent}`;
            const continuationSystemPrompt = `你是一位专业网页开发者。请继续完成用户提供的不完整代码。只输出继续的代码部分，不要重新开始。确保生成的代码可以正确衔接已有内容。 Do NOT wrap the code in \`\`\`html and \`\`\` tags. Do NOT output any text or explanation before or after the HTML code. Only output the raw HTML code itself. Ensure the generated CSS and JavaScript are directly embedded in the HTML file.\n原始需求：\n\n${prompt}\n\n`;
            
            // 生成继续的代码
            const continuationStream = await providerClient.generateCode(continuationPrompt, modelToUse, continuationSystemPrompt, parsedMaxTokens);
            const continuationResponse = new Response(continuationStream);
            const continuationReader = continuationResponse.body?.getReader();
            
            if (!continuationReader) {
              throw new Error('无法读取继续生成流');
            }
            
            let continuationContent = '';
            
            // 读取继续生成的内容
            while (true) {
              const { done, value } = await continuationReader.read();
              
              if (done) {
                break;
              }
              
              // 将二进制数据转换为文本
              const textChunk = new TextDecoder().decode(value);
              continuationContent += textChunk;
              
              // 发送增量更新
              controller.enqueue(value);
            }
            
            // 清理继续生成的代码
            const cleanedContinuation = cleanGeneratedCode(continuationContent);
            
            // 智能合并逻辑 - 避免重复内容
            if (cleanedContinuation.trim().startsWith('<!DOCTYPE') || 
                cleanedContinuation.trim().startsWith('<html') || 
                cleanedContinuation.trim().startsWith('<HTML')) {
              // 如果返回的是完整HTML，尝试提取新增的部分
              const bodyStartIdx = cleanedContinuation.indexOf('<body');
              const bodyEndIdx = cleanedContinuation.lastIndexOf('</body>');
              
              if (bodyStartIdx !== -1 && bodyEndIdx !== -1) {
                // 提取body内容
                const bodyContent = cleanedContinuation.substring(
                  cleanedContinuation.indexOf('>', bodyStartIdx) + 1,
                  bodyEndIdx
                );
                
                // 在现有代码的</body>前插入
                const existingBodyEnd = fullContent.lastIndexOf('</body>');
                if (existingBodyEnd !== -1) {
                  const newContent = fullContent.substring(0, existingBodyEnd) + 
                                   bodyContent + 
                                   fullContent.substring(existingBodyEnd);
                  
                  // 检查是否有变化
                  if (newContent === fullContent) {
                    console.log("代码未变化，继续尝试生成");
                    return true; // 继续尝试
                  }
                  
                  fullContent = newContent;
                } else {
                  fullContent += bodyContent;
                }
              } else {
                // 无法识别body标签，直接附加并检查是否有变化
                if (fullContent + cleanedContinuation === fullContent) {
                  console.log("代码未变化，继续尝试生成");
                  return true; // 继续尝试
                }
                
                fullContent += cleanedContinuation;
              }
            } else {
              // 直接附加非完整HTML并检查是否有变化
              if (fullContent + cleanedContinuation === fullContent) {
                console.log("代码未变化，继续尝试生成");
                return true; // 继续尝试
              }
              
              fullContent += cleanedContinuation;
            }
            
            // 检查生成的内容是否完整
            return !isHtmlComplete(fullContent);
          } catch (error) {
            console.error('继续生成时出错:', error);
            return false; // 出错时停止继续生成
          }
        }
        
        // 读取初始生成内容
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }
          
          // 将二进制数据转换为文本并添加到完整内容
          const textChunk = new TextDecoder().decode(value);
          fullContent += textChunk;
          
          // 发送增量更新
          controller.enqueue(value);
        }
        
        // 清理生成的代码
        fullContent = cleanGeneratedCode(fullContent);
        
        // 检查生成的内容是否完整，如果不完整则尝试继续生成
        let shouldContinue = !isHtmlComplete(fullContent);
        
        while (shouldContinue) {
          shouldContinue = await continueGeneration();
        }
        
        controller.close();
      }
    });

    // 返回处理后的流
    return new Response(processedStream, {
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