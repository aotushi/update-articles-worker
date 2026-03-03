import { describe, it, expect } from 'vitest';
import { validateArticleBody } from './index.js';

describe('validateArticleBody', () => {
	it('should pass for valid article with sufficient content and heading', () => {
		const content = `---
title: "Test Article"
description: "Test description"
date: "2026-03-03"
---

${'Lorem ipsum dolor sit amet. '.repeat(50)}

# Main Heading

This is the article body with proper heading.`;

		const result = validateArticleBody(content);
		expect(result.valid).toBe(true);
	});

	it('should fail when body is too short (less than 500 chars)', () => {
		const content = `---
title: "Test Article"
---

Short content.`;

		const result = validateArticleBody(content);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('body too short');
	});

	it('should fail when missing heading in body', () => {
		const content = `---
title: "Test Article"
---

${'Lorem ipsum dolor sit amet. '.repeat(50)}

This is a long article body but without any heading markers.`;

		const result = validateArticleBody(content);
		expect(result.valid).toBe(false);
		expect(result.reason).toBe('missing heading in body');
	});

	it('should fail when front matter structure is broken', () => {
		const content = `title: "Test Article"
description: "Missing front matter delimiters"

# Heading

Body content here.`;

		const result = validateArticleBody(content);
		expect(result.valid).toBe(false);
		expect(result.reason).toBe('front matter structure broken');
	});

	it('should accept h2 and h3 headings', () => {
		const content = `---
title: "Test Article"
---

${'Lorem ipsum dolor sit amet. '.repeat(50)}

## Secondary Heading

Body content with h2 heading.`;

		const result = validateArticleBody(content);
		expect(result.valid).toBe(true);
	});

	it('should handle Windows line endings (CRLF)', () => {
		const content = `---\r
title: "Test Article"\r
---\r
\r
${'Lorem ipsum dolor sit amet. '.repeat(50)}\r
\r
# Main Heading\r
\r
Body content with CRLF line endings.`;

		const result = validateArticleBody(content);
		expect(result.valid).toBe(true);
	});

	it('should fail when body is exactly 500 chars but missing heading', () => {
		const bodyText = 'a'.repeat(500);
		const content = `---
title: "Test Article"
---

${bodyText}`;

		const result = validateArticleBody(content);
		expect(result.valid).toBe(false);
		expect(result.reason).toBe('missing heading in body');
	});
});
