"use client"

import { useAtomValue, useAtom } from "jotai"
import { Network, RefreshCw, Loader2, AlertTriangle } from "lucide-react"
import { cn } from "../../../lib/utils"
import { trpc } from "../../../lib/trpc"
import { selectedClusterIdAtom, selectedNamespaceAtom } from "../atoms"
import { clustersDefaultNamespaceAtom } from "../../../lib/atoms"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select"

export function ServicesTab() {
  const selectedClusterId = useAtomValue(selectedClusterIdAtom)
  const [selectedNamespace, setSelectedNamespace] = useAtom(selectedNamespaceAtom)
  const defaultNamespaceOverride = useAtomValue(clustersDefaultNamespaceAtom)

  // Get derived namespace from email
  const { data: derivedNamespace } = trpc.clusters.getDefaultNamespace.useQuery()

  // Effective default namespace
  const effectiveDefaultNamespace = defaultNamespaceOverride || derivedNamespace || "default"
  const currentNamespace = selectedNamespace || effectiveDefaultNamespace

  // Get cluster status
  const { data: status } = trpc.clusters.getStatus.useQuery(
    { clusterName: selectedClusterId! },
    { enabled: !!selectedClusterId }
  )

  // Get namespaces
  const { data: namespaces, isLoading: namespacesLoading } = trpc.clusters.getNamespaces.useQuery(
    { clusterName: selectedClusterId! },
    { enabled: !!selectedClusterId && status?.connected }
  )

  // Get services in selected namespace
  const {
    data: services,
    isLoading: servicesLoading,
    error: servicesError,
    isError: servicesIsError,
    refetch: refetchServices,
    isRefetching: servicesRefetching,
  } = trpc.clusters.getServices.useQuery(
    { clusterName: selectedClusterId!, namespace: currentNamespace },
    { enabled: !!selectedClusterId && status?.connected && !!currentNamespace }
  )

  if (!status?.connected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Waiting for cluster connection...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4 overflow-y-auto">
      {/* Namespace Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Namespace:</span>
          <Select
            value={currentNamespace}
            onValueChange={(value) => setSelectedNamespace(value)}
          >
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Select namespace" />
            </SelectTrigger>
            <SelectContent>
              {namespaces?.map((ns) => (
                <SelectItem key={ns.name} value={ns.name}>
                  <span className="flex items-center gap-2">
                    {ns.name}
                    {ns.name === effectiveDefaultNamespace && (
                      <span className="text-xs text-muted-foreground">(default)</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={() => refetchServices()}
          disabled={servicesRefetching}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RefreshCw className={cn("h-3 w-3", servicesRefetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Services List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Network className="h-4 w-4" />
            Services ({services?.length || 0})
          </h3>
        </div>

        {servicesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : servicesIsError ? (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-500">Failed to load services</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {servicesError?.message || "Unknown error"}
              </p>
            </div>
          </div>
        ) : services && services.length > 0 ? (
          <div className="space-y-2">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{svc.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    Cluster IP: {svc.clusterIp}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Type</div>
                    <span className="text-sm px-2 py-0.5 bg-muted rounded">
                      {svc.type}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Ports</div>
                    <div className="text-sm text-muted-foreground">{svc.ports}</div>
                  </div>
                  {svc.externalIp !== "<none>" && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">External IP</div>
                      <div className="text-sm font-mono">{svc.externalIp}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No services found in {currentNamespace}
          </p>
        )}
      </div>
    </div>
  )
}
