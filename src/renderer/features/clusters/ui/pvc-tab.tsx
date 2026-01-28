"use client"

import { useAtomValue, useAtom } from "jotai"
import { HardDrive, RefreshCw, Loader2, AlertTriangle } from "lucide-react"
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

export function PvcTab() {
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

  // Get PVCs in selected namespace
  const {
    data: pvcs,
    isLoading: pvcsLoading,
    error: pvcsError,
    isError: pvcsIsError,
    refetch: refetchPvcs,
    isRefetching: pvcsRefetching,
  } = trpc.clusters.getPvcs.useQuery(
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
          onClick={() => refetchPvcs()}
          disabled={pvcsRefetching}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RefreshCw className={cn("h-3 w-3", pvcsRefetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* PVCs List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Persistent Volume Claims ({pvcs?.length || 0})
          </h3>
        </div>

        {pvcsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pvcsIsError ? (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-500">Failed to load PVCs</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {pvcsError?.message || "Unknown error"}
              </p>
            </div>
          </div>
        ) : pvcs && pvcs.length > 0 ? (
          <div className="space-y-3">
            {pvcs.map((pvc) => (
              <div
                key={`${pvc.namespace}-${pvc.name}`}
                className="p-4 bg-muted/30 border border-border rounded-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pvc.name}</span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          pvc.status === "Bound"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : pvc.status === "Pending"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-red-500/10 text-red-500"
                        )}
                      >
                        {pvc.status}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div>Namespace: {pvc.namespace}</div>
                      {pvc.storageClass && (
                        <div>Storage Class: {pvc.storageClass}</div>
                      )}
                      {pvc.accessModes && (
                        <div>Access Modes: {pvc.accessModes}</div>
                      )}
                    </div>
                  </div>

                  {/* Storage Info */}
                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Capacity</div>
                      <div className="text-sm font-medium">
                        {pvc.capacity || "--"}
                      </div>
                    </div>
                    {pvc.volume && (
                      <div className="text-right max-w-[200px]">
                        <div className="text-xs text-muted-foreground">Volume</div>
                        <div className="text-xs font-medium font-mono truncate">
                          {pvc.volume}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No PVCs found in {currentNamespace}
          </p>
        )}
      </div>
    </div>
  )
}
