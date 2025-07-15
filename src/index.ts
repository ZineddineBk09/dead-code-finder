// Main entry point for the npm package.
// Exports the DeadCodeFinder class.

import { DeadCodeAnalyzer, AnalyzerConfig } from './analyzer';
export { createSampleConfig, loadConfig } from './config-loader';

export class DeadCodeFinder {
    private analyzer: DeadCodeAnalyzer;

    constructor(config?: Partial<AnalyzerConfig>) {
        this.analyzer = new DeadCodeAnalyzer(config);
    }

    /**
     * Initiates the dead code analysis process.
     */
    public findDeadCode(): void {
        this.analyzer.findDeadCode();
    }
} 