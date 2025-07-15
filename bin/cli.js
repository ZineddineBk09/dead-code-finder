#!/usr/bin/env node

// This file is the CLI entry point. It uses 'commander' for argument parsing.
// It should be compiled from TypeScript (bin/cli.ts) into JavaScript.

// Ensure that the path to the main module is correct after compilation.
// In a typical setup, 'dist/index.js' would be the compiled output of 'src/index.ts'.
const { DeadCodeFinder } = require('../dist/index');
const { Command } = require('commander');
const path = require('path');

const program = new Command();

program
  .name('find-dead-code')
  .description('A CLI tool to find unused components, functions, variables, and files in React and Next.js projects.')
  .version('1.0.0');

program.command('scan')
  .description('Scan your project for dead code.')
  .option('-s, --src <directory>', 'Source directory to scan (overrides config file)')
  .option('-i, --ignore <patterns...>', 'Glob patterns to ignore (overrides config file)')
  .option('-c, --config <path>', 'Path to configuration file (default: deadcoderc.json)')
  .option('-m, --mode <mode>', 'Analysis mode: ast or regex (default: ast)', 'ast')
  .action((options) => {
    const finder = new DeadCodeFinder({
      srcDir: options.src,
      ignorePatterns: options.ignore && options.ignore.length > 0 ? options.ignore : undefined,
      configPath: options.config,
      analysisMode: options.mode
    });
    finder.findDeadCode();
  });

program.command('init')
  .description('Create a sample configuration file.')
  .option('-o, --output <path>', 'Output path for config file', 'deadcoderc.json')
  .action((options) => {
    const { createSampleConfig } = require('../dist/config-loader');
    createSampleConfig(options.output);
  });

program.parse(process.argv);

// If no command is given, display help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 