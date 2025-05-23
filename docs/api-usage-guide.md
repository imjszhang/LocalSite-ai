# LocalSite AI API 使用指南

LocalSite AI 提供了一个完整的网站生成 API，使外部应用程序能够根据文本描述生成网站代码，并支持流式响应和智能思考模式。

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
| systemPrompt | string | 否 | 自定义系统提示，覆盖默认提示（已弃用，建议使用selectedSystemPrompt） |
| selectedSystemPrompt | string | 否 | 系统提示模式选择（'default', 'thinking', 'custom'） |
| customSystemPrompt | string | 否 | 自定义系统提示内容（当selectedSystemPrompt为'custom'时使用） |
| maxTokens | number | 否 | 生成的最大令牌数 |
| apiKey | string | 否 | API密钥（如果需要） |
| continuationMode | boolean | 否 | 是否为继续生成模式（默认：false） |
| existingCode | string | 否 | 现有代码（在continuationMode为true时使用） |
| maxContinuationAttempts | number | 否 | 最大自动继续生成尝试次数（默认：10） |

### 系统提示模式

API 支持三种系统提示模式：

1. **default**: 使用默认的系统提示词
2. **thinking**: 启用思考模式，AI会在生成代码前先进行详细的思考过程
3. **custom**: 使用用户提供的自定义系统提示词

### 响应

API 返回一个流式响应，包含生成的 HTML 代码。在 thinking 模式下，响应会包含 `<think>` 标签包围的思考过程，这些内容会被自动过滤，只返回纯净的 HTML 代码。

API 还具备智能完整性检查功能，如果生成的 HTML 不完整，会自动继续生成直到完整为止。

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
async function generateWebsite(prompt, model, options = {}) {
  try {
    // 创建请求体
    const requestBody = {
      prompt,
      model,
      ...options
    };

    // 创建请求
    const response = await fetch('http://yoursite.com/api/website-generation', {
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

// 基础使用示例
generateWebsite(
  '创建一个个人作品集网站，带有响应式设计、深色主题、项目展示部分和联系表单',
  'deepseek-coder-33b-instruct',
  {
    provider: 'deepseek'
  }
)
  .then(html => {
    console.log('生成的HTML:', html);
    // 在这里处理生成的HTML
  })
  .catch(error => {
    console.error('错误:', error.message);
  });

// 使用思考模式
generateWebsite(
  '创建一个现代化的电子商务网站首页',
  'deepseek-coder-33b-instruct',
  {
    provider: 'deepseek',
    selectedSystemPrompt: 'thinking'
  }
)
  .then(html => {
    console.log('生成的HTML（已过滤思考过程）:', html);
  })
  .catch(error => {
    console.error('错误:', error.message);
  });

// 使用自定义系统提示
generateWebsite(
  '创建一个博客网站',
  'deepseek-coder-33b-instruct',
  {
    provider: 'deepseek',
    selectedSystemPrompt: 'custom',
    customSystemPrompt: '你是一个专业的前端开发者。请生成一个使用 Tailwind CSS 的响应式博客网站，包含导航栏、文章列表、侧边栏和页脚。所有代码应该在一个HTML文件中。'
  }
)
  .then(html => {
    console.log('生成的HTML:', html);
  })
  .catch(error => {
    console.error('错误:', error.message);
  });
```

### Python/Requests

```python
import requests
import json

def generate_website(prompt, model, provider=None, selected_system_prompt=None, 
                    custom_system_prompt=None, max_tokens=None, max_continuation_attempts=None,
                    api_key=None, continuation_mode=False, existing_code=''):
    """
    使用 LocalSite AI API 生成网站并处理流式响应
    
    参数:
        prompt (str): 描述所需网站的文本提示
        model (str): 要使用的模型名称
        provider (str, optional): AI 提供商
        selected_system_prompt (str, optional): 系统提示模式 ('default', 'thinking', 'custom')
        custom_system_prompt (str, optional): 自定义系统提示内容
        max_tokens (int, optional): 生成的最大令牌数
        max_continuation_attempts (int, optional): 最大自动继续生成尝试次数
        api_key (str, optional): API密钥
        continuation_mode (bool, optional): 是否为继续生成模式
        existing_code (str, optional): 现有代码
    
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
    if selected_system_prompt:
        payload["selectedSystemPrompt"] = selected_system_prompt
    if custom_system_prompt:
        payload["customSystemPrompt"] = custom_system_prompt
    if max_tokens:
        payload["maxTokens"] = max_tokens
    if max_continuation_attempts:
        payload["maxContinuationAttempts"] = max_continuation_attempts
    if api_key:
        payload["apiKey"] = api_key
    if continuation_mode:
        payload["continuationMode"] = continuation_mode
    if existing_code:
        payload["existingCode"] = existing_code
    
    try:
        # 发送请求并获取流式响应
        response = requests.post(url, json=payload, stream=True)
        
        # 检查错误
        if response.status_code != 200:
            try:
                error_data = response.json()
                raise Exception(error_data.get("error", "生成网站时出错"))
            except ValueError:
                # 如果响应不是JSON
                raise Exception(f"HTTP错误: {response.status_code} {response.reason}")
        
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

# 基础使用示例
if __name__ == "__main__":
    prompt = "创建一个简单的博客首页，带有导航栏、文章列表和侧边栏"
    model = "deepseek-coder-33b-instruct"
    
    try:
        # 使用思考模式生成
        html = generate_website(
            prompt, 
            model, 
            provider="deepseek",
            selected_system_prompt="thinking"
        )
        print("成功生成HTML，长度:", len(html))
        
        # 保存生成的HTML
        with open("generated_website.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("已保存到 generated_website.html")
    except Exception as e:
        print(f"生成失败: {str(e)}")
```

## 高级用法

### 思考模式

思考模式让 AI 在生成代码前进行详细的思考过程，通常能产生更高质量的代码：

```javascript
generateWebsite(
  '创建一个复杂的单页应用程序',
  'deepseek-coder-33b-instruct',
  {
    provider: 'deepseek',
    selectedSystemPrompt: 'thinking',
    maxTokens: 4000
  }
);
```

### 自定义系统提示

您可以提供完全自定义的系统提示来控制生成行为：

```javascript
const customPrompt = `你是一个专业的网页设计师和开发者。请生成一个现代化的、响应式的网站，使用以下要求：
1. 使用现代CSS Grid和Flexbox布局
2. 包含深色模式切换功能
3. 使用渐变色和阴影效果
4. 确保在所有设备上都能良好显示
5. 包含平滑的动画过渡效果
所有代码必须在一个HTML文件中，包含内联CSS和JavaScript。`;

generateWebsite(
  '创建一个摄影师作品集网站',
  'deepseek-coder-33b-instruct',
  {
    provider: 'deepseek',
    selectedSystemPrompt: 'custom',
    customSystemPrompt: customPrompt
  }
);
```

### 控制自动继续生成

您可以控制 API 自动继续生成不完整内容的行为：

```javascript
generateWebsite(
  '创建一个包含大量内容的企业网站',
  'deepseek-coder-33b-instruct',
  {
    provider: 'deepseek',
    maxContinuationAttempts: 15,  // 最多尝试15次继续生成
    maxTokens: 8000
  }
);
```

### 继续生成模式

您可以基于现有代码继续生成：

```javascript
generateWebsite(
  '继续完成这个网站',
  'deepseek-coder-33b-instruct',
  {
    provider: 'deepseek',
    continuationMode: true,
    existingCode: '<!DOCTYPE html><html><head>...'
  }
);
```

### 长内容生成示例

```bash
# 使用思考模式生成复杂网站
node scripts/website-generator.js \
  --prompt "创建一个完整的电子商务网站..." \
  --selected-system-prompt thinking \
  --max-continuation-attempts 15 \
  --output "./work_dir/complex-ecommerce.html"

# 使用自定义系统提示
node scripts/website-generator.js \
  --prompt "创建一个艺术画廊网站" \
  --selected-system-prompt custom \
  --custom-system-prompt "你是一个专业的艺术网站设计师..." \
  --output "./work_dir/art-gallery.html"
```

## 注意事项

1. **思考模式**：在思考模式下，生成时间可能会更长，但通常能产生更高质量的代码。思考过程会被自动过滤，只返回纯净的HTML代码。
2. **自动继续生成**：API 会自动检测生成的 HTML 是否完整，如果不完整会自动继续生成，最多尝试 `maxContinuationAttempts` 次（默认10次）。
3. **流式响应**：使用流式响应可以提供更好的用户体验，让用户看到实时生成的内容。
4. **错误处理**：对于生产环境，建议实现适当的错误处理和重试机制。响应可能是JSON格式的错误信息，也可能是HTTP状态错误。
5. **本地模型**：如果使用本地模型（Ollama 或 LM Studio），确保这些服务在调用 API 时正在运行。
6. **令牌限制**：对于复杂的网站，可能需要增加 `maxTokens` 参数以确保生成完整的内容。
7. **继续生成模式**：API支持继续生成模式，可以基于现有代码继续生成内容。
8. **系统提示兼容性**：`systemPrompt` 参数仍然支持但已弃用，建议使用 `selectedSystemPrompt` 和 `customSystemPrompt` 的组合。 