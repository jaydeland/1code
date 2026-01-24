"use client"

import React from "react"
import { Server, Check } from "lucide-react"
import { trpc } from "../../../lib/trpc"
import { cn } from "../../../lib/utils"

interface ClustersTabContentProps {
  isMobileFullscreen?: boolean
  className?: string
}

export function ClustersTabContent({ className }: ClustersTabContentProps) {
  // Query clusters (this would need the actual tRPC endpoint)
  const { data: clusters, isLoading } = trpc.clusters.list.useQuery()

  if (isLoading) {
    return (
      <div className={cn("flex-1 overflow-y-auto p-4", className)}>
        <div className="text-sm text-muted-foreground">Loading clusters...</div>
      </div>
    )
  }

  const clusterList = clusters || []

  return (
    <div className={cn("flex-1 overflow-y-auto", className)}>
      <div className="p-3 space-y-1">
        {clusterList.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No clusters configured
          </div>
        ) : (
          clusterList.map((cluster: any) => (
            <button
              key={cluster.id || cluster.name}
              type="button"
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors",
                "hover:bg-foreground/5 text-foreground",
              )}
            >
              <Server className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {cluster.name}
                </div>
                {cluster.namespace && (
                  <div className="text-xs text-muted-foreground truncate">
                    {cluster.namespace}
                  </div>
                )}
              </div>
              {cluster.connected && (
                <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
