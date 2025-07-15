// AST-based analyzer for dead code detection
// Provides more accurate analysis by parsing the actual syntax tree

import * as fs from 'fs';
import * as path from 'path';
import { parse as babelParse } from '@babel/parser';
import { parse as tsParse } from '@typescript-eslint/parser';
import { BUILT_INS, REACT_HOOKS_REGEX } from './config';
import { isCommonPattern, isLikelyComponent, isNextJsEntryPoint } from './utils';

// Type definitions for AST analysis
interface ASTNode {
    type: string;
    loc?: {
        start: { line: number; column: number };
        end: { line: number; column: number };
    };
    [key: string]: any;
}

interface ASTDefinition {
    name: string;
    type: 'component' | 'function' | 'variable' | 'import' | 'export';
    line: number;
    node: ASTNode;
}

interface ASTUsage {
    name: string;
    line: number;
    context: string; // 'call', 'reference', 'jsx', 'property', etc.
}

interface ASTAnalysisResult {
    definitions: ASTDefinition[];
    usages: ASTUsage[];
    exports: Set<string>;
    imports: Set<string>;
}

export class ASTAnalyzer {

    /**
     * Analyzes a file using AST parsing
     */
    public analyzeFile(filePath: string): ASTAnalysisResult {
        const content = fs.readFileSync(filePath, 'utf8');
        const ext = path.extname(filePath);
        
        let ast: ASTNode;
        
        try {
            if (ext === '.ts' || ext === '.tsx') {
                // Use TypeScript parser for TypeScript files
                ast = tsParse(content, {
                    ecmaVersion: 2020,
                    sourceType: 'module',
                    ecmaFeatures: {
                        jsx: true
                    }
                }) as ASTNode;
            } else {
                // Use Babel parser for JavaScript files
                ast = babelParse(content, {
                    sourceType: 'module',
                    plugins: ['jsx', 'typescript']
                }) as ASTNode;
            }
        } catch (error) {
            console.warn(`⚠️  Failed to parse ${filePath}: ${error}`);
            return {
                definitions: [],
                usages: [],
                exports: new Set(),
                imports: new Set()
            };
        }

        const result: ASTAnalysisResult = {
            definitions: [],
            usages: [],
            exports: new Set(),
            imports: new Set()
        };

        this.traverseAST(ast, result, filePath);
        return result;
    }

    /**
     * Traverses the AST to find definitions and usages
     */
    private traverseAST(node: ASTNode, result: ASTAnalysisResult, filePath: string): void {
        if (!node || typeof node !== 'object') return;

        // Handle different node types
        switch (node.type) {
            case 'Program':
                node.body?.forEach((child: ASTNode) => this.traverseAST(child, result, filePath));
                break;

            case 'ImportDeclaration':
                this.handleImportDeclaration(node, result);
                break;

            case 'ExportNamedDeclaration':
                this.handleExportNamedDeclaration(node, result, filePath);
                break;

            case 'ExportDefaultDeclaration':
                this.handleExportDefaultDeclaration(node, result, filePath);
                break;

            case 'VariableDeclaration':
                this.handleVariableDeclaration(node, result, filePath);
                break;

            case 'FunctionDeclaration':
                this.handleFunctionDeclaration(node, result, filePath);
                break;

            case 'FunctionExpression':
                this.handleFunctionExpression(node, result, filePath);
                break;

            case 'ArrowFunctionExpression':
                this.handleArrowFunctionExpression(node, result, filePath);
                break;

            case 'CallExpression':
                this.handleCallExpression(node, result);
                break;

            case 'JSXElement':
                this.handleJSXElement(node, result);
                break;

            case 'JSXIdentifier':
                this.handleJSXIdentifier(node, result);
                break;

            case 'Identifier':
                this.handleIdentifier(node, result);
                break;

            case 'MemberExpression':
                this.handleMemberExpression(node, result);
                break;

            case 'ObjectProperty':
                this.handleObjectProperty(node, result);
                break;

            case 'SpreadElement':
                this.handleSpreadElement(node, result);
                break;

            case 'TypeScript':
                // Handle TypeScript specific nodes
                if (node.typeAnnotation) {
                    this.traverseAST(node.typeAnnotation, result, filePath);
                }
                break;
        }

        // Recursively traverse child nodes
        for (const key in node) {
            if (key !== 'type' && key !== 'loc' && typeof node[key] === 'object') {
                if (Array.isArray(node[key])) {
                    node[key].forEach((child: ASTNode) => this.traverseAST(child, result, filePath));
                } else {
                    this.traverseAST(node[key], result, filePath);
                }
            }
        }
    }

    /**
     * Handles import declarations
     */
    private handleImportDeclaration(node: ASTNode, result: ASTAnalysisResult): void {
        const specifiers = node.specifiers || [];
        
        specifiers.forEach((specifier: ASTNode) => {
            if (specifier.type === 'ImportSpecifier') {
                const name = specifier.imported?.name || specifier.local?.name;
                if (name && !BUILT_INS.has(name) && !isCommonPattern(name)) {
                    result.imports.add(name);
                    result.definitions.push({
                        name,
                        type: 'import',
                        line: node.loc?.start.line || 1,
                        node
                    });
                }
            } else if (specifier.type === 'ImportDefaultSpecifier') {
                const name = specifier.local?.name;
                if (name && !BUILT_INS.has(name) && !isCommonPattern(name)) {
                    result.imports.add(name);
                    result.definitions.push({
                        name,
                        type: 'import',
                        line: node.loc?.start.line || 1,
                        node
                    });
                }
            } else if (specifier.type === 'ImportNamespaceSpecifier') {
                const name = specifier.local?.name;
                if (name && !BUILT_INS.has(name) && !isCommonPattern(name)) {
                    result.imports.add(name);
                    result.definitions.push({
                        name,
                        type: 'import',
                        line: node.loc?.start.line || 1,
                        node
                    });
                }
            }
        });
    }

    /**
     * Handles named export declarations
     */
    private handleExportNamedDeclaration(node: ASTNode, result: ASTAnalysisResult, filePath: string): void {
        if (node.declaration) {
            // Export declaration (export const/let/var/function)
            this.traverseAST(node.declaration, result, filePath);
        } else if (node.specifiers) {
            // Export specifiers (export { name1, name2 as alias })
            node.specifiers.forEach((specifier: ASTNode) => {
                const name = specifier.exported?.name || specifier.local?.name;
                if (name && !BUILT_INS.has(name) && !isCommonPattern(name)) {
                    result.exports.add(name);
                }
            });
        }
    }

    /**
     * Handles default export declarations
     */
    private handleExportDefaultDeclaration(node: ASTNode, result: ASTAnalysisResult, filePath: string): void {
        if (node.declaration) {
            this.traverseAST(node.declaration, result, filePath);
        }
    }

    /**
     * Handles variable declarations
     */
    private handleVariableDeclaration(node: ASTNode, result: ASTAnalysisResult, filePath: string): void {
        const declarations = node.declarations || [];
        
        declarations.forEach((declaration: ASTNode) => {
            const name = declaration.id?.name;
            if (!name || BUILT_INS.has(name) || isCommonPattern(name)) return;

            const line = node.loc?.start.line || 1;
            const isExported = this.isExported(node);
            
            // Determine if it's a component or function
            const init = declaration.init;
            if (init) {
                if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
                    if (isLikelyComponent(name, '', filePath)) {
                        result.definitions.push({
                            name,
                            type: 'component',
                            line,
                            node
                        });
                    } else {
                        result.definitions.push({
                            name,
                            type: 'function',
                            line,
                            node
                        });
                    }
                } else {
                    result.definitions.push({
                        name,
                        type: 'variable',
                        line,
                        node
                    });
                }
            } else {
                result.definitions.push({
                    name,
                    type: 'variable',
                    line,
                    node
                });
            }

            if (isExported) {
                result.exports.add(name);
            }
        });
    }

    /**
     * Handles function declarations
     */
    private handleFunctionDeclaration(node: ASTNode, result: ASTAnalysisResult, filePath: string): void {
        const name = node.id?.name;
        if (!name || BUILT_INS.has(name) || isCommonPattern(name)) return;

        const line = node.loc?.start.line || 1;
        const isExported = this.isExported(node);
        
        if (isLikelyComponent(name, '', filePath)) {
            result.definitions.push({
                name,
                type: 'component',
                line,
                node
            });
        } else {
            result.definitions.push({
                name,
                type: 'function',
                line,
                node
            });
        }

        if (isExported) {
            result.exports.add(name);
        }
    }

    /**
     * Handles function expressions
     */
    private handleFunctionExpression(node: ASTNode, result: ASTAnalysisResult, filePath: string): void {
        // Function expressions are usually assigned to variables, handled in VariableDeclaration
    }

    /**
     * Handles arrow function expressions
     */
    private handleArrowFunctionExpression(node: ASTNode, result: ASTAnalysisResult, filePath: string): void {
        // Arrow functions are usually assigned to variables, handled in VariableDeclaration
    }

    /**
     * Handles function calls
     */
    private handleCallExpression(node: ASTNode, result: ASTAnalysisResult): void {
        const callee = node.callee;
        if (callee?.type === 'Identifier') {
            const name = callee.name;
            if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
                result.usages.push({
                    name,
                    line: node.loc?.start.line || 1,
                    context: 'call'
                });
            }
        }
    }

    /**
     * Handles JSX elements
     */
    private handleJSXElement(node: ASTNode, result: ASTAnalysisResult): void {
        const openingElement = node.openingElement;
        if (openingElement?.name?.type === 'JSXIdentifier') {
            const name = openingElement.name.name;
            if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
                result.usages.push({
                    name,
                    line: node.loc?.start.line || 1,
                    context: 'jsx'
                });
            }
        }
    }

    /**
     * Handles JSX identifiers
     */
    private handleJSXIdentifier(node: ASTNode, result: ASTAnalysisResult): void {
        const name = node.name;
        if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
            result.usages.push({
                name,
                line: node.loc?.start.line || 1,
                context: 'jsx'
            });
        }
    }

    /**
     * Handles identifier references
     */
    private handleIdentifier(node: ASTNode, result: ASTAnalysisResult): void {
        const name = node.name;
        if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
            result.usages.push({
                name,
                line: node.loc?.start.line || 1,
                context: 'reference'
            });
        }
    }

    /**
     * Handles member expressions (object.property)
     */
    private handleMemberExpression(node: ASTNode, result: ASTAnalysisResult): void {
        if (node.object?.type === 'Identifier') {
            const name = node.object.name;
            if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
                result.usages.push({
                    name,
                    line: node.loc?.start.line || 1,
                    context: 'property'
                });
            }
        }
    }

    /**
     * Handles object properties
     */
    private handleObjectProperty(node: ASTNode, result: ASTAnalysisResult): void {
        if (node.value?.type === 'Identifier') {
            const name = node.value.name;
            if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
                result.usages.push({
                    name,
                    line: node.loc?.start.line || 1,
                    context: 'property'
                });
            }
        }
    }

    /**
     * Handles spread elements
     */
    private handleSpreadElement(node: ASTNode, result: ASTAnalysisResult): void {
        if (node.argument?.type === 'Identifier') {
            const name = node.argument.name;
            if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
                result.usages.push({
                    name,
                    line: node.loc?.start.line || 1,
                    context: 'spread'
                });
            }
        }
    }

    /**
     * Checks if a node is exported
     */
    private isExported(node: ASTNode): boolean {
        let parent = node.parent;
        while (parent) {
            if (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration') {
                return true;
            }
            parent = parent.parent;
        }
        return false;
    }

    /**
     * Builds a usage map from AST analysis results
     */
    public buildUsageMap(files: string[]): Map<string, { file: string; line: number }[]> {
        const usageMap = new Map<string, { file: string; line: number }[]>();

        files.forEach((file) => {
            const result = this.analyzeFile(file);
            const relativePath = path.relative(process.cwd(), file);

            result.usages.forEach((usage) => {
                if (!usageMap.has(usage.name)) {
                    usageMap.set(usage.name, []);
                }
                usageMap.get(usage.name)?.push({
                    file: relativePath,
                    line: usage.line
                });
            });
        });

        return usageMap;
    }

    /**
     * Analyzes all files and returns comprehensive results
     */
    public analyzeAllFiles(files: string[]): {
        definitions: Map<string, ASTDefinition[]>;
        usages: Map<string, { file: string; line: number }[]>;
        exports: Set<string>;
        imports: Set<string>;
    } {
        const definitions = new Map<string, ASTDefinition[]>();
        const usages = new Map<string, { file: string; line: number }[]>();
        const allExports = new Set<string>();
        const allImports = new Set<string>();

        files.forEach((file) => {
            const result = this.analyzeFile(file);
            const relativePath = path.relative(process.cwd(), file);

            // Collect definitions
            result.definitions.forEach((def) => {
                const key = `${relativePath}:${def.name}`;
                if (!definitions.has(key)) {
                    definitions.set(key, []);
                }
                definitions.get(key)?.push(def);
            });

            // Collect usages
            result.usages.forEach((usage) => {
                if (!usages.has(usage.name)) {
                    usages.set(usage.name, []);
                }
                usages.get(usage.name)?.push({
                    file: relativePath,
                    line: usage.line
                });
            });

            // Collect exports and imports
            result.exports.forEach((exp) => allExports.add(exp));
            result.imports.forEach((imp) => allImports.add(imp));
        });

        return {
            definitions,
            usages,
            exports: allExports,
            imports: allImports
        };
    }
} 