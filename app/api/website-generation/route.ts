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
      selectedSystemPrompt, // 新增：系统提示词选择模式
      customSystemPrompt,   // 新增：自定义系统提示词
      maxTokens,
      apiKey,
      continuationMode = false,
      existingCode = '',
      maxContinuationAttempts = 10
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

    // 根据模式确定系统提示词（参考page.tsx的逻辑）
    let systemPromptToUse: string | null = null;
    
    if (selectedSystemPrompt === 'custom' && customSystemPrompt) {
      // 使用自定义系统提示词
      systemPromptToUse = customSystemPrompt;
    } else if (selectedSystemPrompt === 'thinking') {
      // 使用thinking模式的系统提示词
      systemPromptToUse = `You are an expert web developer AI. Your task is to generate a single, self-contained HTML file based on the user's prompt.
First, before generating any code, you MUST articulate your detailed thinking process. Enclose this entire process within <think> and </think> tags. This thinking process should cover your interpretation of the user's core request and objectives; your planned HTML structure including key elements and semantic organization; your CSS styling strategy detailing the general approach, specific techniques, or frameworks considered (for example, if Tailwind CSS is requested or appropriate); and your JavaScript logic, outlining intended functionality, event handling, and DOM manipulation strategy. Furthermore, critically consider any external resources: if the request implies or mentions external libraries or frameworks such as React, Vue, Three.js, Tailwind CSS, Google Fonts, or icon sets, you must assess if using them via a CDN is appropriate for this specific request, providing a brief justification (e.g., ease of use, versioning, performance benefits/drawbacks for a single file). If a CDN is not chosen, or if the library is small, briefly explain the alternative, such as embedding or using vanilla JS/CSS for simpler tasks.
Only after this complete <think> block, proceed to generate the code. The HTML file must include all necessary HTML structure, CSS styles within <style> tags in the <head>, and JavaScript code within <script> tags, preferably at the end of the <body>.
IMPORTANT: Apart from the initial <think>...</think> block, do NOT use markdown formatting. Do NOT wrap the code in \`\`\`html and \`\`\` tags. Do NOT output any text or explanation before or after the HTML code. Only output the raw HTML code itself, starting with <!DOCTYPE html> and ending with </html>. Ensure the generated CSS and JavaScript are directly embedded in the HTML file, unless the CDN consideration in your <think> block justifies linking to an external CDN for a specific library/framework.`;
    } else if (systemPrompt) {
      // 使用传递的系统提示词
      systemPromptToUse = systemPrompt;
    } else {
      // 使用默认系统提示词
      systemPromptToUse = SYSTEM_PROMPT;
    }

    // 创建新的流来处理完整性检查和自动继续生成
    const processedStream = new ReadableStream({
      async start(controller) {
        let fullContent = continuationMode ? existingCode : '';
        let continuationAttempts = 0;
        let thinkingOutput = '';
        let isInThinkingBlock = false;
        
        // 判断是否为thinking模式
        const isThinkingMode = selectedSystemPrompt === 'thinking';
        
        // 辅助函数：处理思考块和清理代码（从page.tsx移植）
        function processThinkingAndCleanCode(receivedText: string) {
          let cleanedCode = receivedText;
          let extractedThinking = '';

          // 只在thinking模式下处理思考块
          if (isThinkingMode) {
            // 检查思考块
            const thinkingStartIndex = cleanedCode.indexOf("<think>");
            const thinkingEndIndex = cleanedCode.indexOf("</think>");

            if (thinkingStartIndex !== -1) {
              isInThinkingBlock = true;

              // 提取思考内容
              if (thinkingEndIndex !== -1) {
                // 完整的思考块
                extractedThinking = cleanedCode.substring(thinkingStartIndex + 7, thinkingEndIndex);

                // 从代码中移除思考块
                cleanedCode = cleanedCode.substring(0, thinkingStartIndex) +
                              cleanedCode.substring(thinkingEndIndex + 8);

                isInThinkingBlock = false;
              } else {
                // 部分思考块
                extractedThinking = cleanedCode.substring(thinkingStartIndex + 7);

                // 从代码中移除部分思考块
                cleanedCode = cleanedCode.substring(0, thinkingStartIndex);
              }

              thinkingOutput += extractedThinking;
            } else if (isInThinkingBlock && thinkingEndIndex !== -1) {
              // 思考块结束
              extractedThinking = cleanedCode.substring(0, thinkingEndIndex);

              // 从代码中移除思考块
              cleanedCode = cleanedCode.substring(thinkingEndIndex + 8);

              isInThinkingBlock = false;
              thinkingOutput += extractedThinking;
            }
          }

          // 移除markdown格式
          cleanedCode = cleanedCode.replace(/^```html\n/, '');
          cleanedCode = cleanedCode.replace(/```$/, '');

          return { cleanedCode, thinkingOutput: extractedThinking };
        }
        
        // 辅助函数：继续生成
        async function continueGeneration() {
          if (continuationAttempts >= maxContinuationAttempts) {
            console.log(`达到最大继续生成尝试次数(${maxContinuationAttempts})，停止生成`);
            return false;
          }
          
          continuationAttempts++;
          console.log(`进行第 ${continuationAttempts} 次继续生成`);
          
          try {
            // 构建继续生成的提示（使用page.tsx中的逻辑）
            const continuationPrompt = `继续按照原始需求完成以下HTML代码，保持一致的风格和结构。\n\n${fullContent}`;
            
            // 根据模式构建继续生成的系统提示词
            let continuationSystemPrompt: string;
            
            if (isThinkingMode) {
              continuationSystemPrompt = `你是一位专业网页开发者。请继续完成用户提供的不完整代码。只输出继续的代码部分，不要重新开始。确保生成的代码可以正确衔接已有内容。 Do NOT wrap the code in \`\`\`html and \`\`\` tags. Do NOT output any text or explanation before or after the HTML code. Only output the raw HTML code itself. Ensure the generated CSS and JavaScript are directly embedded in the HTML file, unless the CDN consideration in your <think> block justifies linking to an external CDN for a specific library/framework.\n原始需求：\n\n${prompt}\n\n`;
            } else {
              continuationSystemPrompt = `你是一位专业网页开发者。请继续完成用户提供的不完整代码。只输出继续的代码部分，不要重新开始。确保生成的代码可以正确衔接已有内容。 Do NOT wrap the code in \`\`\`html and \`\`\` tags. Do NOT output any text or explanation before or after the HTML code. Only output the raw HTML code itself. Ensure the generated CSS and JavaScript are directly embedded in the HTML file.\n原始需求：\n\n${prompt}\n\n`;
            }
            
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
              
              // 处理思考块和清理代码
              const { cleanedCode } = processThinkingAndCleanCode(continuationContent);
              
              // 发送增量更新
              controller.enqueue(value);
            }
            
            // 最终处理继续生成的代码
            const { cleanedCode: finalCleanedContinuation } = processThinkingAndCleanCode(continuationContent);
            
            // 智能合并逻辑 - 避免重复内容（使用page.tsx中的逻辑）
            let completeCode = fullContent;
            
            if (finalCleanedContinuation.trim().startsWith('<!DOCTYPE') || 
                finalCleanedContinuation.trim().startsWith('<html') || 
                finalCleanedContinuation.trim().startsWith('<HTML')) {
              // 如果返回的是完整HTML，尝试提取新增的部分
              const bodyStartIdx = finalCleanedContinuation.indexOf('<body');
              const bodyEndIdx = finalCleanedContinuation.lastIndexOf('</body>');
              
              if (bodyStartIdx !== -1 && bodyEndIdx !== -1) {
                // 提取body内容
                const bodyContent = finalCleanedContinuation.substring(
                  finalCleanedContinuation.indexOf('>', bodyStartIdx) + 1,
                  bodyEndIdx
                );
                
                // 在现有代码的</body>前插入
                const existingBodyEnd = completeCode.lastIndexOf('</body>');
                if (existingBodyEnd !== -1) {
                  completeCode = completeCode.substring(0, existingBodyEnd) + 
                               bodyContent + 
                               completeCode.substring(existingBodyEnd);
                } else {
                  completeCode += bodyContent;
                }
              } else {
                // 无法识别body标签，直接附加
                completeCode += finalCleanedContinuation;
              }
            } else {
              // 直接附加非完整HTML
              completeCode += finalCleanedContinuation;
            }
            
            // 检查是否有变化
            if (completeCode === fullContent) {
              console.log("代码未变化，继续尝试生成");
              return true; // 继续尝试
            }
            
            fullContent = completeCode;
            
            // 检查生成的内容是否完整
            return !isHtmlComplete(fullContent);
          } catch (error) {
            console.error('继续生成时出错:', error);
            return false; // 出错时停止继续生成
          }
        }
        
        // 第一步：初始生成（使用handleGenerate的逻辑）
        console.log(`开始初始生成... (模式: ${isThinkingMode ? 'thinking' : 'normal'})`);
        const initialStream = await providerClient.generateCode(prompt, modelToUse, systemPromptToUse, parsedMaxTokens);
        const initialResponse = new Response(initialStream);
        const initialReader = initialResponse.body?.getReader();
        
        if (!initialReader) {
          throw new Error('无法读取初始生成流');
        }
        
        let receivedText = '';
        
        // 读取初始生成内容（流式处理，类似page.tsx中的逻辑）
        while (true) {
          const { done, value } = await initialReader.read();
          
          if (done) {
            break;
          }
          
          // 将二进制数据转换为文本并添加到接收的文本
          const textChunk = new TextDecoder().decode(value);
          receivedText += textChunk;
          
          // 处理思考块和清理代码
          const { cleanedCode } = processThinkingAndCleanCode(receivedText);
          
          // 更新完整内容
          fullContent = cleanedCode;
          
          // 发送增量更新
          controller.enqueue(value);
        }
        
        // 第二步：判断生成结果是否完整的HTML
        console.log('检查HTML完整性...');
        const isComplete = isHtmlComplete(fullContent);
        console.log(`HTML完整性检查结果: ${isComplete ? '完整' : '不完整'}`);
        
        // 第三步：如果不完整，则继续生成
        if (!isComplete) {
          console.log('HTML不完整，开始自动继续生成...');
          let shouldContinue = true;
          
          while (shouldContinue) {
            shouldContinue = await continueGeneration();
            
            // 每次继续生成后重新检查完整性
            if (shouldContinue && isHtmlComplete(fullContent)) {
              console.log('HTML已完整，停止继续生成');
              shouldContinue = false;
            }
          }
        } else {
          console.log('HTML已完整，无需继续生成');
        }
        
        console.log(`生成完成，总共进行了 ${continuationAttempts} 次继续生成`);
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