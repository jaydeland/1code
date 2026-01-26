"use client"

import { useAtom, useAtomValue } from "jotai"
import {
  Box,
  Database,
  Rocket,
  Network,
} from "lucide-react"
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
import {
  StatCard,
  PodStatusChart,
  DeploymentHealthChart,
  TopPodsChart,
  calculateClusterStats,
  getStatusFromRatio,
} from "./dashboard"

export function DashboardTab() {
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

  // Get PVCs (PersistentVolumeClaims) in selected namespace
  const {
    data: pvcs,
    isError: pvcsIsError,
  } = trpc.clusters.getPvcs.useQuery(
    { clusterName: selectedClusterId!, namespace: currentNamespace },
    { enabled: !!selectedClusterId && status?.connected && !!currentNamespace }
  )

  // Get pods in selected namespace (for stats only)
  const {
    data: pods,
    isError: podsIsError,
  } = trpc.clusters.getPods.useQuery(
    { clusterName: selectedClusterId!, namespace: currentNamespace },
    { enabled: !!selectedClusterId && status?.connected && !!currentNamespace }
  )

  // Get deployments in selected namespace (for stats only)
  const {
    data: deployments,
    isError: deploymentsIsError,
  } = trpc.clusters.getDeployments.useQuery(
    { clusterName: selectedClusterId!, namespace: currentNamespace },
    { enabled: !!selectedClusterId && status?.connected && !!currentNamespace }
  )

  // Get services in selected namespace (for stats only)
  const {
    data: services,
    isError: servicesIsError,
  } = trpc.clusters.getServices.useQuery(
    { clusterName: selectedClusterId!, namespace: currentNamespace },
    { enabled: !!selectedClusterId && status?.connected && !!currentNamespace }
  )

  // Get pod metrics
  const { data: podMetrics, isLoading: podMetricsLoading } =
    trpc.clusters.getPodMetrics.useQuery(
      { clusterName: selectedClusterId!, namespace: currentNamespace },
      { enabled: !!selectedClusterId && status?.connected && !!currentNamespace }
    )

  // Calculate stats
  const stats = calculateClusterStats(pods, pvcs, deployments, services)

  if (!status?.connected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Waiting for cluster connection...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Pods"
          icon={Box}
          value={podsIsError ? "Error" : `${stats.pods.running}/${stats.pods.total}`}
          subtitle={podsIsError ? "failed to load" : "pods running"}
          status={podsIsError ? "critical" : getStatusFromRatio(stats.pods.running, stats.pods.total)}
        />
        <StatCard
          title="PVCs"
          icon={Database}
          value={pvcsIsError ? "Error" : `${stats.pvcs.bound}/${stats.pvcs.total}`}
          subtitle={pvcsIsError ? "failed to load" : "PVCs bound"}
          status={pvcsIsError ? "critical" : getStatusFromRatio(stats.pvcs.bound, stats.pvcs.total)}
        />
        <StatCard
          title="Deployments"
          icon={Rocket}
          value={deploymentsIsError ? "Error" : `${stats.deployments.healthy}/${stats.deployments.total}`}
          subtitle={deploymentsIsError ? "failed to load" : "deployments healthy"}
          status={deploymentsIsError ? "critical" : getStatusFromRatio(stats.deployments.healthy, stats.deployments.total)}
        />
        <StatCard
          title="Services"
          icon={Network}
          value={servicesIsError ? "Error" : stats.services.total}
          subtitle={servicesIsError ? "failed to load" : "services active"}
          status={servicesIsError ? "critical" : "neutral"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        <PodStatusChart stats={stats} />
        <DeploymentHealthChart stats={stats} />
      </div>

      {/* Metrics Charts Row */}
      <div className="grid grid-cols-1 gap-4">
        <TopPodsChart metrics={podMetrics} isLoading={podMetricsLoading} sortBy="cpu" />
      </div>
    </div>
  )
}
