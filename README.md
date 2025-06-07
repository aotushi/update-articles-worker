# 文章更新工作器 (Update Articles Worker)

这是一个基于 Cloudflare Workers 的文章更新服务，主要用于生成和更新文章的长尾标题。

## 功能特性

- 支持生成 SEO 友好的长尾标题
- 基于 Google Gemini AI 模型进行内容生成
- 支持自定义生成参数和模型配置
- 内置安全检查和错误处理机制
- 支持跨域请求 (CORS)

## 技术栈

- Cloudflare Workers
- Google Gemini AI API
- Node.js

## 环境要求

- Node.js 16+
- Cloudflare Workers CLI (wrangler)
- Google Gemini AI API Key

## 配置说明

### 环境变量

在 Cloudflare Workers 中需要配置以下环境变量：

```env
API_KEY=your_api_key_here
Google_API_KEY=your_google_api_key_here
ARTICLE_GENERATION_PROMPT=your_article_generation_prompt_here
```

### API 密钥验证

所有请求都需要在 header 中包含 `X-API-Key` 进行身份验证。

## API 接口

### 1. 更新长尾标题

**端点**: `/update-long-tail-titles`

**方法**: POST

**请求体**:
```json
{
    "jsonData": [
        {
            "id": "1",
            "title": "文章标题",
            "longTailTitleArr": ["已有长尾标题1", "已有长尾标题2"]
        }
    ]
}
```

**响应**:
```json
{
    "success": true,
    "result": "[{\"id\":\"1\",\"newTitles\":[\"新生成的长尾标题\"]}]"
}
```

### 2. 根据新标题生成文章

**端点**: `/generate-articles-by-new-tail-titles`

**方法**: POST

**请求体**:
```json
{
    "jsonData": {
        "title": "文章标题",
        "titleSlug": "article-title-slug",
        "category": "分类名称",
        "categorySlug": "category-slug"
    }
}
```

**响应**: Markdown 格式的文章内容

## 错误处理

服务会返回以下 HTTP 状态码：

- 200: 请求成功
- 400: 请求参数错误
- 401: API 密钥无效
- 405: 请求方法不支持
- 503: 服务暂时不可用
- 504: 请求超时

## 开发指南

1. 安装依赖：
```bash
npm install
```

2. 本地开发：
```bash
npm run dev
```

3. 部署：
```bash
npm run deploy
```

## 注意事项

1. 所有请求必须包含有效的 API 密钥
2. 生成的长尾标题长度应在 50-80 字符之间
3. 确保输入数据的 id 字段格式正确
4. 注意 API 调用频率限制

## 性能优化

- 使用缓存减少重复请求
- 实现请求超时机制
- 错误重试机制
- 异步处理大量请求

## 安全措施

- API 密钥验证
- 请求频率限制
- 输入数据验证
- 错误信息脱敏

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License 