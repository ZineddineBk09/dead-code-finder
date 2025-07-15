// Contains the core logic for dead code analysis.

import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob'; // Use globSync for synchronous file finding

import { BUILT_INS, PATTERNS, REACT_HOOKS_REGEX } from './config';
import {
    isCommonPattern,
    isLikelyComponent,
    isNextJsEntryPoint
} from './utils';
import { loadConfig, LoadedConfig } from './config-loader';
import { ASTAnalyzer } from './ast-analyzer';

// Type definitions for analysis results
interface CodeIssue {
    name: string;
    file: string;
    type: 'component' | 'function' | 'variable' | 'import' | 'export';
    line?: number;
}

interface FileIssue {
    path: string;
    size: number;
}

interface AnalysisResults {
    unusedComponents: CodeIssue[];
    unusedFunctions: CodeIssue[];
    unusedVariables: CodeIssue[];
    unusedFiles: FileIssue[];
    unusedExports: CodeIssue[]; // Added for potential future enhancement
    unusedImports: CodeIssue[];
    totalIssues: number;
}

interface FileDefinitions {
    components: Set<string>;
    functions: Set<string>;
    variables: Set<string>;
    imports: Set<string>;
    exports: Set<string>; // Track exports to check against usage map
}

export interface AnalyzerConfig {
    srcDir: string;
    ignorePatterns: string[];
    configPath?: string;
    analysisMode?: 'ast' | 'regex';
}

export class DeadCodeAnalyzer {
    private config: AnalyzerConfig;
    private analysis: AnalysisResults;
    private allFiles: string[];
    private usageMap: Map<string, { file: string; line: number }[]>;
    private definitionLines: Map<string, number>;
    private astAnalyzer: ASTAnalyzer;

    constructor(config?: Partial<AnalyzerConfig>) {
        // Load configuration from file first, then override with CLI options
        const fileConfig = loadConfig(config?.configPath);
        
        this.config = {
            srcDir: config?.srcDir || fileConfig.srcDir,
            ignorePatterns: config?.ignorePatterns || fileConfig.ignorePatterns,
            configPath: config?.configPath,
            analysisMode: config?.analysisMode || fileConfig.analysisMode
        } as AnalyzerConfig;

        this.analysis = {
            unusedComponents: [],
            unusedFunctions: [],
            unusedVariables: [],
            unusedFiles: [],
            unusedExports: [],
            unusedImports: [],
            totalIssues: 0
        };
        this.allFiles = [];
        this.usageMap = new Map();
        this.definitionLines = new Map();
        this.astAnalyzer = new ASTAnalyzer();
    }

    /**
     * Initiates the dead code analysis process.
     */
    public findDeadCode(): void {
        console.log('🧹 Scanning for dead code...\n');
        console.log(`🔍 Using ${(this.config.analysisMode || 'ast').toUpperCase()} analysis mode\n`);

        this.allFiles = globSync(path.join(this.config.srcDir, '**/*.{ts,tsx,js,jsx}'), {
            ignore: this.config.ignorePatterns,
        });

        console.log(`📁 Found ${this.allFiles.length} source files\n`);

        if (this.config.analysisMode === 'ast') {
            this.performASTAnalysis();
        } else {
            this.performRegexAnalysis();
        }

        // Find completely unused files
        this.findUnusedFiles();

        // Generate report
        this.generateDeadCodeReport();
    }

    /**
     * Performs AST-based analysis
     */
    private performASTAnalysis(): void {
        console.log('🌳 Performing AST-based analysis...\n');
        
        // Use AST analyzer to get comprehensive results
        const astResults = this.astAnalyzer.analyzeAllFiles(this.allFiles);
        
        // Build usage map from AST results
        this.usageMap = astResults.usages;
        
        // Process definitions from AST results
        astResults.definitions.forEach((definitions, key) => {
            const [filePath, name] = key.split(':');
            definitions.forEach((def) => {
                this.definitionLines.set(key, def.line);
                
                // Check if the definition is used
                const usages = astResults.usages.get(name);
                const isUsed = usages && usages.length > 0;
                
                if (!isUsed) {
                    const issue = {
                        name,
                        file: filePath,
                        type: def.type,
                        line: def.line
                    };
                    
                    switch (def.type) {
                        case 'component':
                            this.analysis.unusedComponents.push(issue);
                            break;
                        case 'function':
                            this.analysis.unusedFunctions.push(issue);
                            break;
                        case 'variable':
                            this.analysis.unusedVariables.push(issue);
                            break;
                        case 'import':
                            this.analysis.unusedImports.push(issue);
                            break;
                    }
                }
            });
        });
    }

    /**
     * Performs regex-based analysis (original method)
     */
    private performRegexAnalysis(): void {
        console.log('🔍 Performing regex-based analysis...\n');
        
        // Build usage map across all files
        this.usageMap = this.buildUsageMap(this.allFiles);

        // Analyze each file for dead code
        this.allFiles.forEach((file) => {
            this.analyzeFile(file);
        });
    }

    /**
     * Builds a map of all code element usages across the codebase.
     * @param files - List of source file paths.
     * @returns A Map where keys are code element names and values are arrays of their usages.
     */
    private buildUsageMap(files: string[]): Map<string, { file: string; line: number }[]> {
        const usageMap = new Map<string, { file: string; line: number }[]>();

        files.forEach((file) => {
            const content = fs.readFileSync(file, 'utf8');
            const relativePath = path.relative(this.config.srcDir, file);

            // Find all usages in this file
            PATTERNS.usage.forEach((pattern) => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    // For each capturing group (skip group 0)
                    for (let i = 1; i < match.length; i++) {
                        const name = match[i];
                        if (!name) continue;
                        // Skip built-ins and common patterns
                        if (BUILT_INS.has(name) || isCommonPattern(name)) {
                            continue;
                        }
                        if (!usageMap.has(name)) {
                            usageMap.set(name, []);
                        }
                        usageMap.get(name)?.push({
                            file: relativePath,
                            line: content.substring(0, match.index).split('\n').length,
                        });
                    }
                }
            });
        });

        return usageMap;
    }

    /**
     * Analyzes a single file for dead code definitions.
     * @param filePath - Path to the file being analyzed.
     */
    private analyzeFile(filePath: string): void {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(this.config.srcDir, filePath);

        // Remove comments to avoid false positives
        const contentWithoutComments = this.removeComments(content);

        const definitions: FileDefinitions = {
            components: new Set(),
            functions: new Set(),
            variables: new Set(),
            imports: new Set(),
            exports: new Set(),
        };

        // Extract component definitions
        PATTERNS.component.forEach((pattern) => {
            let match;
            while ((match = pattern.exec(contentWithoutComments)) !== null) {
                const name = match[1];
                if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    if (isLikelyComponent(name, content, filePath)) {
                        definitions.components.add(name);
                        // Also track as an export if it's exported
                        if (content.includes(`export default ${name}`) || content.includes(`export function ${name}`) || content.includes(`export const ${name}`)) {
                            definitions.exports.add(name);
                        }
                    } else {
                        definitions.functions.add(name); // Treat as function if not a component
                        if (content.includes(`export function ${name}`) || content.includes(`export const ${name}`)) {
                            definitions.exports.add(name);
                        }
                    }
                    // Store line number for this definition
                    this.definitionLines.set(`${filePath}:${name}`, lineNumber);
                }
            }
        });

        // Extract function definitions (only those not already captured as components)
        PATTERNS.function.forEach((pattern) => {
            let match;
            while ((match = pattern.exec(contentWithoutComments)) !== null) {
                const name = match[1];
                if (!BUILT_INS.has(name) && !isCommonPattern(name) && !definitions.components.has(name)) {
                    const lineNumber = content.substring(0, match.index).split('\n').length;
                    definitions.functions.add(name);
                    if (content.includes(`export function ${name}`) || content.includes(`export const ${name}`)) {
                        definitions.exports.add(name);
                    }
                    // Store line number for this definition
                    this.definitionLines.set(`${filePath}:${name}`, lineNumber);
                }
            }
        });

        // Extract variable definitions
        PATTERNS.variable.forEach((pattern) => {
            let match;
            while ((match = pattern.exec(contentWithoutComments)) !== null) {
                const name = match[1];
                if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
                    // Don't add if it's already classified as a function or component
                    if (!definitions.functions.has(name) && !definitions.components.has(name)) {
                        // Skip local variables (variables defined inside functions)
                        if (this.isTopLevelVariable(contentWithoutComments, match.index)) {
                            const lineNumber = content.substring(0, match.index).split('\n').length;
                            definitions.variables.add(name);
                            if (content.includes(`export const ${name}`) || content.includes(`export let ${name}`) || content.includes(`export var ${name}`)) {
                                definitions.exports.add(name);
                            }
                            // Store line number for this definition
                            this.definitionLines.set(`${filePath}:${name}`, lineNumber);
                        }
                    }
                }
            }
        });

        // Extract imports
        PATTERNS.import.forEach((pattern) => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                // Handle named imports: import { name1, name2 as alias } from '...'
                if (match[1]) {
                    const imports = match[1].split(',').map((imp) => imp.trim());
                    imports.forEach((imp) => {
                        const cleanName = imp.split(' as ')[0].trim(); // Get original name if aliased
                        if (!BUILT_INS.has(cleanName) && !isCommonPattern(cleanName)) {
                            definitions.imports.add(cleanName);
                        }
                    });
                }
                // Handle default imports: import name from '...'
                else if (match[2]) {
                    const name = match[2];
                    if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
                        definitions.imports.add(name);
                    }
                }
                // Handle namespace imports: import * as name from '...'
                else if (match[3]) {
                    const name = match[3];
                    if (!BUILT_INS.has(name) && !isCommonPattern(name)) {
                        definitions.imports.add(name);
                    }
                }
            }
        });

        // Extract TypeScript type imports
        const typeImportPattern = /import\s+type\s*{\s*([^}]+)\s*}\s+from\s+['"`]([^'"`]+)['"`]/g;
        let typeMatch;
        while ((typeMatch = typeImportPattern.exec(content)) !== null) {
            const types = typeMatch[1].split(',').map((type) => type.trim());
            types.forEach((type) => {
                const cleanType = type.split(' as ')[0].trim();
                if (!BUILT_INS.has(cleanType) && !isCommonPattern(cleanType)) {
                    definitions.imports.add(cleanType);
                }
            });
        }

        // Check for unused definitions
        this.checkUnusedDefinitions(definitions, relativePath, content);
    }

    /**
     * Removes comments from code to avoid false positives
     * @param content - The file content
     * @returns Content with comments removed
     */
    private removeComments(content: string): string {
        // Remove single-line comments
        let result = content.replace(/\/\/.*$/gm, '');
        // Remove multi-line comments
        result = result.replace(/\/\*[\s\S]*?\*\//g, '');
        return result;
    }

    /**
     * Checks if a variable is defined at the top level (not inside a function)
     * @param content - The file content
     * @param index - The index where the variable is found
     * @returns True if it's a top-level variable
     */
    private isTopLevelVariable(content: string, index: number): boolean {
        const beforeMatch = content.substring(0, index);
        const lines = beforeMatch.split('\n');
        const currentLine = lines[lines.length - 1];
        
        // Count opening and closing braces before this point
        const beforeContent = content.substring(0, index);
        const openBraces = (beforeContent.match(/\{/g) || []).length;
        const closeBraces = (beforeContent.match(/\}/g) || []).length;
        
        // If we're inside a function (more opening braces than closing), it's not top-level
        if (openBraces > closeBraces) {
            return false;
        }
        
        // Check if the line starts with proper indentation (not inside a block)
        const trimmedLine = currentLine.trim();
        if (trimmedLine.startsWith('const ') || trimmedLine.startsWith('let ') || trimmedLine.startsWith('var ')) {
            return true;
        }
        
        return false;
    }

    /**
     * Checks which definitions within a file are unused across the codebase.
     * @param definitions - Definitions found in the current file.
     * @param filePath - Relative path of the current file.
     * @param content - Content of the current file.
     */
    private checkUnusedDefinitions(definitions: FileDefinitions, filePath: string, content: string): void {
        // Helper to check if a definition is used
        const isUsed = (name: string): boolean => {
            const usages = this.usageMap.get(name);
            
            // Check for local usage within the same file
            const localUsagePatterns = [
                new RegExp(`\\b${name}\\s*\\(`, 'g'), // function calls
                new RegExp(`<${name}[\\s/>]`, 'g'), // JSX usage
                new RegExp(`\\b${name}\\b`, 'g'), // general usage
            ];
            
            const hasLocalUsage = localUsagePatterns.some(pattern => {
                const matches = content.match(pattern);
                return matches && matches.length > 0;
            });
            
            // Consider it used if there's any usage (local or external)
            if (usages && usages.some(u => u.file !== filePath)) {
                return true;
            }
            
            // Check for local usage
            if (hasLocalUsage) {
                return true;
            }
            
            if (content.includes(`export default ${name}`)) { // Default exports are often entry points
                return true;
            }
            
            // Heuristic: If a function/variable is exported, assume it might be used externally.
            if (definitions.exports.has(name)) {
                if (!usages || usages.length === 0) {
                    return false; // No global usage found for an exported item
                }
            }
            
            // Check for React hooks being used
            if (REACT_HOOKS_REGEX.test(name)) {
                return true; // Assume React hooks are used if defined (e.g., custom hooks)
            }
            
            return false;
        };

        // Check unused components
        definitions.components.forEach((component) => {
            if (!isUsed(component)) {
                this.analysis.unusedComponents.push({
                    name: component,
                    file: filePath,
                    type: 'component',
                });
            }
        });

        // Check unused functions
        definitions.functions.forEach((func) => {
            if (!isUsed(func)) {
                // Double-check if the function is used within the same file
                const functionCallRegex = new RegExp(`\\b${func}\\s*\\(`, 'g');
                if (!functionCallRegex.test(content)) {
                    this.analysis.unusedFunctions.push({
                        name: func,
                        file: filePath,
                        type: 'function',
                    });
                }
            }
        });

        // Check unused variables
        definitions.variables.forEach((variable) => {
            if (!isUsed(variable)) {
                this.analysis.unusedVariables.push({
                    name: variable,
                    file: filePath,
                    type: 'variable',
                });
            }
        });

        // Check unused imports
        definitions.imports.forEach((importName) => {
            // An import is unused if its name is not present in the usageMap
            // OR if its only usage is within the import statement itself (false positive)
            const usages = this.usageMap.get(importName);
            if (!usages || usages.length === 0 || (usages.length === 1 && content.includes(`import ${importName}`))) {
                this.analysis.unusedImports.push({
                    name: importName,
                    file: filePath,
                    type: 'import',
                });
            }
        });

        // Note: Checking unused exports accurately without AST is very hard.
        // The `isUsed` function above tries a basic heuristic.
        // For a more robust `unusedExports` check, a full dependency graph is needed.
        // For now, `unusedExports` array will remain largely empty unless `isUsed` is refined.
    }

    /**
     * Finds completely unused files in the codebase.
     */
    private findUnusedFiles(): void {
        this.allFiles.forEach((file) => {
            const relativePath = path.relative(this.config.srcDir, file);
            const fileName = path.basename(file);
            const fileNameWithoutExt = path.basename(file, path.extname(file));
            const fileDir = path.dirname(file);
            const possibleImportPaths = [
                './' + fileNameWithoutExt,
                './' + fileName,
                fileNameWithoutExt,
                fileName,
            ];
            // Also add relative path from srcDir
            const relFromSrc = './' + path.relative(this.config.srcDir, file).replace(/\\/g, '/').replace(/\.[tj]sx?$/, '');
            possibleImportPaths.push(relFromSrc);
            // Also add with extension
            possibleImportPaths.push(relFromSrc + path.extname(file));

            // Check if any other file imports this file
            let isImported = false;
            for (const otherFile of this.allFiles) {
                if (otherFile === file) continue;
                const content = fs.readFileSync(otherFile, 'utf8');
                for (const importPath of possibleImportPaths) {
                    // Match import ... from 'importPath' or "importPath"
                    const importRegex = new RegExp(`from\s+['\"\`]${importPath}['\"\`]`);
                    if (importRegex.test(content)) {
                        isImported = true;
                        break;
                    }
                }
                if (isImported) break;
            }

            // Check if the file is a Next.js entry point (page, layout, route, middleware, etc.)
            const isEntryPoint = isNextJsEntryPoint(file);

            // Check if the file exports anything (if it does, it's likely meant to be imported)
            const fileContent = fs.readFileSync(file, 'utf8');
            const hasExports = /export\s+(?:default|{|const|function|class|interface|type)/.test(fileContent);

            // Check if the file is a main entry point (index files, main files)
            const isMainFile = fileName === 'index.ts' || 
                              fileName === 'index.tsx' || 
                              fileName === 'index.js' || 
                              fileName === 'index.jsx' ||
                              fileName === 'main.ts' ||
                              fileName === 'main.tsx' ||
                              fileName === 'main.js' ||
                              fileName === 'main.jsx';

            // Check if the file is a configuration file
            const isConfigFile = fileName.includes('config') || 
                                fileName.includes('Config') ||
                                fileName.includes('setup') ||
                                fileName.includes('Setup');

            // Check if the file is a utility/library file (likely to be imported)
            const isUtilityFile = fileDir.includes('utils') || 
                                 fileDir.includes('lib') || 
                                 fileDir.includes('helpers') ||
                                 fileDir.includes('services') ||
                                 fileDir.includes('hooks') ||
                                 fileDir.includes('components');

            // Only mark as unused if it's not imported, not an entry point, has no exports, 
            // and is not a main/config/utility file
            if (!isImported && !isEntryPoint && !hasExports && !isMainFile && !isConfigFile && !isUtilityFile) {
                try {
                    this.analysis.unusedFiles.push({
                        path: relativePath,
                        size: fs.statSync(file).size,
                    });
                } catch (e) {
                    console.warn(`Could not get size for file ${relativePath}: ${e}`);
                }
            }
        });
    }

    /**
     * Generates and prints the dead code analysis report.
     */
    private generateDeadCodeReport(): void {
        console.log('📊 Dead Code Analysis Report\n');

        // Calculate totals
        this.analysis.totalIssues =
            this.analysis.unusedComponents.length +
            this.analysis.unusedFunctions.length +
            this.analysis.unusedVariables.length +
            this.analysis.unusedFiles.length +
            this.analysis.unusedImports.length; // unusedExports is hard to track with regex

        // Summary
        console.log('📈 Summary:');
        console.log(`   Total issues found: ${this.analysis.totalIssues}`);
        console.log(`   Unused components: ${this.analysis.unusedComponents.length}`);
        console.log(`   Unused functions: ${this.analysis.unusedFunctions.length}`);
        console.log(`   Unused variables: ${this.analysis.unusedVariables.length}`);
        console.log(`   Unused files: ${this.analysis.unusedFiles.length}`);
        console.log(`   Unused imports: ${this.analysis.unusedImports.length}\n`);

        // Detailed lists (sliced to 50 for brevity in console)
        const printSection = (title: string, items: CodeIssue[] | FileIssue[], itemFormatter: (item: any) => string) => {
            if (items.length > 0) {
                console.log(`❌ ${title}:`);
                items.slice(0, 50).forEach((item) => {
                    console.log(`   - ${itemFormatter(item)}`);
                });
                if (items.length > 50) {
                    console.log(`   ... and ${items.length - 50} more`);
                }
                console.log('');
            }
        };

        printSection('Unused Components', this.analysis.unusedComponents, (c: CodeIssue) => {
            const lineNumber = this.definitionLines.get(`${c.file}:${c.name}`);
            return lineNumber ? `${c.name} (${c.file}:${lineNumber})` : `${c.name} (${c.file})`;
        });
        printSection('Unused Functions', this.analysis.unusedFunctions, (f: CodeIssue) => {
            const lineNumber = this.definitionLines.get(`${f.file}:${f.name}`);
            return lineNumber ? `${f.name} (${f.file}:${lineNumber})` : `${f.name} (${f.file})`;
        });
        printSection('Unused Variables', this.analysis.unusedVariables, (v: CodeIssue) => {
            const lineNumber = this.definitionLines.get(`${v.file}:${v.name}`);
            return lineNumber ? `${v.name} (${v.file}:${lineNumber})` : `${v.name} (${v.file})`;
        });
        printSection('Unused Imports', this.analysis.unusedImports, (i: CodeIssue) => {
            const lineNumber = this.definitionLines.get(`${i.file}:${i.name}`);
            return lineNumber ? `${i.name} (${i.file}:${lineNumber})` : `${i.name} (${i.file})`;
        });
        printSection(
            'Unused Files',
            this.analysis.unusedFiles.sort((a, b) => b.size - a.size),
            (f: FileIssue) => `${f.path} (${(f.size / 1024).toFixed(1)}KB)`
        );

        // Potential savings
        const totalSize = this.analysis.unusedFiles.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > 0) {
            console.log('💰 Potential Savings:');
            console.log(`   • File size reduction: ${(totalSize / 1024).toFixed(1)}KB`);
            console.log(`   • Bundle size reduction: ~${((totalSize / 1024) * 0.1).toFixed(1)}KB (estimated)`);
            console.log('');
        }

        // Recommendations
        console.log('💡 Recommendations:');
        console.log('   • Remove identified unused code to reduce bundle size and improve maintainability.');
        console.log('   • Use ESLint with `eslint-plugin-unused-imports` for automated import cleanup.');
        console.log('   • Consider using tools like Webpack Bundle Analyzer to visualize bundle contents.');
        console.log('   • For more precise dead code elimination, consider AST-based analysis tools.');
        console.log('   • Run this analysis regularly as part of your CI/CD pipeline.');
    }
}