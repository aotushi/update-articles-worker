/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { GoogleGenAI } from "@google/genai";


// 首先定义不同任务的配置
const TASK_CONFIGS = {
	'update-long-tail-titles': {
		// model: "gemini-2.0-flash",
		// model: "gemini-2.5-pro-preview-06-05",
		model: "gemini-1.5-pro",
		generationConfig: {
			temperature: 0.25,  // Even lower temperature for more deterministic output
			topK: 15,         // Further reduced to limit token selection
			topP: 0.7,        // Lower topP for more focused output
			maxOutputTokens: 1024,
		},
		safetySettings: [
			{
				category: "HARM_CATEGORY_HARASSMENT",
				threshold: "BLOCK_MEDIUM_AND_ABOVE"
			},
			{
				category: "HARM_CATEGORY_HATE_SPEECH",
				threshold: "BLOCK_MEDIUM_AND_ABOVE"
			}
		]
	},
	'generate-articles-by-new-tail-titles': {
		// model: "gemini-2.5-pro-preview-06-05",
		model: "gemini-1.5-pro",
		generationConfig: {
			temperature: 0.7,  // 适中的温度，平衡创造性和准确性
			topK: 40,
			topP: 0.95,
			maxOutputTokens: 4096,  // 增加到 4096，确保能生成 1200 字左右的中文文章
		},
		safetySettings: [
			{
				category: "HARM_CATEGORY_HARASSMENT",
				threshold: "BLOCK_MEDIUM_AND_ABOVE"
			},
			{
				category: "HARM_CATEGORY_HATE_SPEECH",
				threshold: "BLOCK_MEDIUM_AND_ABOVE"
			},
			{
				category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
				threshold: "BLOCK_MEDIUM_AND_ABOVE"
			},
			{
				category: "HARM_CATEGORY_DANGEROUS_CONTENT",
				threshold: "BLOCK_MEDIUM_AND_ABOVE"
			}
		]
	}
};

// 修改生成内容的函数
async function generateLongContent(ai, prompt, taskType, maxRetries = 3) {
	let retries = 0;
	const config = TASK_CONFIGS[taskType];
	
	while (retries < maxRetries) {
		try {
			const response = await ai.models.generateContent({
				model: config.model,
				contents: prompt,
				generationConfig: config.generationConfig,
				safetySettings: config.safetySettings
			});

			// 删除开头的 markdown 标记
			const content = response.text.replace(/^```markdown\n/, '');
			return content;
		} catch (error) {
			if (error.message.includes('quota') || error.message.includes('rate limit')) {
				await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
				retries++;
				continue;
			}
			throw error;
		}
	}
	throw new Error('Max retries exceeded');
}

// 添加一个清理JSON字符串的函数
function cleanJsonString(str) {
	// 移除Markdown代码块标记
	str = str.replace(/```json\n|\n```/g, '');
	// 解析JSON字符串
	try {
		const jsonObj = JSON.parse(str);
		// 重新序列化为格式化的JSON字符串
		return JSON.stringify(jsonObj);
	} catch (e) {
		console.error('JSON parsing error:', e);
		return str;
	}
}

export default {
	
	async fetch(request, env, ctx) {

		// verify api key
		const apiKey = request.headers.get("X-API-Key");
		if (!apiKey || apiKey !== env.API_KEY) {
			return new Response("Invalid API Key", {status: 401});
		}

		// todo new verify method for token like jwt 

		// resolve the request url
		const url = new URL(request.url);
		const path = url.pathname;
		
		try {
			// verify the request method
			if (request.method !== 'POST') {
				return new Response("Invalid request method", {status: 405,
					headers: {
						'Allow': 'POST',
						'Access-Control-Allow-Origin': origin
					}
				});
			}
			// update the categories's long tail title arr
			if (path === '/update-long-tail-titles' || path === '/generate-articles-by-new-tail-titles') {
				try {
					const text = await request.text();

					if (!text) {
						return new Response('empty request body', {status: 400});
					}
					
					const body = JSON.parse(text);
					
					// 验证必要的参数
					if (path === '/update-long-tail-titles') {
						if (!body.jsonData || !body.siteDescription) {
							return new Response("Missing required parameters: jsonData and siteDescription", {status: 400});
						}
					} else if (path === '/generate-articles-by-new-tail-titles') {
						if (!body.jsonData || !body.jsonData.title || !body.jsonData.titleSlug || !body.jsonData.category || !body.jsonData.categorySlug) {
							return new Response("Missing required parameters: title, titleSlug, category, categorySlug", {status: 400});
						}
					}

					// 构建提示词
					
					let prompt = '';
					if (path === '/update-long-tail-titles') {
						prompt = `You are a SEO expert specializing in generating long tail keywords. Your task is to generate 1 new long tail title for each item in the provided JSON data.

						Website Description:
						${body.siteDescription}

						Input Data Structure:
						[
							{
								"id": "string",
								"title": "string",
								"longTailTitleArr": ["string", "string", ...]
							},
							...
						]

						Input Data:
						${body.jsonData}

						Requirements:
						1. For each item in the JSON data, generate exactly 1 new long tail title.
						2. Each new title must:
							- Be between 50-80 characters long
							- Be SEO-friendly and attractive
							- Be unique (no duplicates)
							- The new title MUST be directly related to the original title's topic and should not introduce unrelated subjects or product categories.
							- Match the style and format of existing titles in longTailTitleArr
							- Complement existing titles (provide different angles or aspects)
							- MUST maintain consistency with the website's main theme as described above
							- MUST align with the website's overall content strategy and target audience
						3. CRITICAL ID REQUIREMENT:
							- The id field in the output MUST be EXACTLY the same as the id in the input
							- DO NOT modify the id format or create new semantic ids
							- DO NOT change the id values or their order
							- The id must be a simple string (e.g., "1", "2", "3")
							- Any deviation from the input id will be considered an error
						4. Return a JSON array where each item contains:
							- id: exactly the same as the input id
							- newTitles: array of 1 new title
						5. Do not include the original titles in the response
						6. Do not add or modify any other fields
						7. Your response should be the JSON array with new titles for each item. Do not include any explanations or additional text.

						Example Input:
						{
							"id": "1",
							"title": "Postpartum Weight Loss Basics",
							"longTailTitleArr": [
								"How to Start Losing Weight After Pregnancy: Complete Guide",
								"Understanding Postpartum Weight Loss: What to Expect"
							]
						}

						Example Output:
						{
							"id": "1",
							"newTitles": [
								"Postpartum Weight Loss Timeline: Week by Week Guide"
							]
						}
						`;
					} else if (path === '/generate-articles-by-new-tail-titles') {
						// 获取环境变量中的基础 prompt
						let basePrompt = env.ARTICLE_GENERATION_PROMPT;
						
						// 替换 prompt 中的占位符
						const today = new Date().toISOString().split('T')[0]; // 获取今天的日期 YYYY-MM-DD

						// 替换所有占位符
						basePrompt = basePrompt
							.replace(/\[body\.title\]/g, body.jsonData.title)
							.replace(/\[body\.titleSlug\]/g, body.jsonData.titleSlug)
							.replace(/\[YYYY-MM-DD\]/g, today)
							.replace(/\[body\.category\]/g, body.jsonData.category)
							.replace(/\[body\.categorySlug\]/g, body.jsonData.categorySlug)
							.replace(/\[Current Article Title\]/g, body.jsonData.title);

						// 添加内容格式要求
						basePrompt += "\n\nImportant: Only return the article content in Markdown format. Do not include any schema, JSON, or other metadata formats. The response should start with the front matter (---) and end with the article content.";

						// 添加分类信息验证要求
						basePrompt += "\n\nCategory Information:\n- The article MUST be categorized under: " + body.jsonData.category + "\n- The category slug MUST be: " + body.jsonData.categorySlug + "\n- Do not modify or change these values in the generated content.";

						prompt = basePrompt;
					}

					// 初始化 Gemini
					const ai = new GoogleGenAI({ 
						apiKey: env.Google_API_KEY
					});
					
					// 设置超时
					const timeoutPromise = new Promise((_, reject) => 
						setTimeout(() => reject(new Error('Request timeout')), 1000*60)  // 增加到60秒
					);
					
					// 调用 API 并处理超时
					const taskType = path === '/update-long-tail-titles' 
						? 'update-long-tail-titles' 
						: 'generate-articles-by-new-tail-titles';
					
					try {
						const result = await Promise.race([
							generateLongContent(ai, prompt, taskType),
							timeoutPromise
						]);

						// 根据不同的接口返回不同格式
						if (path === '/update-long-tail-titles') {
							// 长尾标题接口返回 JSON
							const cleanedResult = cleanJsonString(result);
							return new Response(JSON.stringify({
								success: true,
								result: cleanedResult
							}), {
								status: 200,
								headers: {
									'Content-Type': 'application/json',
									'Access-Control-Allow-Origin': origin,
									'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
									'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
								}
							});
						} else {
							// 文章生成接口返回 Markdown
							return new Response(result, {
								status: 200,
								headers: {
									'Content-Type': 'text/markdown',
									'Access-Control-Allow-Origin': origin,
									'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
									'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
								}
							});
						}
					} catch (error) {
						// 记录到 Cloudflare Workers 的日志
						console.error('Workers API Error:', {
							error: error.message,
							taskType: taskType,
							timestamp: new Date().toISOString(),
							inputLength: body.jsonData ? JSON.stringify(body.jsonData).length : 0
						});
						
						// 返回更友好的错误信息
						return new Response(JSON.stringify({
							success: false,
							error: error.message === 'Request timeout' ? 'Service timeout, please try again' : 'Service temporarily unavailable',
							message: error.message,
							taskType: taskType
						}), {
							status: error.message === 'Request timeout' ? 504 : 503,
							headers: {
								'Content-Type': 'application/json',
								'Access-Control-Allow-Origin': origin
							}
						});
					}
				} catch(error) {
					console.log('error>', error);
					return new Response(error.message, {status: 400, headers: {
						'Access-Control-Allow-Origin': origin
					}});
				}
			}





			// 其他API请求的处理 直接返回不进行处理



		} catch(error) {
			console.log('error>', error);
			
			return new Response(error.message, {status: 500});
		}
	}
};
