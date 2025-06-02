const http = require('http');
const https = require('https');

/**
 * 简单的HTTP请求函数
 * @param {string} url - 要访问的URL
 * @returns {Promise} - 返回响应数据的Promise
 */
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        // 如果是 localhost 域名，使用 127.0.0.1 作为实际主机
        const actualHostname = urlObj.hostname.endsWith('.localhost') ? '127.0.0.1' : urlObj.hostname;
        
        const options = {
            hostname: actualHostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': 'LocalSite-AI Test Script',
                'Host': urlObj.hostname  // 保持原始域名作为 Host 头
            }
        };

        const req = protocol.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.end();
    });
}

/**
 * 测试访问LocalSite-AI网站
 */
async function testWebsiteAccess() {
    const targetUrl = 'http://localsite-ai.localhost/';
    
    console.log(`开始访问: ${targetUrl}`);
    
    try {
        const response = await makeRequest(targetUrl);
        
        console.log('访问成功!');
        console.log(`状态码: ${response.statusCode}`);
        console.log(`响应头:`, response.headers);
        console.log(`响应体长度: ${response.body.length} 字符`);
        
        // 如果是HTML内容，显示前200个字符
        if (response.headers['content-type'] && response.headers['content-type'].includes('text/html')) {
            console.log('HTML内容预览:');
            console.log(response.body.substring(0, 200) + '...');
        }
        
        return response;
        
    } catch (error) {
        console.error('访问失败:', error.message);
        throw error;
    }
}

// 如果直接运行这个文件，执行测试
if (require.main === module) {
    testWebsiteAccess()
        .then(() => {
            console.log('测试完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('测试失败:', error);
            process.exit(1);
        });
}

module.exports = {
    testWebsiteAccess,
    makeRequest
};
