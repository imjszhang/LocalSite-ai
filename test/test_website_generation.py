#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LocalSite AI API 测试脚本
"""

import requests
import json
import time
import os
import sys
from typing import Dict, Any, Optional

# API配置
API_BASE_URL = "http://localhost:3000"  # 根据您的实际部署地址修改
OUTPUT_DIR = "./test-output"

def ensure_output_dir():
    """确保输出目录存在"""
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

def generate_website(config: Dict[str, Any]) -> str:
    """
    调用网站生成API
    
    Args:
        config: API请求配置
        
    Returns:
        str: 生成的HTML代码
    """
    url = f"{API_BASE_URL}/api/website-generation"
    
    try:
        print("🔄 正在发送请求...")
        
        # 发送请求并获取流式响应
        response = requests.post(url, json=config, stream=True)
        
        # 检查错误
        if response.status_code != 200:
            try:
                error_data = response.json()
                raise Exception(error_data.get("error", "生成网站时出错"))
            except ValueError:
                raise Exception(f"HTTP错误: {response.status_code} {response.reason}")
        
        # 处理流式响应
        print("📡 正在接收流式响应...")
        result = ""
        chunk_count = 0
        
        for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
            if chunk:
                result += chunk
                chunk_count += 1
                
                # 显示进度
                if chunk_count % 10 == 0:
                    print(f"\r📊 已接收 {chunk_count} 个数据块，当前长度: {len(result)} 字符", end="")
        
        print(f"\n✨ 流式响应完成，共接收 {chunk_count} 个数据块")
        return result
    
    except Exception as e:
        print(f"🚨 API调用失败: {str(e)}")
        raise

def save_to_file(filename: str, content: str):
    """保存HTML到文件"""
    ensure_output_dir()
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"💾 已保存到: {filepath}")

def test_website_generation():
    """测试网站生成API"""
    print("🚀 开始测试 LocalSite AI API...\n")
    
    # 测试用例配置
    test_cases = [
        {
            "name": "基础网站生成",
            "config": {
                "prompt": "创建一个简单的个人博客首页，包含导航栏、文章列表和页脚",
                "model": "deepseek-coder-33b-instruct",
                "provider": "deepseek",
                "selectedSystemPrompt": "default"
            }
        },
        {
            "name": "思考模式生成",
            "config": {
                "prompt": "创建一个现代化的作品集网站，带有响应式设计和深色主题",
                "model": "deepseek-coder-33b-instruct",
                "provider": "deepseek",
                "selectedSystemPrompt": "thinking",
                "maxTokens": 4000
            }
        },
        {
            "name": "自定义系统提示",
            "config": {
                "prompt": "创建一个简单的登录页面",
                "model": "deepseek-coder-33b-instruct",
                "provider": "deepseek",
                "selectedSystemPrompt": "custom",
                "customSystemPrompt": "你是一个专业的前端开发者。请生成一个使用Tailwind CSS的现代化登录页面，包含用户名、密码输入框和登录按钮。页面应该居中显示且具有良好的视觉效果。"
            }
        }
    ]
    
    # 执行测试用例
    for i, test_case in enumerate(test_cases, 1):
        print(f"📝 测试 {i}: {test_case['name']}")
        print(f"提示词: {test_case['config']['prompt']}")
        print(f"模式: {test_case['config']['selectedSystemPrompt']}")
        print("---")
        
        try:
            start_time = time.time()
            html = generate_website(test_case['config'])
            end_time = time.time()
            duration = end_time - start_time
            
            print(f"✅ 生成成功！")
            print(f"⏱️  耗时: {duration:.2f}秒")
            print(f"📄 HTML长度: {len(html)} 字符")
            
            # 保存生成的HTML文件
            filename = f"test-{i}-{test_case['name'].replace(' ', '-')}.html"
            save_to_file(filename, html)
            
        except Exception as error:
            print(f"❌ 测试失败: {str(error)}")
        
        print("\n" + "=" * 50 + "\n")

def performance_test():
    """性能测试"""
    print("🏃‍♂️ 开始性能测试...\n")
    
    test_config = {
        "prompt": "创建一个简单的HTML页面，包含标题和段落",
        "model": "deepseek-coder-33b-instruct",
        "provider": "deepseek",
        "selectedSystemPrompt": "default"
    }
    
    iterations = 3
    times = []
    
    for i in range(iterations):
        print(f"🔄 第 {i + 1} 次测试...")
        
        try:
            start_time = time.time()
            generate_website(test_config)
            end_time = time.time()
            duration = end_time - start_time
            
            times.append(duration)
            print(f"⏱️  耗时: {duration:.2f}秒")
            
        except Exception as error:
            print(f"❌ 第 {i + 1} 次测试失败: {str(error)}")
    
    if times:
        avg_time = sum(times) / len(times)
        min_time = min(times)
        max_time = max(times)
        
        print("\n📊 性能统计:")
        print(f"平均耗时: {avg_time:.2f}秒")
        print(f"最短耗时: {min_time:.2f}秒")
        print(f"最长耗时: {max_time:.2f}秒")

def interactive_test():
    """交互式测试"""
    print("🎮 交互式测试模式\n")
    
    while True:
        print("请输入网站描述（输入 'quit' 退出）:")
        prompt = input("> ").strip()
        
        if prompt.lower() in ['quit', 'exit', 'q']:
            break
        
        if not prompt:
            print("❌ 请输入有效的描述")
            continue
        
        config = {
            "prompt": prompt,
            "model": "deepseek-coder-33b-instruct",
            "provider": "deepseek",
            "selectedSystemPrompt": "default"
        }
        
        try:
            print(f"\n🔄 正在生成网站...")
            start_time = time.time()
            html = generate_website(config)
            end_time = time.time()
            
            print(f"✅ 生成完成！耗时: {(end_time - start_time):.2f}秒")
            print(f"📄 HTML长度: {len(html)} 字符")
            
            # 保存文件
            timestamp = int(time.time())
            filename = f"interactive-{timestamp}.html"
            save_to_file(filename, html)
            
        except Exception as error:
            print(f"❌ 生成失败: {str(error)}")
        
        print("\n" + "-" * 30 + "\n")

def main():
    """主函数"""
    print("🎯 LocalSite AI API 测试工具\n")
    
    # 检查命令行参数
    if len(sys.argv) > 1:
        mode = sys.argv[1]
        
        if mode == "--performance":
            performance_test()
        elif mode == "--interactive":
            interactive_test()
        elif mode == "--help":
            print("使用方法:")
            print("  python test_website_generation.py           # 运行标准测试")
            print("  python test_website_generation.py --performance  # 运行性能测试")
            print("  python test_website_generation.py --interactive  # 交互式测试")
            print("  python test_website_generation.py --help         # 显示帮助")
            return
        else:
            print(f"❌ 未知参数: {mode}")
            print("使用 --help 查看可用选项")
            return
    else:
        test_website_generation()
    
    print("🎉 测试完成！")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏹️  测试被用户中断")
    except Exception as error:
        print(f"\n💥 测试过程中发生错误: {str(error)}")
        sys.exit(1) 