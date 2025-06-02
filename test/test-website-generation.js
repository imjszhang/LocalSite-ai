// LocalSite AI API 测试脚本
const API_BASE_URL = 'http://localhost:3000'; // 根据您的实际部署地址修改

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
        model: 'deepseek-coder-33b-instruct',
        provider: 'deepseek',
        selectedSystemPrompt: 'default'
      }
    },
    {
      name: '思考模式生成',
      config: {
        prompt: '创建一个现代化的作品集网站，带有响应式设计和深色主题',
        model: 'deepseek-coder-33b-instruct',
        provider: 'deepseek',
        selectedSystemPrompt: 'thinking',
        maxTokens: 4000
      }
    },
    {
      name: '自定义系统提示',
      config: {
        prompt: '创建一个简单的登录页面',
        model: 'deepseek-coder-33b-instruct',
        provider: 'deepseek',
        selectedSystemPrompt: 'custom',
        customSystemPrompt: '你是一个专业的前端开发者。请生成一个使用Tailwind CSS的现代化登录页面，包含用户名、密码输入框和登录按钮。页面应该居中显示且具有良好的视觉效果。'
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
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

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
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    let chunkCount = 0;

    console.log('📡 正在接收流式响应...');

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      result += decoder.decode(value, { stream: true });
      chunkCount++;
      
      // 显示进度
      if (chunkCount % 10 === 0) {
        process.stdout.write(`\r📊 已接收 ${chunkCount} 个数据块，当前长度: ${result.length} 字符`);
      }
    }

    console.log(`\n✨ 流式响应完成，共接收 ${chunkCount} 个数据块`);
    return result;

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
  const outputDir = './test-output';
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