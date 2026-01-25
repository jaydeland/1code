import { useState, useMemo, useCallback } from "react"
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "reactflow"
import "reactflow/dist/style.css"
import { Button } from "./ui/button"
import { Code, Eye, AlertTriangle, Copy, Check, Shield, ShieldOff } from "lucide-react"
import type { MarkdownSize } from "./chat-markdown-renderer"
import { SandboxedCodeExecutor } from "./sandboxed-code-executor"

interface ReactFlowCodeBlockProps {
  code: string
  size?: MarkdownSize
}

/**
 * Detect if code requires sandbox execution (contains React/dynamic features)
 * vs. can be safely parsed as static data
 */
function requiresSandbox(code: string): boolean {
  // Patterns that indicate dynamic React code
  const dynamicPatterns = [
    /\bfunction\s+\w+\s*\(/,          // function declarations
    /\bconst\s+\w+\s*=\s*\([^)]*\)\s*=>/,  // arrow function components
    /\bclass\s+\w+\s+extends/,        // class components
    /\buse[A-Z]\w*\s*\(/,             // React hooks (useState, useEffect, etc.)
    /<[A-Z][a-zA-Z]*[\s/>]/,          // JSX component tags
    /React\.createElement/,            // React.createElement calls
    /\bimport\s+/,                     // import statements
    /\breturn\s*\(/,                   // return statements with JSX
    /\bonClick\b|\bonChange\b/,        // event handlers
    /\.map\s*\(\s*\(/,                 // .map with arrow function
  ]

  return dynamicPatterns.some(pattern => pattern.test(code))
}

interface ParsedReactFlowConfig {
  nodes: Node[]
  edges: Edge[]
  error?: string
}

// Security limits
const MAX_NODES = 200
const MAX_EDGES = 500
const MAX_LABEL_LENGTH = 500
const MAX_CODE_LENGTH = 50000

/**
 * Sanitize a string to prevent XSS
 * Escapes HTML special characters
 */
function sanitizeString(str: unknown): string {
  if (typeof str !== "string") return String(str ?? "")
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .slice(0, MAX_LABEL_LENGTH)
}

/**
 * Sanitize a node to prevent XSS and prototype pollution
 */
function sanitizeNode(node: unknown): Node | null {
  if (!node || typeof node !== "object") return null
  const n = node as Record<string, unknown>

  // Block prototype pollution
  if ("__proto__" in n || "constructor" in n || "prototype" in n) {
    return null
  }

  // Validate required fields
  if (typeof n.id !== "string" && typeof n.id !== "number") return null

  const position = n.position as Record<string, unknown> | undefined
  if (!position || typeof position.x !== "number" || typeof position.y !== "number") {
    return null
  }

  const data = n.data as Record<string, unknown> | undefined

  return {
    id: String(n.id),
    position: { x: position.x, y: position.y },
    data: {
      label: data?.label ? sanitizeString(data.label) : String(n.id),
    },
    ...(typeof n.type === "string" && { type: n.type }),
  }
}

/**
 * Sanitize an edge to prevent XSS and prototype pollution
 */
function sanitizeEdge(edge: unknown): Edge | null {
  if (!edge || typeof edge !== "object") return null
  const e = edge as Record<string, unknown>

  // Block prototype pollution
  if ("__proto__" in e || "constructor" in e || "prototype" in e) {
    return null
  }

  // Validate required fields
  if (typeof e.id !== "string" && typeof e.id !== "number") return null
  if (typeof e.source !== "string" && typeof e.source !== "number") return null
  if (typeof e.target !== "string" && typeof e.target !== "number") return null

  return {
    id: String(e.id),
    source: String(e.source),
    target: String(e.target),
    ...(typeof e.label === "string" && { label: sanitizeString(e.label) }),
    ...(typeof e.animated === "boolean" && { animated: e.animated }),
  }
}

/**
 * Safe parser for ReactFlow configuration
 * Uses regex-based extraction instead of eval() for security
 * Includes sanitization against XSS and prototype pollution
 */
function parseReactFlowCode(code: string): ParsedReactFlowConfig {
  try {
    // Limit code size to prevent ReDoS
    if (code.length > MAX_CODE_LENGTH) {
      return { nodes: [], edges: [], error: "Code exceeds maximum length" }
    }

    let rawNodes: unknown[] = []
    let rawEdges: unknown[] = []

    // Try JSON format first (most reliable)
    if (code.trim().startsWith("{") || code.trim().startsWith("[")) {
      const parsed = JSON.parse(code)
      if (Array.isArray(parsed)) {
        rawNodes = parsed
      } else if (parsed && typeof parsed === "object") {
        rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
        rawEdges = Array.isArray(parsed.edges) ? parsed.edges : []
      }
    } else {
      // Extract nodes array using regex
      const nodesMatch = code.match(
        /const\s+nodes\s*=\s*(\[[\s\S]*?\])(?:\s*;|\s*$|\s*const)/m
      )
      const edgesMatch = code.match(
        /const\s+edges\s*=\s*(\[[\s\S]*?\])(?:\s*;|\s*$|\s*export)/m
      )

      if (!nodesMatch) {
        return { nodes: [], edges: [], error: "No 'nodes' array found in code" }
      }

      // Parse array string to JSON-compatible format
      const parseArrayString = (arrayStr: string): unknown[] => {
        // Sanitize: remove dangerous patterns
        let sanitized = arrayStr
          .replace(/\bfunction\s*\(/g, "")
          .replace(/\bnew\s+/g, "")
          .replace(/\beval\s*\(/g, "")
          .replace(/\bimport\s*\(/g, "")
          .replace(/\brequire\s*\(/g, "")

        // Convert to JSON format:
        // 1. Quote unquoted object keys
        sanitized = sanitized.replace(
          /(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
          '$1 "$2":'
        )
        // 2. Convert single quotes to double quotes (but not in already double-quoted strings)
        sanitized = sanitized.replace(/'([^']*)'/g, '"$1"')
        // 3. Remove trailing commas before ] or }
        sanitized = sanitized.replace(/,(\s*[}\]])/g, "$1")

        return JSON.parse(sanitized)
      }

      rawNodes = parseArrayString(nodesMatch[1])
      rawEdges = edgesMatch ? parseArrayString(edgesMatch[1]) : []
    }

    // Apply security limits
    if (rawNodes.length > MAX_NODES) {
      return { nodes: [], edges: [], error: `Too many nodes (max ${MAX_NODES})` }
    }
    if (rawEdges.length > MAX_EDGES) {
      return { nodes: [], edges: [], error: `Too many edges (max ${MAX_EDGES})` }
    }

    // Sanitize all nodes and edges
    const nodes = rawNodes
      .map(sanitizeNode)
      .filter((n): n is Node => n !== null)
    const edges = rawEdges
      .map(sanitizeEdge)
      .filter((e): e is Edge => e !== null)

    if (nodes.length === 0) {
      return { nodes: [], edges: [], error: "No valid nodes found" }
    }

    return { nodes, edges }
  } catch (error) {
    return {
      nodes: [],
      edges: [],
      error: `Parse error: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

function ReactFlowCodeBlockInner({ code, size = "md" }: ReactFlowCodeBlockProps) {
  const [viewMode, setViewMode] = useState<"diagram" | "code">("diagram")
  const [copied, setCopied] = useState(false)
  const [sandboxError, setSandboxError] = useState<string | null>(null)

  // Determine if we need sandbox execution
  const needsSandbox = useMemo(() => requiresSandbox(code), [code])

  // Parse static code (only used when not sandboxed)
  const parsed = useMemo(
    () => (needsSandbox ? { nodes: [], edges: [], error: undefined } : parseReactFlowCode(code)),
    [code, needsSandbox]
  )

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  const height = size === "sm" ? 300 : size === "lg" ? 500 : 400

  // Error state for static parsing - show warning and raw code
  if (!needsSandbox && parsed.error) {
    return (
      <div className="relative mt-2 mb-4 rounded-[10px] bg-muted/50 overflow-hidden border border-border/50">
        <div className="flex items-center gap-2 px-3 py-2 text-yellow-600 dark:text-yellow-400 text-sm border-b border-border/50">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{parsed.error}</span>
        </div>
        <pre className="px-4 py-3 text-xs overflow-x-auto font-mono">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="relative mt-2 mb-4 rounded-[10px] bg-muted/50 overflow-hidden border border-border/50">
      {/* Header with toggle buttons */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "diagram" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setViewMode("diagram")}
          >
            <Eye className="h-3 w-3 mr-1" />
            Diagram
          </Button>
          <Button
            variant={viewMode === "code" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setViewMode("code")}
          >
            <Code className="h-3 w-3 mr-1" />
            Code
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {/* Sandbox indicator */}
          <div
            className="flex items-center gap-1 px-2 py-1 text-xs rounded"
            title={needsSandbox ? "Running in isolated sandbox" : "Static rendering (no code execution)"}
          >
            {needsSandbox ? (
              <>
                <Shield className="h-3 w-3 text-blue-500" />
                <span className="text-muted-foreground hidden sm:inline">Sandboxed</span>
              </>
            ) : (
              <>
                <ShieldOff className="h-3 w-3 text-green-500" />
                <span className="text-muted-foreground hidden sm:inline">Static</span>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleCopy}
            title="Copy code"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {viewMode === "diagram" ? (
        needsSandbox ? (
          // Dynamic code - run in sandbox
          <SandboxedCodeExecutor
            code={code}
            height={height}
            onError={setSandboxError}
          />
        ) : (
          // Static code - render directly
          <div style={{ height }} className="bg-background/50">
            <ReactFlow
              nodes={parsed.nodes}
              edges={parsed.edges}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.5}
              maxZoom={2}
              defaultEdgeOptions={{
                style: { stroke: "#94a3b8", strokeWidth: 2 },
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#e2e8f0" gap={16} />
              <Controls
                showZoom={true}
                showFitView={true}
                showInteractive={false}
                position="bottom-left"
                className="!bg-background !border-border"
              />
              <MiniMap
                nodeColor={() => "#3b82f6"}
                maskColor="rgba(0, 0, 0, 0.1)"
                position="bottom-right"
                className="!bg-background !border-border"
              />
            </ReactFlow>
          </div>
        )
      ) : (
        <pre className="px-4 py-3 text-xs overflow-x-auto max-h-[400px] font-mono">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}

export function ReactFlowCodeBlock(props: ReactFlowCodeBlockProps) {
  return (
    <ReactFlowProvider>
      <ReactFlowCodeBlockInner {...props} />
    </ReactFlowProvider>
  )
}
