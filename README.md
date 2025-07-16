# Dead Code Finder

A CLI tool to help developers identify and remove unused components, functions, variables, and files in their React and Next.js projects. This helps in reducing bundle size, improving performance, and maintaining a cleaner codebase.

## Features

-   **Comprehensive Scan:** Detects unused:
    -   React Components
    -   JavaScript/TypeScript Functions
    -   Variables
    -   Files
    -   Imports
-   **Dual Analysis Modes:** 
    -   **AST-based Analysis (Default):** More accurate parsing using Abstract Syntax Trees for precise code understanding
    -   **Regex-based Analysis:** Faster analysis using pattern matching for quick scans
-   **React & Next.js Aware:** Specifically designed to understand common patterns in React and Next.js applications, including App Router and Page Router conventions
-   **TypeScript Support:** Fully compatible with TypeScript projects (`.ts`, `.tsx` files) with proper AST parsing
-   **Configurable:** Customize source directories, ignore patterns, and analysis mode via CLI or configuration file
-   **Detailed Report:** Provides a summary of findings and a list of identified dead code with line numbers, including potential file size savings
-   **Production Ready:** Successfully tested and working with real-world React/Next.js/TypeScript codebases

## Installation

You can install the package globally using npm or yarn:

```bash
npm install -g dead-code-finder
# OR
yarn global add dead-code-finder
```

## Usage

Once installed, you can run the `find-dead-code` command in your project's root directory.

```bash
find-dead-code scan
```

### Options

You can customize the scan behavior using the following options:

-   `-s, --src <directory>`: Specify the source directory to scan (overrides config file).
    -   **Example:** `find-dead-code scan --src ./app`
-   `-i, --ignore <patterns...>`: Provide a list of glob patterns to ignore (overrides config file).
    -   **Example:** `find-dead-code scan --ignore "**/lib/**" "**/utils/**"`
-   `-c, --config <path>`: Path to configuration file (default: deadcoderc.json).
    -   **Example:** `find-dead-code scan --config ./custom-config.json`
-   `-m, --mode <mode>`: Analysis mode: `ast` (default) or `regex`.
    -   **Example:** `find-dead-code scan --mode regex` for faster analysis

**Full Example:**

```bash
find-dead-code scan --src ./src --ignore "**/api/**" "**/types/**"
```

### Configuration File

For larger projects or more complex setups, you can use a configuration file instead of CLI arguments. The tool will automatically look for `deadcoderc.json` in your project root.

**Create a sample configuration:**

```bash
find-dead-code init
```

**Example configuration file (`deadcoderc.json`):**

```json
{
  "srcDir": "src",
  "ignorePatterns": [
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/*.test.*",
    "**/*.spec.*",
    "**/__tests__/**",
    "**/__mocks__/**",
    "**/lib/**",
    "**/utils/**"
  ],
  "analysisMode": "ast"
}
```

**Configuration precedence:**
1. CLI arguments (highest priority)
2. Configuration file
3. Default values (lowest priority)

## How it Works

The tool supports two analysis modes:

### AST-based Analysis (Default)
Uses Abstract Syntax Tree parsing for precise code understanding:

1. **Parse Code:** Each file is parsed into an AST using TypeScript parser (for `.ts/.tsx`) or Babel parser (for `.js/.jsx`)
2. **Extract Definitions:** Traverse the AST to find all variable declarations, function declarations, component definitions, and imports
3. **Track Usage:** Identify all references, function calls, JSX usage, property access, and other usage patterns
4. **Cross-reference:** Compare definitions against usage patterns across the entire codebase
5. **Accurate Results:** Provides the most accurate dead code detection with minimal false positives

### Regex-based Analysis
Uses pattern matching for faster analysis:

1. **Build Usage Map:** Scan all files using regex patterns to identify where identifiers are used
2. **Analyze Definitions:** Use regex patterns to find definitions and check against the usage map
3. **Apply Heuristics:** Use naming conventions and context clues to improve accuracy

Both modes apply special heuristics for React components, Next.js entry points, and common patterns to minimize false positives.

## Limitations & Future Improvements

* **AST-based Analysis:** The default and recommended mode, providing high accuracy:
    * **Complex Dynamic Usage:** Code that is dynamically called or used through complex patterns might still be missed
    * **Build-time Optimizations:** Some dead code might be eliminated by build tools, making static analysis less relevant
    * **Performance:** AST parsing is slower than regex for very large codebases
* **Regex-based Analysis:** Available as a faster alternative but with reduced accuracy:
    * **False Positives:** Code that appears unused to regex but is dynamically called or used in ways not captured by patterns
    * **False Negatives:** Code that is truly dead but is missed by the current patterns
    * **Contextual Understanding:** Struggles with advanced scenarios like HOCs, render props, or complex dependency injection
* **Unused Exports:** Accurately identifying truly unused *exports* (i.e., code exported from a module but never imported by another module) requires building a full dependency graph of the entire project, which is significantly more complex than the current scope. The current tool focuses more on definitions that are not *used* anywhere.
* **Future Improvements:**
    * **ESLint Integration:** Provide ESLint rules that leverage this analysis
    * **IDE Integration:** VSCode extension for real-time dead code detection
    * **CI/CD Integration:** GitHub Actions and other CI/CD platform integrations
    * **Bundle Analysis:** Integration with webpack bundle analyzer for more accurate size impact assessment
    * **Enhanced AST Analysis:** Further improvements to handle edge cases and dynamic patterns

## Contributing

Contributions are welcome! If you find a bug, have a feature request, or want to contribute code, please open an issue or submit a pull request on the [GitHub repository](https://github.com/ZineddineBk09/dead-code-finder).

## License

This project is licensed under the MIT License. 