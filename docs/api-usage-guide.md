# LocalSite AI API 使用指南

LocalSite AI 提供了一个完整的网站生成 API，使外部应用程序能够根据文本描述生成网站代码，并支持流式响应。

## API 端点

### 网站生成 API

**端点**: `/api/website-generation`

**方法**: `POST`

**Content-Type**: `application/json`

### 请求参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| prompt | string | 是 | 描述所需网站的文本提示 |
| model | string | 是 | 要使用的 AI 模型名称 |
| provider | string | 否 | AI 提供商（deepseek, openai_compatible, ollama, lm_studio） |
| systemPrompt | string | 否 | 自定义系统提示，覆盖默认提示 |
| maxTokens | number | 否 | 生成的最大令牌数 |

### 响应

API 返回一个流式响应，包含生成的 HTML 代码。客户端应该处理这个流式响应以获取完整的生成内容。

### 错误处理

API 可能返回以下错误代码：

- `400`: 请求参数不完整或无效
- `500`: 服务器内部错误

错误响应格式：

```json
{
  "error": "错误消息"
}
```

## 使用示例

### JavaScript/Fetch API

```javascript
async function generateWebsite(prompt, model, provider = null) {
  try {
    // 创建请求
    const response = await fetch('http://yoursite.com/api/website-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        model,
        provider
      })
    });

    // 检查响应状态
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '生成网站时出错');
    }

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // 将二进制数据转换为文本并追加到结果
      result += decoder.decode(value, { stream: true });
      
      // 可以在这里处理增量更新，例如显示到UI
      updateUI(result); // 自定义函数，根据需要实现
    }

    return result;
  } catch (error) {
    console.error('生成网站失败:', error);
    throw error;
  }
}

// 使用示例
generateWebsite(
  '创建一个个人作品集网站，带有响应式设计、深色主题、项目展示部分和联系表单',
  'deepseek-coder-33b-instruct'
)
  .then(html => {
    console.log('生成的HTML:', html);
    // 在这里处理生成的HTML
  })
  .catch(error => {
    console.error('错误:', error.message);
  });
```

### Python/Requests

```python
import requests
import json

def generate_website(prompt, model, provider=None, system_prompt=None, max_tokens=None):
    """
    使用 LocalSite AI API 生成网站并处理流式响应
    
    参数:
        prompt (str): 描述所需网站的文本提示
        model (str): 要使用的模型名称
        provider (str, optional): AI 提供商
        system_prompt (str, optional): 自定义系统提示
        max_tokens (int, optional): 生成的最大令牌数
    
    返回:
        str: 生成的 HTML 代码
    """
    url = "http://yoursite.com/api/website-generation"
    
    payload = {
        "prompt": prompt,
        "model": model
    }
    
    # 添加可选参数
    if provider:
        payload["provider"] = provider
    if system_prompt:
        payload["systemPrompt"] = system_prompt
    if max_tokens:
        payload["maxTokens"] = max_tokens
    
    try:
        # 发送请求并获取流式响应
        response = requests.post(url, json=payload, stream=True)
        
        # 检查错误
        if response.status_code != 200:
            error_data = response.json()
            raise Exception(error_data.get("error", "生成网站时出错"))
        
        # 处理流式响应
        result = ""
        for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
            if chunk:
                result += chunk
                # 可以在这里处理增量更新
                print("收到新块，当前长度:", len(result))
        
        return result
    
    except Exception as e:
        print(f"错误: {str(e)}")
        raise

# 使用示例
if __name__ == "__main__":
    prompt = "创建一个简单的博客首页，带有导航栏、文章列表和侧边栏"
    model = "deepseek-coder-33b-instruct"
    
    try:
        html = generate_website(prompt, model)
        print("成功生成HTML，长度:", len(html))
        # 在这里处理生成的HTML
        with open("generated_website.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("已保存到 generated_website.html")
    except Exception as e:
        print(f"生成失败: {str(e)}")
```

## 高级用法

### 自定义系统提示

您可以通过提供 `systemPrompt` 参数来自定义生成的指令：

```javascript
const customSystemPrompt = "生成一个使用 Bootstrap 框架的响应式网站，包含必要的 HTML 结构、内联 CSS 样式和 JavaScript 功能。网站应该完全自包含在一个 HTML 文件中。";

generateWebsite(
  '创建一个电子商务网站首页',
  'deepseek-coder-33b-instruct',
  'deepseek',
  customSystemPrompt
);
```

### 设置最大令牌数

对于较长的生成内容，您可能需要增加最大令牌数：

```javascript
generateWebsite(
  '创建一个复杂的单页应用程序，包含用户注册、登录和仪表板功能',
  'deepseek-coder-33b-instruct',
  'deepseek',
  null,  // 使用默认系统提示
  4000   // 最大令牌数
);
```

### 长内容生成

```bash
node scripts/website-generator.js --prompt "创建一个完整的电子商务网站，包含以下内容：1. 响应式导航栏，带有公司logo、产品分类下拉菜单、搜索栏和购物车图标；2. 主页大型轮播图展示，至少3张高质量产品图片轮播；3. 特色产品部分，展示至少6个不同产品卡片，每个卡片包含产品图片、名称、简短描述、价格和'加入购物车'按钮；4. 产品详情部分，展示至少3个产品的详细信息，包含多张产品图片、详细规格表、产品描述和用户评价；5. 客户评价部分，至少5个客户评价，带有用户头像、星级评分和评价内容；6. 公司介绍部分，包含公司历史、使命愿景和团队成员介绍；7. 完整的联系表单，包含姓名、邮箱、电话、留言内容和提交按钮；8. 页脚部分，包含版权信息、社交媒体链接、网站地图和新闻订阅表单；9. 弹出式优惠券模态框，显示限时折扣代码；10. 响应式设计，确保在手机、平板和桌面设备上都能良好显示；使用现代设计风格，适当的动画效果和优雅的配色方案。所有内容应完全在一个HTML文件中，CSS和JavaScript都内嵌其中。" --output "./work_dir/long-ecommerce-website.html"
```

## 注意事项

1. 生成过程可能需要一些时间，特别是对于复杂的提示。
2. 使用流式响应可以提供更好的用户体验，让用户看到实时生成的内容。
3. 对于生产环境，建议实现适当的错误处理和重试机制。
4. 如果使用本地模型（Ollama 或 LM Studio），确保这些服务在调用 API 时正在运行。 