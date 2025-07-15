// Configuration loader for dead-code-finder
// Supports loading from deadcoderc.json files with fallback to defaults

import * as fs from 'fs';
import * as path from 'path';

export interface ConfigFileOptions {
    srcDir?: string;
    ignorePatterns?: string[];
    analysisMode?: 'ast' | 'regex';
}

export interface LoadedConfig {
    srcDir: string;
    ignorePatterns: string[];
    analysisMode: 'ast' | 'regex';
}

const DEFAULT_CONFIG: LoadedConfig = {
    srcDir: 'src',
    ignorePatterns: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/__tests__/**',
        '**/__mocks__/**'
    ],
    analysisMode: 'ast'
};

/**
 * Loads configuration from a deadcoderc.json file if it exists
 * @param configPath - Path to the config file (optional, will search for deadcoderc.json)
 * @returns Loaded configuration with defaults applied
 */
export function loadConfig(configPath?: string): LoadedConfig {
    let configFile: ConfigFileOptions = {};
    
    // Try to find and load config file
    const configFilePath = configPath || findConfigFile();
    
    if (configFilePath && fs.existsSync(configFilePath)) {
        try {
            const configContent = fs.readFileSync(configFilePath, 'utf8');
            configFile = JSON.parse(configContent);
            console.log(`📄 Loaded configuration from: ${configFilePath}`);
        } catch (error) {
            console.warn(`⚠️  Failed to parse config file ${configFilePath}: ${error}`);
            console.warn('   Using default configuration instead.');
        }
    }

    // Merge with defaults
    return {
        srcDir: configFile.srcDir || DEFAULT_CONFIG.srcDir,
        ignorePatterns: configFile.ignorePatterns || DEFAULT_CONFIG.ignorePatterns,
        analysisMode: configFile.analysisMode || DEFAULT_CONFIG.analysisMode
    };
}

/**
 * Finds the nearest deadcoderc.json file in the current directory or parent directories
 * @returns Path to the config file or null if not found
 */
function findConfigFile(): string | null {
    const configNames = ['deadcoderc.json', '.deadcoderc.json', 'deadcode.config.json'];
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
        for (const configName of configNames) {
            const configPath = path.join(currentDir, configName);
            if (fs.existsSync(configPath)) {
                return configPath;
            }
        }
        currentDir = path.dirname(currentDir);
    }
    
    // Check root directory
    for (const configName of configNames) {
        const configPath = path.join(currentDir, configName);
        if (fs.existsSync(configPath)) {
            return configPath;
        }
    }
    
    return null;
}

/**
 * Creates a sample configuration file
 * @param configPath - Path where to create the config file
 */
export function createSampleConfig(configPath: string = 'deadcoderc.json'): void {
    const sampleConfig: ConfigFileOptions = {
        srcDir: 'src',
        ignorePatterns: [
            '**/node_modules/**',
            '**/.next/**',
            '**/dist/**',
            '**/build/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/__tests__/**',
            '**/__mocks__/**',
            '**/lib/**',
            '**/utils/**'
        ],
        analysisMode: 'ast'
    };
    
    try {
        fs.writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2));
        console.log(`✅ Created sample configuration file: ${configPath}`);
        console.log('   Edit this file to customize your dead code analysis settings.');
    } catch (error) {
        console.error(`❌ Failed to create config file: ${error}`);
    }
} 