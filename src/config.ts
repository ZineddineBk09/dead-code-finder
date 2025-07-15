// Centralized configuration for regex patterns and built-in identifiers.

// Patterns to match different code elements
export const PATTERNS = {
    // Component definitions - React components (improved to be more specific)
    component: [
        // export default function ComponentName() {}
        /export\s+default\s+function\s+([A-Z]\w*)\s*\(/g,
        // export default const ComponentName = () => {} / = function() {}
        /export\s+default\s+(?:const|var|let)\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)\s*=>|function)/g,
        // export function ComponentName() {}
        /export\s+function\s+([A-Z]\w*)\s*\(/g,
        // export const ComponentName = () => {} / = function() {}
        /export\s+(?:const|var|let)\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)\s*=>|function)/g,
        // const ComponentName = () => {} (inside a file that exports it)
        /(?:const|var|let)\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)\s*=>|function)/g,
        // function ComponentName() {} (inside a file that exports it)
        /function\s+([A-Z]\w*)\s*\(/g
    ],

    // Function definitions - utility functions and regular functions (camelCase preferred)
    function: [
        // function functionName()
        /function\s+([a-z]\w*)\s*\(/g,
        // const functionName = () => {}
        /(?:const|var|let)\s+([a-z]\w*)\s*=\s*(?:\([^)]*\)\s*=>|function)/g,
        // export function functionName()
        /export\s+function\s+([a-z]\w*)\s*\(/g,
        // export const functionName = () => {}
        /export\s+(?:const|var|let)\s+([a-z]\w*)\s*=\s*(?:\([^)]*\)\s*=>|function)/g
    ],

    // Variable definitions (excluding functions/components already captured)
    // Only capture top-level variables, not local function variables
    variable: [
        // export const variableName = (top-level exports)
        /export\s+(?:const|var|let)\s+([a-zA-Z_]\w*)\s*=/g,
        // const variableName = (top-level, not inside function/block)
        /^(?:\s*)(?:const|var|let)\s+([a-zA-Z_]\w*)\s*=/gm
    ],

    // Import statements
    import: [
        // import { x, y } from 'z' (named imports) - captures 'x, y' in group 1
        /import\s*{\s*([^}]+)\s*}\s+from\s+['"`]([^'"`]+)['"`]/g,
        // import x from 'y' (default import) - captures 'x' in group 1
        /import\s+([a-zA-Z_]\w*)\s+from\s+['"`]([^'"`]+)['"`]/g,
        // import * as x from 'y' (namespace import) - captures 'x' in group 1
        /import\s+\*\s+as\s+([a-zA-Z_]\w*)\s+from\s+['"`]([^'"`]+)['"`]/g
    ],

    // Usage patterns (broad capture, refined by BUILT_INS and isCommonPattern)
    usage: [
        // <ComponentName /> or <componentName>
        /<([A-Z]\w*|[^/][a-z]\w*)(?:\s+[^>]*)?\/?>(?![\s\S]*<\/[A-Z]\w*>)/g, // JSX usage
        // functionName() or variableName.property
        /\b([a-zA-Z_]\w*)\s*(?:\(|\.)/g,
        // variableName (standalone)
        /\b([a-zA-Z_]\w*)\b/g,
        // function calls with parentheses
        /\b([a-zA-Z_]\w*)\s*\(/g,
        // Property assignment: setValue: updateUrlState
        /\b([a-zA-Z_]\w*)\s*:\s*([a-zA-Z_]\w*)\b/g,
        // Shorthand object property: { updateUrlState }
        /{\s*([a-zA-Z_]\w*)\s*}/g,
        // Argument usage: someFn(updateUrlState)
        /\(([^)]*\b([a-zA-Z_]\w*)\b[^)]*)\)/g,
        // JSX prop usage: <Component prop={handleSearchValue} />
        /[\s\(\[]([a-zA-Z_]\w*)\s*=\s*{([a-zA-Z_]\w*)}/g,
        // Export renaming: export { updateUrlState as setValue }
        /export\s*{[^}]*\b([a-zA-Z_]\w*)\s+as\s+([a-zA-Z_]\w*)\b[^}]*}/g,
        // Default export: export default updateUrlState
        /export\s+default\s+([a-zA-Z_]\w*)/g,
        // HOC usage: export default withSomething(updateUrlState)
        /with[A-Z]\w*\(([a-zA-Z_]\w*)\)/g,
        // React hook usage: useEffect\(([^)]*\b([a-zA-Z_]\w*)\b[^)]*)\)/g,
        // Spread usage: {...updateUrlState}
        /\.\.\.([a-zA-Z_]\w*)/g,
        // TypeScript type usage: function(param: TypeName)
        /:\s*([A-Z][a-zA-Z_]*\w*)\b/g,
        // TypeScript generic usage: Array<TypeName>
        /<\s*([A-Z][a-zA-Z_]*\w*)\s*>/g,
        // TypeScript interface/type usage: interface extends TypeName
        /(?:interface|type)\s+\w+\s+extends\s+([A-Z][a-zA-Z_]*\w*)/g,
        // TypeScript import type usage: import type { TypeName }
        /import\s+type\s*{[^}]*\b([A-Z][a-zA-Z_]*\w*)\b[^}]*}/g
    ]
};

// Regex to detect React hooks (both built-in and custom starting with 'use')
export const REACT_HOOKS_REGEX = /^use[A-Z]\w*$/;

// Common React/Next.js built-ins and global identifiers to ignore
export const BUILT_INS = new Set([
    // React core
    "React", "useState", "useEffect", "useContext", "useReducer", "useCallback", "useMemo",
    "useRef", "useImperativeHandle", "useLayoutEffect", "useDebugValue", "useDeferredValue",
    "useTransition", "useId", "useSyncExternalStore", "useInsertionEffect", "Fragment",
    "Suspense", "ErrorBoundary", "StrictMode", "Profiler", "memo", "forwardRef", "lazy",
    "createElement", "cloneElement", "createContext", "Children", "isValidElement", "createRef",

    // Next.js specific
    "NextPage", "GetServerSideProps", "GetStaticProps", "GetStaticPaths", "InferGetServerSidePropsType",
    "InferGetStaticPropsType", "NextApiRequest", "NextApiResponse", "NextPageContext", "AppProps",
    "AppContext", "Head", "Html", "Main", "NextScript", "Document", "App", "Router", "Image", "Link",
    "useRouter", "usePathname", "useSearchParams", "useSelectedLayoutSegment", "useSelectedLayoutSegments",
    "useServerInsertedHTML", "redirect", "notFound",

    // Common HTML/SVG tags (lowercase)
    "div", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "a", "img", "button", "input", "form",
    "ul", "li", "ol", "table", "tr", "td", "th", "thead", "tbody", "section", "article", "header",
    "footer", "nav", "main", "aside", "figure", "figcaption", "blockquote", "code", "pre",
    "strong", "em", "b", "i", "u", "mark", "small", "sub", "sup", "br", "hr", "iframe", "canvas",
    "svg", "path", "circle", "rect", "g", "line", "polyline", "polygon", "text", "ellipse",

    // Common JavaScript globals/keywords
    "console", "window", "document", "localStorage", "sessionStorage", "setTimeout", "setInterval",
    "clearTimeout", "clearInterval", "fetch", "Promise", "async", "await", "try", "catch", "finally",
    "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue", "return",
    "throw", "new", "typeof", "instanceof", "delete", "void", "null", "undefined", "true", "false",
    "this", "Array", "Object", "String", "Number", "Boolean", "Map", "Set", "Date", "Math", "JSON",
    "RegExp", "Error", "Function", "Symbol", "Proxy", "Reflect", "WeakMap", "WeakSet", "Intl",
    "WebAssembly", "decodeURI", "encodeURI", "decodeURIComponent", "encodeURIComponent", "isNaN",
    "isFinite", "parseFloat", "parseInt", "eval", "isPrototypeOf", "hasOwnProperty", "valueOf",
    "toString", "toLocaleString", "constructor", "prototype",

    // TypeScript keywords (already covered by parsing, but good to have)
    "interface", "type", "enum", "namespace", "declare", "module", "export", "import", "from", "as",
    "default", "extends", "implements", "public", "private", "protected", "readonly", "abstract",
    "static", "async", "await", "function", "const", "let", "var", "class",

    // Common libraries (add more as needed, usually camelCase or PascalCase)
    "axios", "clsx", "zod", "reactHookForm", "useForm", "useTranslations", "useLocale", "useRouter",
    "usePathname", "useSearchParams", "cn", "classNames", "twMerge", "z", // for zod
    "eventEmitter", "EVENT_TYPES" // from the original user code
]); 