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
  --prompt, -p        要生成的网站描述 (必需)
  --model, -m         要使用的AI模型 (如未提供，将使用.env.local中的DEFAULT_MODEL)
  --provider          AI提供商 (如未提供，将使用.env.local中的DEFAULT_PROVIDER)
  --system-prompt     自定义系统提示 (可选)
  --max-tokens        生成的最大令牌数 (可选)
  --output, -o        输出HTML文件路径 (可选, 默认: ./generated_website.html)
  --api-url           API端点URL (可选, 默认: http://localhost:3000/api/website-generation)
  --help, -h          显示此帮助信息
`;

// 从环境变量获取默认值
const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL;

// 参数默认值
let options = {
  prompt: null,
  model: DEFAULT_MODEL || null,
  provider: DEFAULT_PROVIDER || null,
  systemPrompt: null,
  maxTokens: null,
  output: './generated_website.html',
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
    options.systemPrompt = args[++i];
  } else if (arg === '--max-tokens') {
    options.maxTokens = parseInt(args[++i], 10);
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

// 主函数
async function generateWebsite() {
  console.log('正在生成网站...');
  console.log(`描述: ${options.prompt}`);
  console.log(`模型: ${options.model}`);
  if (options.provider) console.log(`提供商: ${options.provider}`);
  
  try {
    // 准备请求体
    const requestBody = {
      prompt: options.prompt,
      model: options.model
    };
    
    // 添加可选参数
    if (options.provider) requestBody.provider = options.provider;
    if (options.systemPrompt) requestBody.systemPrompt = options.systemPrompt;
    if (options.maxTokens) requestBody.maxTokens = options.maxTokens;
    
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
    
    // 从响应中读取数据
    const reader = response.body;
    
    reader.on('readable', () => {
      let chunk;
      while (null !== (chunk = reader.read())) {
        contentLength += chunk.length;
        fileStream.write(chunk);
        
        // 打印进度
        process.stdout.write(`\r已接收: ${contentLength} 字节`);
      }
    });
    
    reader.on('end', () => {
      fileStream.end();
      console.log(`\n网站生成完成！已保存到: ${outputPath}`);
    });
    
    reader.on('error', (err) => {
      fileStream.end();
      console.error('\n读取响应时出错:', err);
    });
    
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

// 运行主函数
generateWebsite();
