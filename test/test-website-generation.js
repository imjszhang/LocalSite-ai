// LocalSite AI API 测试脚本
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const API_BASE_URL = 'http://localsite-ai.localhost'; // 根据您的实际部署地址修改

/**
 * 处理localhost域名的URL，将其转换为实际可访问的地址
 * @param {string} url - 原始URL
 * @returns {Object} - 包含处理后的主机名和原始主机名的对象
 */
function processLocalhostUrl(url) {
  const urlObj = new URL(url);
  const actualHostname = urlObj.hostname.endsWith('.localhost') ? '127.0.0.1' : urlObj.hostname;
  
  return {
    urlObj,
    actualHostname,
    originalHostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80)
  };
}

/**
 * 创建适配localhost域名的fetch选项
 * @param {string} url - 要访问的URL
 * @param {Object} options - 原始fetch选项
 * @returns {Array} - [处理后的URL, 更新后的选项]
 */
function createLocalhostFetchOptions(url, options = {}) {
  const { urlObj, actualHostname, originalHostname, port } = processLocalhostUrl(url);
  
  // 构建实际访问的URL
  const actualUrl = `${urlObj.protocol}//${actualHostname}:${port}${urlObj.pathname}${urlObj.search}`;
  
  // 更新headers，保持原始域名作为Host头
  const updatedOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Host': originalHostname
    }
  };
  
  return [actualUrl, updatedOptions];
}

/**
 * 测试网站生成API
 */
async function testWebsiteGeneration() {
  console.log('🚀 开始测试 LocalSite AI API...\n');

  // 测试用例配置
  const testCases = [
    {
      name: '基础网站生成',
      config: {
        prompt: '创建一个简单的个人博客首页，包含导航栏、文章列表和页脚',
        selectedSystemPrompt: 'default',
      }
    },
    {
      name: '思考模式生成',
      config: {
        prompt: '创建一个现代化的作品集网站，带有响应式设计和深色主题',
        selectedSystemPrompt: 'thinking',

        maxTokens: 4000
      }
    },
    {
      name: '自定义系统提示',
      config: {
        prompt: '创建一个简单的登录页面',
        selectedSystemPrompt: 'custom',
        customSystemPrompt: '你是一个专业的前端开发者。请生成一个使用Tailwind CSS的现代化登录页面，包含用户名、密码输入框和登录按钮。页面应该居中显示且具有良好的视觉效果。',

      }
    }
  ];

  // 执行测试用例
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📝 测试 ${i + 1}: ${testCase.name}`);
    console.log(`提示词: ${testCase.config.prompt}`);
    console.log(`模式: ${testCase.config.selectedSystemPrompt}`);
    console.log('---');

    try {
      const startTime = Date.now();
      const html = await generateWebsite(testCase.config);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      console.log(`✅ 生成成功！`);
      console.log(`⏱️  耗时: ${duration.toFixed(2)}秒`);
      console.log(`📄 HTML长度: ${html.length} 字符`);
      
      // 保存生成的HTML文件
      const filename = `test-${i + 1}-${testCase.name.replace(/\s+/g, '-')}.html`;
      await saveToFile(filename, html);
      console.log(`💾 已保存到: ${filename}`);
      
    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }
}

/**
 * 调用网站生成API
 */
async function generateWebsite(config) {
  const url = `${API_BASE_URL}/api/website-generation`;
  
  try {
    console.log('🔄 正在发送请求...');
    
    // 使用localhost处理函数
    const [actualUrl, fetchOptions] = createLocalhostFetchOptions(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    const response = await fetch(actualUrl, fetchOptions);

    if (!response.ok) {
      let errorMessage = '生成网站时出错';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        errorMessage = `HTTP错误: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    // 处理流式响应
    let result = '';
    let contentLength = 0;
    let lastProgressTime = Date.now();

    console.log('📡 正在接收流式响应...');

    // 使用Node.js流处理方式
    const reader = response.body;
    
    return new Promise((resolve, reject) => {
      reader.on('readable', () => {
        let chunk;
        while (null !== (chunk = reader.read())) {
          const chunkText = chunk.toString();
          result += chunkText;
          contentLength += chunk.length;
          
          // 每500ms更新一次进度
          const now = Date.now();
          if (now - lastProgressTime > 500) {
            process.stdout.write(`\r📊 已接收: ${contentLength} 字节，当前长度: ${result.length} 字符`);
            lastProgressTime = now;
          }
        }
      });
      
      reader.on('end', () => {
        console.log(`\n✨ 流式响应完成，总大小: ${contentLength} 字节`);
        resolve(result);
      });
      
      reader.on('error', (err) => {
        reject(err);
      });
    });

  } catch (error) {
    console.error('🚨 API调用失败:', error.message);
    throw error;
  }
}

/**
 * 保存HTML到文件
 */
async function saveToFile(filename, content) {
  const fs = require('fs').promises;
  const path = require('path');
  
  // 确保输出目录存在
  const outputDir = './work_dir/test-output';
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (e) {
    // 目录已存在
  }
  
  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, content, 'utf8');
}

/**
 * 简单的性能测试
 */
async function performanceTest() {
  console.log('🏃‍♂️ 开始性能测试...\n');
  
  const testConfig = {
    prompt: '创建一个简单的HTML页面，包含标题和段落',
    model: 'deepseek-coder-33b-instruct',
    provider: 'deepseek',
    selectedSystemPrompt: 'default'
  };

  const iterations = 3;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    console.log(`🔄 第 ${i + 1} 次测试...`);
    
    try {
      const startTime = Date.now();
      await generateWebsite(testConfig);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      times.push(duration);
      console.log(`⏱️  耗时: ${(duration / 1000).toFixed(2)}秒`);
      
    } catch (error) {
      console.error(`❌ 第 ${i + 1} 次测试失败: ${error.message}`);
    }
  }

  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log('\n📊 性能统计:');
    console.log(`平均耗时: ${(avgTime / 1000).toFixed(2)}秒`);
    console.log(`最短耗时: ${(minTime / 1000).toFixed(2)}秒`);
    console.log(`最长耗时: ${(maxTime / 1000).toFixed(2)}秒`);
  }
}

// 主函数
async function main() {
  console.log('🎯 LocalSite AI API 测试工具\n');
  
  // 检查命令行参数
  const args = process.argv.slice(2);
  
  if (args.includes('--performance')) {
    await performanceTest();
  } else {
    await testWebsiteGeneration();
  }
  
  console.log('🎉 测试完成！');
}

// 运行测试
if (require.main === module) {
  main().catch(error => {
    console.error('💥 测试过程中发生错误:', error);
    process.exit(1);
  });
}

module.exports = { generateWebsite, testWebsiteGeneration }; 