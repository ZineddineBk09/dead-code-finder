// Helper functions for dead code analysis.

import { BUILT_INS, REACT_HOOKS_REGEX } from './config';
import * as path from 'path';

/**
 * Checks if a given name is a common pattern (numbers, single letters, etc.)
 * to avoid false positives in usage detection.
 * @param name - The identifier name.
 * @returns True if it's a common pattern, false otherwise.
 */
export function isCommonPattern(name: string): boolean {
    return (
        /^\d+$/.test(name) || // numbers like '123'
        /^[a-z]$/.test(name) || // single lowercase letters
        /^[A-Z]$/.test(name) || // single uppercase letters
        /^[^a-zA-Z_]/.test(name) // starts with non-alphabetic/underscore
    );
}

/**
 * Determines if a given identifier is likely a React component based on naming conventions,
 * file location, and code patterns.
 * @param name - The identifier name.
 * @param content - The full content of the file where the identifier is defined.
 * @param filePath - The full path to the file.
 * @returns True if it's likely a React component, false otherwise.
 */
export function isLikelyComponent(name: string, content: string, filePath: string): boolean {
    // Components typically start with an uppercase letter (PascalCase)
    if (!/^[A-Z]/.test(name)) {
        return false;
    }

    // Check for common React component patterns in file content
    const hasJSXReturn = /return\s*\(?<[\s\S]*?>/.test(content) || /return\s*<[\s\S]*?>/.test(content);
    const hasReactHooks = REACT_HOOKS_REGEX.test(content); // Check for `use` hooks
    const usesJSXAttributes = /className|onClick|onSubmit|onChange|style/.test(content);
    const usesReactFragment = /<Fragment>|<\w+\s+Fragment>/.test(content);
    const usesReactMemo = /memo\(/.test(content);
    const usesForwardRef = /forwardRef\(/.test(content);
    const usesUseClientDirective = content.includes('"use client"');

    // Check file location - components are typically in specific directories
    const relativePath = path.relative(process.cwd(), filePath).toLowerCase(); // Use process.cwd() for consistency
    const isInComponentDir = relativePath.includes('/components/') ||
                             relativePath.includes('/component/') ||
                             relativePath.includes('/ui/');

    // Next.js specific page/layout/template/error files are components
    const isNextJsPageOrLayout = isNextJsEntryPoint(filePath);

    // If it's explicitly marked as client component
    if (usesUseClientDirective) {
        return true;
    }

    // If it's a Next.js entry point, it's a component
    if (isNextJsPageOrLayout) {
        return true;
    }

    // If it returns JSX, it's very likely a component
    if (hasJSXReturn) {
        return true;
    }

    // If it uses React hooks or common JSX attributes, it's likely a component
    if (hasReactHooks || usesJSXAttributes || usesReactFragment || usesReactMemo || usesForwardRef) {
        return true;
    }

    // If it's in a component-like directory and has common React patterns
    if (isInComponentDir && (hasReactHooks || usesJSXAttributes)) {
        return true;
    }

    return false;
}

/**
 * Checks if a file is a Next.js entry point (page, layout, route, middleware, etc.).
 * Supports both Page Router and App Router conventions.
 * @param filePath - The full path to the file.
 * @returns True if it's a Next.js entry point, false otherwise.
 */
export function isNextJsEntryPoint(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const dirName = path.dirname(filePath);
    const relativePath = path.relative(process.cwd(), filePath); // Use process.cwd() for consistency

    // App Router conventions
    const appRouterPatterns = [
        'page.tsx', 'page.ts', 'page.jsx', 'page.js',
        'layout.tsx', 'layout.ts', 'layout.jsx', 'layout.js',
        'loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js',
        'error.tsx', 'error.ts', 'error.jsx', 'error.js',
        'not-found.tsx', 'not-found.ts', 'not-found.jsx', 'not-found.js',
        'route.ts', 'route.js', // API Routes in App Router
        'middleware.ts', 'middleware.js', // Middleware
        'template.tsx', 'template.ts', 'template.jsx', 'template.js',
        'global-error.tsx', 'global-error.ts', 'global-error.jsx', 'global-error.js',
        'default.tsx', 'default.ts', 'default.jsx', 'default.js' // Parallel routes fallback
    ];

    // Page Router conventions
    const pageRouterPatterns = [
        '_app.tsx', '_app.ts', '_app.jsx', '_app.js',
        '_document.tsx', '_document.ts', '_document.jsx', '_document.js',
        '_error.tsx', '_error.ts', '_error.jsx', '_error.js',
        'index.tsx', 'index.ts', 'index.jsx', 'index.js', // Index pages
    ];

    // Check if filename matches a known entry point pattern
    if (appRouterPatterns.includes(fileName) || pageRouterPatterns.includes(fileName)) {
        return true;
    }

    // Check if it's within an `app` or `pages` directory (App Router or Page Router)
    if (relativePath.includes(path.sep + 'app' + path.sep) || relativePath.includes(path.sep + 'pages' + path.sep)) {
        // Also consider dynamic routes like `[slug].tsx` or `api/hello.ts`
        if (fileName.startsWith('[') && fileName.endsWith('].tsx')) return true;
        if (fileName.startsWith('[') && fileName.endsWith('].ts')) return true;
        if (fileName.startsWith('[') && fileName.endsWith('].jsx')) return true;
        if (fileName.startsWith('[') && fileName.endsWith('].js')) return true;
        if (dirName.includes(path.sep + 'api' + path.sep)) return true; // API routes
        return true;
    }

    return false;
} 