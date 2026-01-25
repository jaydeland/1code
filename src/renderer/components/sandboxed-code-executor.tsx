import { useEffect, useRef, useState, useCallback } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

interface SandboxedCodeExecutorProps {
  code: string
  height?: number
  onError?: (error: string) => void
  onReady?: () => void
}

interface SandboxMessage {
  type: "ready" | "error" | "render-complete" | "console"
  payload?: string
  level?: "log" | "warn" | "error"
}

/**
 * Generate the HTML content for the sandboxed iframe
 * Loads React, ReactFlow, and Sucrase from CDN
 * Executes user code in complete isolation
 */
function generateSandboxHTML(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://esm.sh https://cdn.jsdelivr.net;">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    body { font-family: system-ui, -apple-system, sans-serif; background: transparent; }
    .loading { display: flex; align-items: center; justify-content: center; height: 100%; color: #666; }
    .error { padding: 16px; color: #dc2626; background: #fef2f2; font-size: 13px; white-space: pre-wrap; word-break: break-word; }
    .react-flow { width: 100%; height: 100%; }
    .react-flow__node { font-size: 12px; }
  </style>
</head>
<body>
  <div id="root"><div class="loading">Loading sandbox...</div></div>

  <script type="module">
    // Import dependencies from CDN
    import React from 'https://esm.sh/react@18.2.0';
    import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';
    import ReactFlow, {
      Background,
      Controls,
      MiniMap,
      ReactFlowProvider,
      useNodesState,
      useEdgesState,
      Handle,
      Position
    } from 'https://esm.sh/reactflow@11.11.4?external=react,react-dom';
    import { transform } from 'https://esm.sh/sucrase@3.35.0';

    // Load ReactFlow CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/reactflow@11.11.4/dist/style.css';
    document.head.appendChild(link);

    // Expose globals for user code
    window.React = React;
    window.ReactDOM = ReactDOM;
    window.ReactFlow = ReactFlow;
    window.Background = Background;
    window.Controls = Controls;
    window.MiniMap = MiniMap;
    window.ReactFlowProvider = ReactFlowProvider;
    window.useNodesState = useNodesState;
    window.useEdgesState = useEdgesState;
    window.Handle = Handle;
    window.Position = Position;
    window.useState = React.useState;
    window.useEffect = React.useEffect;
    window.useCallback = React.useCallback;
    window.useMemo = React.useMemo;
    window.useRef = React.useRef;

    // Override console to send messages to parent
    const originalConsole = { ...console };
    ['log', 'warn', 'error'].forEach(level => {
      console[level] = (...args) => {
        originalConsole[level](...args);
        try {
          parent.postMessage({
            type: 'console',
            level,
            payload: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
          }, '*');
        } catch (e) {}
      };
    });

    // Error boundary component
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }
      componentDidCatch(error, info) {
        parent.postMessage({ type: 'error', payload: error.message + '\\n' + (info?.componentStack || '') }, '*');
      }
      render() {
        if (this.state.hasError) {
          return React.createElement('div', { className: 'error' },
            'Render Error: ' + (this.state.error?.message || 'Unknown error')
          );
        }
        return this.props.children;
      }
    }

    // Default wrapper for simple node/edge exports
    function DefaultFlowWrapper({ nodes: initialNodes, edges: initialEdges }) {
      const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || []);
      const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);

      return React.createElement(ReactFlow, {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        fitView: true,
        fitViewOptions: { padding: 0.2 },
        minZoom: 0.5,
        maxZoom: 2,
        proOptions: { hideAttribution: true }
      },
        React.createElement(Background, { color: '#e2e8f0', gap: 16 }),
        React.createElement(Controls, { showInteractive: false }),
        React.createElement(MiniMap, { nodeColor: () => '#3b82f6' })
      );
    }

    // Transpile and execute user code
    async function executeCode(code) {
      const root = document.getElementById('root');

      try {
        // Transpile TSX to JS
        const result = transform(code, {
          transforms: ['typescript', 'jsx'],
          jsxRuntime: 'classic',
          jsxPragma: 'React.createElement',
          jsxFragmentPragma: 'React.Fragment',
        });

        // Wrap in async function and execute
        const wrappedCode = \`
          return (async () => {
            \${result.code}

            // Check for default export
            if (typeof exports !== 'undefined' && exports.default) {
              return exports.default;
            }
            // Check for nodes/edges variables
            if (typeof nodes !== 'undefined') {
              return { nodes, edges: typeof edges !== 'undefined' ? edges : [] };
            }
            return null;
          })();
        \`;

        const exports = {};
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction('exports', 'React', 'ReactFlow', 'Background', 'Controls', 'MiniMap',
          'useNodesState', 'useEdgesState', 'Handle', 'Position', 'useState', 'useEffect',
          'useCallback', 'useMemo', 'useRef', wrappedCode);

        const result2 = await fn(exports, React, ReactFlow, Background, Controls, MiniMap,
          useNodesState, useEdgesState, Handle, Position, React.useState, React.useEffect,
          React.useCallback, React.useMemo, React.useRef);

        // Determine what to render
        let elementToRender;

        if (React.isValidElement(result2)) {
          // User returned a React element directly
          elementToRender = result2;
        } else if (typeof result2 === 'function') {
          // User exported a component
          elementToRender = React.createElement(ReactFlowProvider, null,
            React.createElement(result2)
          );
        } else if (result2 && typeof result2 === 'object' && result2.nodes) {
          // User exported { nodes, edges }
          elementToRender = React.createElement(ReactFlowProvider, null,
            React.createElement(DefaultFlowWrapper, result2)
          );
        } else {
          throw new Error('Code must export: a React component, a React element, or { nodes, edges }');
        }

        // Render with error boundary
        const reactRoot = ReactDOM.createRoot(root);
        reactRoot.render(
          React.createElement(ErrorBoundary, null, elementToRender)
        );

        parent.postMessage({ type: 'render-complete' }, '*');

      } catch (error) {
        root.innerHTML = '<div class="error">' + escapeHtml(error.message) + '</div>';
        parent.postMessage({ type: 'error', payload: error.message }, '*');
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Listen for code from parent
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'execute') {
        executeCode(event.data.code);
      }
    });

    // Signal ready
    parent.postMessage({ type: 'ready' }, '*');
  </script>
</body>
</html>
`;
}

/**
 * Sandboxed code executor component
 * Runs user code in a completely isolated iframe with no access to parent context
 */
export function SandboxedCodeExecutor({
  code,
  height = 400,
  onError,
  onReady
}: SandboxedCodeExecutorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Create blob URL for iframe src
  useEffect(() => {
    const html = generateSandboxHTML()
    const blob = new Blob([html], { type: "text/html" })
    blobUrlRef.current = URL.createObjectURL(blob)

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
    }
  }, [])

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent<SandboxMessage>) => {
      // Only accept messages from our iframe
      if (event.source !== iframeRef.current?.contentWindow) return

      const { type, payload, level } = event.data

      switch (type) {
        case "ready":
          setStatus("ready")
          onReady?.()
          // Send code to execute
          iframeRef.current?.contentWindow?.postMessage({ type: "execute", code }, "*")
          break
        case "error":
          setStatus("error")
          setError(payload || "Unknown error")
          onError?.(payload || "Unknown error")
          break
        case "render-complete":
          setStatus("ready")
          setError(null)
          break
        case "console":
          // Log sandbox console messages to parent console
          if (level === "error") {
            console.error("[Sandbox]", payload)
          } else if (level === "warn") {
            console.warn("[Sandbox]", payload)
          } else {
            console.log("[Sandbox]", payload)
          }
          break
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [code, onError, onReady])

  // Re-execute when code changes
  useEffect(() => {
    if (status === "ready" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "execute", code }, "*")
    }
  }, [code, status])

  return (
    <div className="relative w-full" style={{ height }}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading sandbox...</span>
        </div>
      )}

      {error && (
        <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs z-10 border-b border-red-200 dark:border-red-900">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {blobUrlRef.current && (
        <iframe
          ref={iframeRef}
          src={blobUrlRef.current}
          sandbox="allow-scripts"
          className="w-full h-full border-0 bg-background/50"
          title="Sandboxed Code Executor"
        />
      )}
    </div>
  )
}
