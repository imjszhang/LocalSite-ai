const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
// 修改dotenv配置，指定.env.local文件
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

// 解析命令行参数
const args = process.argv.slice(2);
const helpText = `
用法: node website-generator.js [选项]

选项:
  --prompt, -p                要生成的网站描述 (必需)
  --model, -m                 要使用的AI模型 (如未提供，将使用.env.local中的DEFAULT_MODEL)
  --provider                  AI提供商 (如未提供，将使用.env.local中的DEFAULT_PROVIDER)
  --selected-system-prompt    系统提示模式 (default|thinking|custom，默认: default)
  --custom-system-prompt      自定义系统提示内容 (当--selected-system-prompt为custom时使用)
  --max-tokens                生成的最大令牌数 (可选)
  --max-continuation-attempts 最大自动继续生成尝试次数 (可选，默认: 10)
  --output, -o                输出HTML文件路径 (可选, 默认: ./work_dir/generated_website.html)
  --api-url                   API端点URL (可选, 默认: http://localhost:3000/api/website-generation)
  --help, -h                  显示此帮助信息

系统提示模式说明:
  default   - 使用默认的系统提示词
  thinking  - 启用思考模式，AI会先进行详细思考再生成代码
  custom    - 使用自定义系统提示词 (需配合--custom-system-prompt使用)

示例:
  # 基础使用
  node website-generator.js --prompt "创建一个博客网站" --model "deepseek-coder-33b-instruct"
  
  # 使用思考模式
  node website-generator.js --prompt "创建一个电商网站" --selected-system-prompt thinking
  
  # 使用自定义系统提示
  node website-generator.js --prompt "创建艺术网站" --selected-system-prompt custom --custom-system-prompt "你是专业艺术网站设计师..."
`;

// 从环境变量获取默认值
const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL;

// 参数默认值
let options = {
  prompt: null,
  model: DEFAULT_MODEL || null,
  provider: DEFAULT_PROVIDER || null,
  systemPrompt: null, // 保留向后兼容性
  selectedSystemPrompt: 'default',
  customSystemPrompt: null,
  maxTokens: null,
  maxContinuationAttempts: null,
  output: './work_dir/generated_website.html',
  apiUrl: 'http://localhost:3000/api/website-generation'
};

// 解析命令行参数
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--help' || arg === '-h') {
    console.log(helpText);
    process.exit(0);
  } else if (arg === '--prompt' || arg === '-p') {
    options.prompt = args[++i];
  } else if (arg === '--model' || arg === '-m') {
    options.model = args[++i];
  } else if (arg === '--provider') {
    options.provider = args[++i];
  } else if (arg === '--system-prompt') {
    // 保留向后兼容性，但显示警告
    console.warn('警告: --system-prompt 已弃用，请使用 --selected-system-prompt 和 --custom-system-prompt');
    options.systemPrompt = args[++i];
  } else if (arg === '--selected-system-prompt') {
    const value = args[++i];
    if (!['default', 'thinking', 'custom'].includes(value)) {
      console.error('错误: --selected-system-prompt 必须是 default、thinking 或 custom 之一');
      process.exit(1);
    }
    options.selectedSystemPrompt = value;
  } else if (arg === '--custom-system-prompt') {
    options.customSystemPrompt = args[++i];
  } else if (arg === '--max-tokens') {
    options.maxTokens = parseInt(args[++i], 10);
  } else if (arg === '--max-continuation-attempts') {
    options.maxContinuationAttempts = parseInt(args[++i], 10);
  } else if (arg === '--output' || arg === '-o') {
    options.output = args[++i];
  } else if (arg === '--api-url') {
    options.apiUrl = args[++i];
  }
}

// 验证必需参数
if (!options.prompt) {
  console.error('错误: 必须提供网站描述 (--prompt 或 -p)');
  console.log(helpText);
  process.exit(1);
}

// 模型参数验证逻辑修改 - 如果命令行和环境变量都没有提供模型，才报错
if (!options.model) {
  console.error('错误: 必须提供AI模型 (--model 或 -m)，或在.env.local文件中设置DEFAULT_MODEL');
  console.log(helpText);
  process.exit(1);
}

// 验证自定义系统提示模式的参数
if (options.selectedSystemPrompt === 'custom' && !options.customSystemPrompt) {
  console.error('错误: 当使用 --selected-system-prompt custom 时，必须提供 --custom-system-prompt');
  process.exit(1);
}

// 主函数
async function generateWebsite() {
  console.log('正在生成网站...');
  console.log(`描述: ${options.prompt}`);
  console.log(`模型: ${options.model}`);
  if (options.provider) console.log(`提供商: ${options.provider}`);
  console.log(`系统提示模式: ${options.selectedSystemPrompt}`);
  if (options.selectedSystemPrompt === 'custom') {
    console.log(`自定义系统提示: ${options.customSystemPrompt.substring(0, 100)}...`);
  }
  if (options.maxContinuationAttempts) {
    console.log(`最大继续生成尝试次数: ${options.maxContinuationAttempts}`);
  }
  
  try {
    // 准备请求体
    const requestBody = {
      prompt: options.prompt,
      model: options.model
    };
    
    // 添加可选参数
    if (options.provider) requestBody.provider = options.provider;
    
    // 处理系统提示相关参数
    if (options.systemPrompt) {
      // 向后兼容性支持
      requestBody.systemPrompt = options.systemPrompt;
    } else {
      // 使用新的系统提示模式
      requestBody.selectedSystemPrompt = options.selectedSystemPrompt;
      if (options.selectedSystemPrompt === 'custom' && options.customSystemPrompt) {
        requestBody.customSystemPrompt = options.customSystemPrompt;
      }
    }
    
    if (options.maxTokens) requestBody.maxTokens = options.maxTokens;
    if (options.maxContinuationAttempts) requestBody.maxContinuationAttempts = options.maxContinuationAttempts;
    
    // 发送请求
    const response = await fetch(options.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    // 检查响应状态
    if (!response.ok) {
      let errorMessage = '生成网站时出错';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // 如果响应不是JSON，使用状态文本
        errorMessage = `HTTP错误: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    // 处理流式响应
    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 创建输出文件流
    const fileStream = fs.createWriteStream(outputPath);
    let contentLength = 0;
    let lastProgressTime = Date.now();
    
    // 从响应中读取数据
    const reader = response.body;
    
    reader.on('readable', () => {
      let chunk;
      while (null !== (chunk = reader.read())) {
        contentLength += chunk.length;
        fileStream.write(chunk);
        
        // 每500ms更新一次进度，避免输出过于频繁
        const now = Date.now();
        if (now - lastProgressTime > 500) {
          process.stdout.write(`\r已接收: ${contentLength} 字节 (${options.selectedSystemPrompt === 'thinking' ? '思考模式' : '标准模式'})`);
          lastProgressTime = now;
        }
      }
    });
    
    reader.on('end', () => {
      fileStream.end();
      console.log(`\n网站生成完成！已保存到: ${outputPath}`);
      console.log(`总大小: ${contentLength} 字节`);
      
      // 如果是思考模式，提醒用户思考过程已被过滤
      if (options.selectedSystemPrompt === 'thinking') {
        console.log('注意: 思考过程已自动过滤，输出文件仅包含纯净的HTML代码');
      }
    });
    
    reader.on('error', (err) => {
      fileStream.end();
      console.error('\n读取响应时出错:', err);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

// 运行主函数
generateWebsite();
