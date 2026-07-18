package clients

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

// K8sClient 单集群 K8s 客户端
type K8sClient struct {
	Clientset *kubernetes.Clientset
	Metrics   *metricsclient.Clientset
	Dynamic   dynamic.Interface
	Discovery discovery.DiscoveryInterface
	RestCfg   *rest.Config
	Name      string
}

func NewK8sClient(name, kubeconfigYAML string) (*K8sClient, error) {
	restCfg, err := clientcmd.RESTConfigFromKubeConfig([]byte(kubeconfigYAML))
	if err != nil {
		return nil, fmt.Errorf("parse kubeconfig: %w", err)
	}
	// 30s：够长处理慢 DNS 或跨地域，够短不阻塞用户
	restCfg.Timeout = 30 * time.Second

	cs, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("clientset: %w", err)
	}
	ms, err := metricsclient.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("metrics: %w", err)
	}
	dyn, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("dynamic: %w", err)
	}
	return &K8sClient{
		Clientset: cs,
		Metrics:   ms,
		Dynamic:   dyn,
		Discovery: cs.Discovery(),
		RestCfg:   restCfg,
		Name:      name,
	}, nil
}

func (k *K8sClient) Ping(ctx context.Context) error {
	_, err := k.Clientset.Discovery().ServerVersion()
	return err
}

// ListNodes 列节点及基础状态
func (k *K8sClient) ListNodes(ctx context.Context) ([]NodeInfo, error) {
	nodes, err := k.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]NodeInfo, 0, len(nodes.Items))
	for _, n := range nodes.Items {
		ready := "Unknown"
		for _, c := range n.Status.Conditions {
			if c.Type == corev1.NodeReady {
				ready = string(c.Status)
			}
		}
		out = append(out, NodeInfo{
			Name:           n.Name,
			Ready:          ready,
			CreationTime:   n.CreationTimestamp.Time,
			InstanceType:   n.Labels["node.kubernetes.io/instance-type"],
			Zone:           n.Labels["topology.kubernetes.io/zone"],
			Region:         n.Labels["topology.kubernetes.io/region"],
			NodePool:       n.Labels["cloud.tencent.com/node-instance-pool-id"],
			Labels:         n.Labels,
		})
	}
	return out, nil
}

type NodeInfo struct {
	Name         string            `json:"name"`
	Ready        string            `json:"ready"`
	CreationTime time.Time         `json:"creation_time"`
	InstanceType string            `json:"instance_type,omitempty"`
	Zone         string            `json:"zone,omitempty"`
	Region       string            `json:"region,omitempty"`
	NodePool     string            `json:"node_pool,omitempty"`
	Labels       map[string]string `json:"labels,omitempty"`
}

// NodeMetrics 通过 metrics-server 拿节点实时 CPU/内存使用
type NodeMetric struct {
	Name       string    `json:"name"`
	CPU        string    `json:"cpu"`
	Memory     string    `json:"memory"`
	Timestamp  time.Time `json:"timestamp"`
}

func (k *K8sClient) NodeMetrics(ctx context.Context) ([]NodeMetric, error) {
	list, err := k.Metrics.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]NodeMetric, 0, len(list.Items))
	for _, m := range list.Items {
		out = append(out, NodeMetric{
			Name:      m.Name,
			CPU:       m.Usage.Cpu().String(),
			Memory:    m.Usage.Memory().String(),
			Timestamp: m.Timestamp.Time,
		})
	}
	return out, nil
}

// CountReadyNodesByLabel 数一下匹配特定 label 的 Ready 节点数
// 用于扩容后判断"多少台新节点到位了"
func (k *K8sClient) CountReadyNodesByLabel(ctx context.Context, labelSelector string) (int, error) {
	nodes, err := k.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return 0, err
	}
	count := 0
	for _, n := range nodes.Items {
		for _, c := range n.Status.Conditions {
			if c.Type == corev1.NodeReady && c.Status == corev1.ConditionTrue {
				count++
				break
			}
		}
	}
	return count, nil
}

// K8sClientPool 多集群客户端池，按 clusterId 缓存
type K8sClientPool struct {
	mu      sync.RWMutex
	clients map[int64]*K8sClient
}

func NewK8sClientPool() *K8sClientPool {
	return &K8sClientPool{clients: make(map[int64]*K8sClient)}
}

func (p *K8sClientPool) Get(clusterID int64) (*K8sClient, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	c, ok := p.clients[clusterID]
	return c, ok
}

func (p *K8sClientPool) Set(clusterID int64, c *K8sClient) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.clients[clusterID] = c
}

func (p *K8sClientPool) Remove(clusterID int64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.clients, clusterID)
}

// ============ K8s 资源查询 ============

// ListPods 列出所有 namespace 的 Pods
func (k *K8sClient) ListPods(ctx context.Context, namespace string) ([]PodInfo, error) {
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}
	pods, err := k.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]PodInfo, 0, len(pods.Items))
	for _, p := range pods.Items {
		ready := 0
		total := len(p.Status.ContainerStatuses)
		for _, cs := range p.Status.ContainerStatuses {
			if cs.Ready {
				ready++
			}
		}

		// 提取容器列表（用于日志查询时选择）
		containers := make([]ContainerInfo, 0, len(p.Spec.Containers))
		for _, c := range p.Spec.Containers {
			isReady := false
			for _, cs := range p.Status.ContainerStatuses {
				if cs.Name == c.Name && cs.Ready {
					isReady = true
					break
				}
			}
			containers = append(containers, ContainerInfo{
				Name:  c.Name,
				Image: c.Image,
				Ready: isReady,
			})
		}

		out = append(out, PodInfo{
			Name:       p.Name,
			Namespace:  p.Namespace,
			Status:     string(p.Status.Phase),
			Ready:      fmt.Sprintf("%d/%d", ready, total),
			Restarts:   sumRestarts(p.Status.ContainerStatuses),
			Age:        p.CreationTimestamp.Time,
			Node:       p.Spec.NodeName,
			Labels:     p.Labels,
			Containers: containers,
		})
	}
	return out, nil
}

type PodInfo struct {
	Name       string            `json:"name"`
	Namespace  string            `json:"namespace"`
	Status     string            `json:"status"`
	Ready      string            `json:"ready"`
	Restarts   int32             `json:"restarts"`
	Age        time.Time         `json:"age"`
	Node       string            `json:"node,omitempty"`
	Labels     map[string]string `json:"labels,omitempty"`
	Containers []ContainerInfo   `json:"containers,omitempty"`
}

type ContainerInfo struct {
	Name  string `json:"name"`
	Image string `json:"image,omitempty"`
	Ready bool   `json:"ready"`
}

func sumRestarts(statuses []corev1.ContainerStatus) int32 {
	var sum int32
	for _, s := range statuses {
		sum += s.RestartCount
	}
	return sum
}

// GetPodYAML 获取 Pod 的 YAML
func (k *K8sClient) GetPodYAML(ctx context.Context, namespace, name string) (map[string]any, error) {
	pod, err := k.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return podToMap(pod), nil
}

func podToMap(pod *corev1.Pod) map[string]any {
	return map[string]any{
		"apiVersion": "v1",
		"kind":       "Pod",
		"metadata":   pod.ObjectMeta,
		"spec":       pod.Spec,
		"status":     pod.Status,
	}
}

// ContainerStatus 单个容器的状态快照
type ContainerStatus struct {
	Name         string     `json:"name"`
	Image        string     `json:"image"`
	Ready        bool       `json:"ready"`
	RestartCount int32      `json:"restart_count"`
	State        string     `json:"state"`        // running/waiting/terminated
	Reason       string     `json:"reason,omitempty"`
	Message      string     `json:"message,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	FinishedAt   *time.Time `json:"finished_at,omitempty"`
	ExitCode     int32      `json:"exit_code,omitempty"`
	Requests     map[string]string `json:"requests,omitempty"`  // cpu/mem
	Limits       map[string]string `json:"limits,omitempty"`
}

// PodDetail Pod 详情 (供 APP 详情页用)
type PodDetail struct {
	Name         string            `json:"name"`
	Namespace    string            `json:"namespace"`
	Node         string            `json:"node,omitempty"`
	Phase        string            `json:"phase"`
	PodIP        string            `json:"pod_ip,omitempty"`
	HostIP       string            `json:"host_ip,omitempty"`
	QosClass     string            `json:"qos_class,omitempty"`
	ServiceAccount string          `json:"service_account,omitempty"`
	RestartPolicy string           `json:"restart_policy,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
	StartedAt    *time.Time        `json:"started_at,omitempty"`
	Labels       map[string]string `json:"labels,omitempty"`
	Annotations  map[string]string `json:"annotations,omitempty"`
	Conditions   []PodCondition    `json:"conditions,omitempty"`
	Containers   []ContainerStatus `json:"containers"`
	InitContainers []ContainerStatus `json:"init_containers,omitempty"`
	TotalRestarts int32            `json:"total_restarts"`
	LastRestartAt *time.Time       `json:"last_restart_at,omitempty"`

	// 调度相关信息
	NodeSelector map[string]string `json:"node_selector,omitempty"`
	Tolerations  []PodToleration   `json:"tolerations,omitempty"`
	Affinity     *PodAffinityInfo  `json:"affinity,omitempty"`

	// 资源汇总（所有容器 requests/limits 之和，方便概览）
	TotalRequests map[string]string `json:"total_requests,omitempty"`
	TotalLimits   map[string]string `json:"total_limits,omitempty"`

	// PriorityClass
	PriorityClassName string `json:"priority_class_name,omitempty"`
	Priority          *int32 `json:"priority,omitempty"`

	// Volumes概况
	Volumes []PodVolumeInfo `json:"volumes,omitempty"`
}

type PodToleration struct {
	Key               string `json:"key,omitempty"`
	Operator          string `json:"operator,omitempty"`
	Value             string `json:"value,omitempty"`
	Effect            string `json:"effect,omitempty"`
	TolerationSeconds *int64 `json:"toleration_seconds,omitempty"`
}

type PodAffinityInfo struct {
	NodeAffinity    string `json:"node_affinity,omitempty"`     // 简化后的字符串描述
	PodAffinity     string `json:"pod_affinity,omitempty"`
	PodAntiAffinity string `json:"pod_anti_affinity,omitempty"`
}

type PodVolumeInfo struct {
	Name   string `json:"name"`
	Type   string `json:"type"`   // configMap / secret / persistentVolumeClaim / emptyDir 等
	Source string `json:"source,omitempty"`
}

type PodCondition struct {
	Type   string `json:"type"`
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
	LastTransitionAt *time.Time `json:"last_transition_at,omitempty"`
}

// ListNamespaces 列出所有 namespace
func (k *K8sClient) ListNamespaces(ctx context.Context) ([]string, error) {
	nsList, err := k.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	result := make([]string, 0, len(nsList.Items))
	for _, ns := range nsList.Items {
		result = append(result, ns.Name)
	}
	return result, nil
}

// GetPodDetail 拿 Pod 详情
func (k *K8sClient) GetPodDetail(ctx context.Context, namespace, name string) (*PodDetail, error) {
	pod, err := k.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	d := &PodDetail{
		Name:           pod.Name,
		Namespace:      pod.Namespace,
		Node:           pod.Spec.NodeName,
		Phase:          string(pod.Status.Phase),
		PodIP:          pod.Status.PodIP,
		HostIP:         pod.Status.HostIP,
		QosClass:       string(pod.Status.QOSClass),
		ServiceAccount: pod.Spec.ServiceAccountName,
		RestartPolicy:  string(pod.Spec.RestartPolicy),
		CreatedAt:      pod.CreationTimestamp.Time,
		Labels:         pod.Labels,
		Annotations:    pod.Annotations,
	}
	if pod.Status.StartTime != nil {
		t := pod.Status.StartTime.Time
		d.StartedAt = &t
	}
	for _, c := range pod.Status.Conditions {
		pc := PodCondition{
			Type:   string(c.Type),
			Status: string(c.Status),
			Reason: c.Reason,
		}
		if !c.LastTransitionTime.IsZero() {
			t := c.LastTransitionTime.Time
			pc.LastTransitionAt = &t
		}
		d.Conditions = append(d.Conditions, pc)
	}
	d.Containers = buildContainerStatuses(pod.Spec.Containers, pod.Status.ContainerStatuses)
	d.InitContainers = buildContainerStatuses(pod.Spec.InitContainers, pod.Status.InitContainerStatuses)
	var lastRestart time.Time
	for _, cs := range pod.Status.ContainerStatuses {
		d.TotalRestarts += cs.RestartCount
		if cs.LastTerminationState.Terminated != nil {
			t := cs.LastTerminationState.Terminated.FinishedAt.Time
			if t.After(lastRestart) {
				lastRestart = t
			}
		}
	}
	if !lastRestart.IsZero() {
		d.LastRestartAt = &lastRestart
	}

	// NodeSelector
	if len(pod.Spec.NodeSelector) > 0 {
		d.NodeSelector = pod.Spec.NodeSelector
	}

	// Tolerations
	for _, t := range pod.Spec.Tolerations {
		pt := PodToleration{
			Key:      t.Key,
			Operator: string(t.Operator),
			Value:    t.Value,
			Effect:   string(t.Effect),
		}
		if t.TolerationSeconds != nil {
			pt.TolerationSeconds = t.TolerationSeconds
		}
		d.Tolerations = append(d.Tolerations, pt)
	}

	// Affinity（简化为字符串描述）
	if pod.Spec.Affinity != nil {
		aff := &PodAffinityInfo{}
		if pod.Spec.Affinity.NodeAffinity != nil {
			if pod.Spec.Affinity.NodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution != nil {
				aff.NodeAffinity = "required"
			} else if len(pod.Spec.Affinity.NodeAffinity.PreferredDuringSchedulingIgnoredDuringExecution) > 0 {
				aff.NodeAffinity = "preferred"
			}
		}
		if pod.Spec.Affinity.PodAffinity != nil {
			aff.PodAffinity = fmt.Sprintf("required:%d preferred:%d",
				len(pod.Spec.Affinity.PodAffinity.RequiredDuringSchedulingIgnoredDuringExecution),
				len(pod.Spec.Affinity.PodAffinity.PreferredDuringSchedulingIgnoredDuringExecution))
		}
		if pod.Spec.Affinity.PodAntiAffinity != nil {
			aff.PodAntiAffinity = fmt.Sprintf("required:%d preferred:%d",
				len(pod.Spec.Affinity.PodAntiAffinity.RequiredDuringSchedulingIgnoredDuringExecution),
				len(pod.Spec.Affinity.PodAntiAffinity.PreferredDuringSchedulingIgnoredDuringExecution))
		}
		if aff.NodeAffinity != "" || aff.PodAffinity != "" || aff.PodAntiAffinity != "" {
			d.Affinity = aff
		}
	}

	// Total Requests / Limits
	var totalCPUReq, totalMemReq, totalCPULim, totalMemLim int64
	for _, c := range pod.Spec.Containers {
		if v, ok := c.Resources.Requests[corev1.ResourceCPU]; ok {
			totalCPUReq += v.MilliValue()
		}
		if v, ok := c.Resources.Requests[corev1.ResourceMemory]; ok {
			totalMemReq += v.Value()
		}
		if v, ok := c.Resources.Limits[corev1.ResourceCPU]; ok {
			totalCPULim += v.MilliValue()
		}
		if v, ok := c.Resources.Limits[corev1.ResourceMemory]; ok {
			totalMemLim += v.Value()
		}
	}
	if totalCPUReq > 0 || totalMemReq > 0 {
		d.TotalRequests = map[string]string{}
		if totalCPUReq > 0 {
			d.TotalRequests["cpu"] = fmt.Sprintf("%dm", totalCPUReq)
		}
		if totalMemReq > 0 {
			d.TotalRequests["memory"] = formatBytes(totalMemReq)
		}
	}
	if totalCPULim > 0 || totalMemLim > 0 {
		d.TotalLimits = map[string]string{}
		if totalCPULim > 0 {
			d.TotalLimits["cpu"] = fmt.Sprintf("%dm", totalCPULim)
		}
		if totalMemLim > 0 {
			d.TotalLimits["memory"] = formatBytes(totalMemLim)
		}
	}

	// PriorityClass
	d.PriorityClassName = pod.Spec.PriorityClassName
	d.Priority = pod.Spec.Priority

	// Volumes
	for _, v := range pod.Spec.Volumes {
		vi := PodVolumeInfo{Name: v.Name}
		switch {
		case v.ConfigMap != nil:
			vi.Type = "configMap"
			vi.Source = v.ConfigMap.Name
		case v.Secret != nil:
			vi.Type = "secret"
			vi.Source = v.Secret.SecretName
		case v.PersistentVolumeClaim != nil:
			vi.Type = "pvc"
			vi.Source = v.PersistentVolumeClaim.ClaimName
		case v.EmptyDir != nil:
			vi.Type = "emptyDir"
		case v.HostPath != nil:
			vi.Type = "hostPath"
			vi.Source = v.HostPath.Path
		case v.Projected != nil:
			vi.Type = "projected"
		case v.NFS != nil:
			vi.Type = "nfs"
			vi.Source = v.NFS.Server + ":" + v.NFS.Path
		default:
			vi.Type = "other"
		}
		d.Volumes = append(d.Volumes, vi)
	}

	return d, nil
}

func formatBytes(n int64) string {
	const (
		Ki = 1024
		Mi = 1024 * Ki
		Gi = 1024 * Mi
	)
	switch {
	case n >= Gi:
		return fmt.Sprintf("%.2fGi", float64(n)/Gi)
	case n >= Mi:
		return fmt.Sprintf("%.2fMi", float64(n)/Mi)
	case n >= Ki:
		return fmt.Sprintf("%.2fKi", float64(n)/Ki)
	}
	return fmt.Sprintf("%dB", n)
}

func buildContainerStatuses(specs []corev1.Container, statuses []corev1.ContainerStatus) []ContainerStatus {
	specMap := make(map[string]corev1.Container, len(specs))
	for _, s := range specs {
		specMap[s.Name] = s
	}
	out := make([]ContainerStatus, 0, len(statuses))
	for _, cs := range statuses {
		item := ContainerStatus{
			Name:         cs.Name,
			Image:        cs.Image,
			Ready:        cs.Ready,
			RestartCount: cs.RestartCount,
		}
		switch {
		case cs.State.Running != nil:
			item.State = "running"
			t := cs.State.Running.StartedAt.Time
			item.StartedAt = &t
		case cs.State.Waiting != nil:
			item.State = "waiting"
			item.Reason = cs.State.Waiting.Reason
			item.Message = cs.State.Waiting.Message
		case cs.State.Terminated != nil:
			item.State = "terminated"
			item.Reason = cs.State.Terminated.Reason
			item.Message = cs.State.Terminated.Message
			item.ExitCode = cs.State.Terminated.ExitCode
			ts := cs.State.Terminated.StartedAt.Time
			tf := cs.State.Terminated.FinishedAt.Time
			item.StartedAt = &ts
			item.FinishedAt = &tf
		}
		if spec, ok := specMap[cs.Name]; ok {
			if len(spec.Resources.Requests) > 0 {
				item.Requests = map[string]string{}
				if v, ok := spec.Resources.Requests[corev1.ResourceCPU]; ok {
					item.Requests["cpu"] = v.String()
				}
				if v, ok := spec.Resources.Requests[corev1.ResourceMemory]; ok {
					item.Requests["memory"] = v.String()
				}
			}
			if len(spec.Resources.Limits) > 0 {
				item.Limits = map[string]string{}
				if v, ok := spec.Resources.Limits[corev1.ResourceCPU]; ok {
					item.Limits["cpu"] = v.String()
				}
				if v, ok := spec.Resources.Limits[corev1.ResourceMemory]; ok {
					item.Limits["memory"] = v.String()
				}
			}
		}
		out = append(out, item)
	}
	return out
}

// PodEvent Pod 事件
type PodEvent struct {
	Type      string    `json:"type"`      // Normal / Warning
	Reason    string    `json:"reason"`
	Message   string    `json:"message"`
	Count     int32     `json:"count"`
	FirstAt   time.Time `json:"first_at"`
	LastAt    time.Time `json:"last_at"`
	Source    string    `json:"source,omitempty"`
}

// ListPodEvents 拿 Pod 关联的事件
func (k *K8sClient) ListPodEvents(ctx context.Context, namespace, name string) ([]PodEvent, error) {
	sel := fmt.Sprintf("involvedObject.name=%s,involvedObject.namespace=%s", name, namespace)
	evs, err := k.Clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{FieldSelector: sel, Limit: 200})
	if err != nil {
		return nil, err
	}
	out := make([]PodEvent, 0, len(evs.Items))
	for _, e := range evs.Items {
		firstAt := e.FirstTimestamp.Time
		lastAt := e.LastTimestamp.Time
		if lastAt.IsZero() && !e.EventTime.IsZero() {
			lastAt = e.EventTime.Time
			firstAt = lastAt
		}
		out = append(out, PodEvent{
			Type:    e.Type,
			Reason:  e.Reason,
			Message: e.Message,
			Count:   e.Count,
			FirstAt: firstAt,
			LastAt:  lastAt,
			Source:  e.Source.Component,
		})
	}
	// 按 LastAt 倒序
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[j].LastAt.After(out[i].LastAt) {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out, nil
}

// GetPodLogs 拿容器最近日志(非流式,一次性返回 tail 行)
// container 为空时取 pod 里第一个容器
func (k *K8sClient) GetPodLogs(ctx context.Context, namespace, name, container string, tailLines int64, previous bool) (string, error) {
	if tailLines <= 0 {
		tailLines = 500
	}
	opt := &corev1.PodLogOptions{
		TailLines: &tailLines,
		Previous:  previous,
		Timestamps: true,
	}
	if container != "" {
		opt.Container = container
	}
	req := k.Clientset.CoreV1().Pods(namespace).GetLogs(name, opt)
	stream, err := req.Stream(ctx)
	if err != nil {
		return "", err
	}
	defer stream.Close()
	buf := make([]byte, 0, 64*1024)
	tmp := make([]byte, 8192)
	for {
		n, err := stream.Read(tmp)
		if n > 0 {
			buf = append(buf, tmp[:n]...)
			// 限制最大 1MB
			if len(buf) > 1024*1024 {
				buf = append(buf, []byte("\n...[truncated]...")...)
				break
			}
		}
		if err != nil {
			break
		}
	}
	return string(buf), nil
}

// ListDeployments 列出 Deployments
func (k *K8sClient) ListDeployments(ctx context.Context, namespace string) ([]DeploymentInfo, error) {
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}
	deps, err := k.Clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]DeploymentInfo, 0, len(deps.Items))
	for _, d := range deps.Items {
		out = append(out, DeploymentInfo{
			Name:      d.Name,
			Namespace: d.Namespace,
			Ready:     fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, d.Status.Replicas),
			UpToDate:  d.Status.UpdatedReplicas,
			Available: d.Status.AvailableReplicas,
			Age:       d.CreationTimestamp.Time,
			Labels:    d.Labels,
		})
	}
	return out, nil
}

type DeploymentInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Ready     string            `json:"ready"`
	UpToDate  int32             `json:"up_to_date"`
	Available int32             `json:"available"`
	Age       time.Time         `json:"age"`
	Labels    map[string]string `json:"labels,omitempty"`
}

// ListServices 列出 Services
func (k *K8sClient) ListServices(ctx context.Context, namespace string) ([]ServiceInfo, error) {
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}
	svcs, err := k.Clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]ServiceInfo, 0, len(svcs.Items))
	for _, s := range svcs.Items {
		clusterIP := s.Spec.ClusterIP
		externalIP := ""
		if len(s.Status.LoadBalancer.Ingress) > 0 {
			externalIP = s.Status.LoadBalancer.Ingress[0].IP
		}
		out = append(out, ServiceInfo{
			Name:       s.Name,
			Namespace:  s.Namespace,
			Type:       string(s.Spec.Type),
			ClusterIP:  clusterIP,
			ExternalIP: externalIP,
			Ports:      formatPorts(s.Spec.Ports),
			Age:        s.CreationTimestamp.Time,
			Labels:     s.Labels,
		})
	}
	return out, nil
}

type ServiceInfo struct {
	Name       string            `json:"name"`
	Namespace  string            `json:"namespace"`
	Type       string            `json:"type"`
	ClusterIP  string            `json:"cluster_ip"`
	ExternalIP string            `json:"external_ip,omitempty"`
	Ports      string            `json:"ports"`
	Age        time.Time         `json:"age"`
	Labels     map[string]string `json:"labels,omitempty"`
}

func formatPorts(ports []corev1.ServicePort) string {
	if len(ports) == 0 {
		return ""
	}
	result := ""
	for i, p := range ports {
		if i > 0 {
			result += ","
		}
		result += fmt.Sprintf("%d/%s", p.Port, p.Protocol)
	}
	return result
}

// ListConfigMaps 列出 ConfigMaps
func (k *K8sClient) ListConfigMaps(ctx context.Context, namespace string) ([]ConfigMapInfo, error) {
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}
	cms, err := k.Clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]ConfigMapInfo, 0, len(cms.Items))
	for _, cm := range cms.Items {
		out = append(out, ConfigMapInfo{
			Name:      cm.Name,
			Namespace: cm.Namespace,
			DataCount: len(cm.Data),
			Age:       cm.CreationTimestamp.Time,
			Labels:    cm.Labels,
		})
	}
	return out, nil
}

type ConfigMapInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	DataCount int               `json:"data_count"`
	Age       time.Time         `json:"age"`
	Labels    map[string]string `json:"labels,omitempty"`
}

// ListSecrets 列出 Secrets
func (k *K8sClient) ListSecrets(ctx context.Context, namespace string) ([]SecretInfo, error) {
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}
	secrets, err := k.Clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]SecretInfo, 0, len(secrets.Items))
	for _, s := range secrets.Items {
		out = append(out, SecretInfo{
			Name:      s.Name,
			Namespace: s.Namespace,
			Type:      string(s.Type),
			DataCount: len(s.Data),
			Age:       s.CreationTimestamp.Time,
			Labels:    s.Labels,
		})
	}
	return out, nil
}

type SecretInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Type      string            `json:"type"`
	DataCount int               `json:"data_count"`
	Age       time.Time         `json:"age"`
	Labels    map[string]string `json:"labels,omitempty"`
}

// ExecInPod 在Pod容器中执行命令（非交互式，一次性执行返回结果）
func (k *K8sClient) ExecInPod(ctx context.Context, namespace, podName, containerName string, command []string) (stdout, stderr string, err error) {
	if k.RestCfg == nil {
		return "", "", fmt.Errorf("rest config not available")
	}

	req := k.Clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec")

	req.VersionedParams(&corev1.PodExecOptions{
		Container: containerName,
		Command:   command,
		Stdin:     false,
		Stdout:    true,
		Stderr:    true,
		TTY:       false,
	}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(k.RestCfg, "POST", req.URL())
	if err != nil {
		return "", "", fmt.Errorf("create executor: %w", err)
	}

	var stdoutBuf, stderrBuf bytes.Buffer
	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdout: &stdoutBuf,
		Stderr: &stderrBuf,
		Tty:    false,
	})
	return stdoutBuf.String(), stderrBuf.String(), err
}

// FileEntry 容器内文件/目录信息
type FileEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDir       bool   `json:"is_dir"`
	Size        int64  `json:"size,omitempty"`
	Permissions string `json:"permissions,omitempty"`
	ModTime     string `json:"mod_time,omitempty"`
}

// ListFilesInPod 列出容器指定路径下的文件
func (k *K8sClient) ListFilesInPod(ctx context.Context, namespace, podName, containerName, path string) ([]FileEntry, error) {
	if path == "" {
		path = "/"
	}
	// 使用ls -la格式输出
	stdout, stderr, err := k.ExecInPod(ctx, namespace, podName, containerName, []string{
		"sh", "-c", fmt.Sprintf("ls -la --time-style=long-iso %s 2>&1 || ls -la %s", shellEscape(path), shellEscape(path)),
	})
	if err != nil {
		if stderr != "" {
			return nil, fmt.Errorf("ls failed: %s", stderr)
		}
		return nil, err
	}
	return parseLsOutput(stdout, path), nil
}

// CatFileInPod 读取容器内文件内容（限制大小）
func (k *K8sClient) CatFileInPod(ctx context.Context, namespace, podName, containerName, path string, maxBytes int64) (string, error) {
	if maxBytes <= 0 {
		maxBytes = 1024 * 1024 // 默认1MB
	}
	stdout, stderr, err := k.ExecInPod(ctx, namespace, podName, containerName, []string{
		"sh", "-c", fmt.Sprintf("head -c %d %s", maxBytes, shellEscape(path)),
	})
	if err != nil {
		if stderr != "" {
			return "", fmt.Errorf("cat failed: %s", stderr)
		}
		return "", err
	}
	return stdout, nil
}

// TailFileInPod 读取文件末尾N行
func (k *K8sClient) TailFileInPod(ctx context.Context, namespace, podName, containerName, path string, lines int) (string, error) {
	if lines <= 0 {
		lines = 500
	}
	stdout, stderr, err := k.ExecInPod(ctx, namespace, podName, containerName, []string{
		"sh", "-c", fmt.Sprintf("tail -n %d %s", lines, shellEscape(path)),
	})
	if err != nil {
		if stderr != "" {
			return "", fmt.Errorf("tail failed: %s", stderr)
		}
		return "", err
	}
	return stdout, nil
}

// shellEscape 简单的shell参数转义
func shellEscape(s string) string {
	// 只允许安全字符，否则用单引号包裹
	safe := true
	for _, c := range s {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
			c == '/' || c == '.' || c == '-' || c == '_') {
			safe = false
			break
		}
	}
	if safe {
		return s
	}
	// 用单引号包裹，把内部的单引号替换成 '"'"'
	result := "'"
	for _, c := range s {
		if c == '\'' {
			result += `'"'"'`
		} else {
			result += string(c)
		}
	}
	result += "'"
	return result
}

// parseLsOutput 解析 ls -la 输出
func parseLsOutput(output, basePath string) []FileEntry {
	entries := []FileEntry{}
	lines := splitLines(output)
	for _, line := range lines {
		line = trimSpace(line)
		if line == "" || startsWithPrefix(line, "total ") {
			continue
		}
		// 格式: drwxr-xr-x 2 root root 4096 2024-01-01 12:00 name
		fields := splitFields(line, 8)
		if len(fields) < 8 {
			continue
		}
		perm := fields[0]
		size := parseInt64(fields[4])
		date := fields[5]
		timeStr := fields[6]
		name := fields[7]

		// 跳过 . 和 ..
		if name == "." || name == ".." {
			continue
		}
		// 处理符号链接 name -> target
		if idx := indexOf(name, " -> "); idx > 0 {
			name = name[:idx]
		}

		isDir := len(perm) > 0 && perm[0] == 'd'
		fullPath := basePath
		if !endsWithChar(fullPath, '/') {
			fullPath += "/"
		}
		fullPath += name

		entries = append(entries, FileEntry{
			Name:        name,
			Path:        fullPath,
			IsDir:       isDir,
			Size:        size,
			Permissions: perm,
			ModTime:     date + " " + timeStr,
		})
	}
	return entries
}

// 简单字符串工具
func splitLines(s string) []string {
	result := []string{}
	current := ""
	for _, c := range s {
		if c == '\n' {
			result = append(result, current)
			current = ""
		} else if c != '\r' {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func trimSpace(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}

func startsWithPrefix(s, prefix string) bool {
	if len(s) < len(prefix) {
		return false
	}
	return s[:len(prefix)] == prefix
}

func endsWithChar(s string, c byte) bool {
	return len(s) > 0 && s[len(s)-1] == c
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// splitFields 按空白切分，保留最后一列
func splitFields(s string, max int) []string {
	result := []string{}
	current := ""
	count := 0
	for i, c := range s {
		if c == ' ' || c == '\t' {
			if current != "" {
				count++
				if count == max {
					// 剩余部分作为最后一个字段
					rest := trimSpace(s[i:])
					if current != "" {
						result = append(result, current)
					}
					if rest != "" {
						result = append(result, rest)
					}
					return result
				}
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func parseInt64(s string) int64 {
	var n int64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int64(c-'0')
		} else {
			break
		}
	}
	return n
}

// ============ StatefulSet ============
type StatefulSetInfo struct {
	Name        string    `json:"name"`
	Namespace   string    `json:"namespace"`
	Replicas    int32     `json:"replicas"`
	Ready       int32     `json:"ready"`
	Age         time.Time `json:"age"`
	Image       string    `json:"image,omitempty"`
	ServiceName string    `json:"service_name,omitempty"`
}

func (k *K8sClient) ListStatefulSets(ctx context.Context, namespace string) ([]StatefulSetInfo, error) {
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}
	list, err := k.Clientset.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]StatefulSetInfo, 0, len(list.Items))
	for _, s := range list.Items {
		info := StatefulSetInfo{
			Name:        s.Name,
			Namespace:   s.Namespace,
			Ready:       s.Status.ReadyReplicas,
			Age:         s.CreationTimestamp.Time,
			ServiceName: s.Spec.ServiceName,
		}
		if s.Spec.Replicas != nil {
			info.Replicas = *s.Spec.Replicas
		}
		if len(s.Spec.Template.Spec.Containers) > 0 {
			info.Image = s.Spec.Template.Spec.Containers[0].Image
		}
		out = append(out, info)
	}
	return out, nil
}

func (k *K8sClient) GetStatefulSetYAML(ctx context.Context, namespace, name string) (map[string]any, error) {
	s, err := k.Clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"apiVersion": "apps/v1",
		"kind":       "StatefulSet",
		"metadata":   s.ObjectMeta,
		"spec":       s.Spec,
		"status":     s.Status,
	}, nil
}

// ============ DaemonSet ============
type DaemonSetInfo struct {
	Name           string    `json:"name"`
	Namespace      string    `json:"namespace"`
	Desired        int32     `json:"desired"`
	Current        int32     `json:"current"`
	Ready          int32     `json:"ready"`
	UpToDate       int32     `json:"up_to_date"`
	Available      int32     `json:"available"`
	Age            time.Time `json:"age"`
	Image          string    `json:"image,omitempty"`
}

func (k *K8sClient) ListDaemonSets(ctx context.Context, namespace string) ([]DaemonSetInfo, error) {
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}
	list, err := k.Clientset.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]DaemonSetInfo, 0, len(list.Items))
	for _, d := range list.Items {
		info := DaemonSetInfo{
			Name:      d.Name,
			Namespace: d.Namespace,
			Desired:   d.Status.DesiredNumberScheduled,
			Current:   d.Status.CurrentNumberScheduled,
			Ready:     d.Status.NumberReady,
			UpToDate:  d.Status.UpdatedNumberScheduled,
			Available: d.Status.NumberAvailable,
			Age:       d.CreationTimestamp.Time,
		}
		if len(d.Spec.Template.Spec.Containers) > 0 {
			info.Image = d.Spec.Template.Spec.Containers[0].Image
		}
		out = append(out, info)
	}
	return out, nil
}

func (k *K8sClient) GetDaemonSetYAML(ctx context.Context, namespace, name string) (map[string]any, error) {
	d, err := k.Clientset.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"apiVersion": "apps/v1",
		"kind":       "DaemonSet",
		"metadata":   d.ObjectMeta,
		"spec":       d.Spec,
		"status":     d.Status,
	}, nil
}

// ============ Ingress ============
type IngressInfo struct {
	Name      string    `json:"name"`
	Namespace string    `json:"namespace"`
	Class     string    `json:"class,omitempty"`
	Hosts     []string  `json:"hosts,omitempty"`
	Address   []string  `json:"address,omitempty"`
	Age       time.Time `json:"age"`
}

func (k *K8sClient) ListIngresses(ctx context.Context, namespace string) ([]IngressInfo, error) {
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}
	list, err := k.Clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]IngressInfo, 0, len(list.Items))
	for _, ing := range list.Items {
		hosts := []string{}
		for _, r := range ing.Spec.Rules {
			if r.Host != "" {
				hosts = append(hosts, r.Host)
			}
		}
		addrs := []string{}
		for _, l := range ing.Status.LoadBalancer.Ingress {
			if l.IP != "" {
				addrs = append(addrs, l.IP)
			}
			if l.Hostname != "" {
				addrs = append(addrs, l.Hostname)
			}
		}
		info := IngressInfo{
			Name:      ing.Name,
			Namespace: ing.Namespace,
			Hosts:     hosts,
			Address:   addrs,
			Age:       ing.CreationTimestamp.Time,
		}
		if ing.Spec.IngressClassName != nil {
			info.Class = *ing.Spec.IngressClassName
		}
		out = append(out, info)
	}
	return out, nil
}

// ============ 通用 YAML ============
func (k *K8sClient) GetDeploymentYAML(ctx context.Context, namespace, name string) (map[string]any, error) {
	d, err := k.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"apiVersion": "apps/v1",
		"kind":       "Deployment",
		"metadata":   d.ObjectMeta,
		"spec":       d.Spec,
		"status":     d.Status,
	}, nil
}

func (k *K8sClient) GetServiceYAML(ctx context.Context, namespace, name string) (map[string]any, error) {
	s, err := k.Clientset.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"apiVersion": "v1",
		"kind":       "Service",
		"metadata":   s.ObjectMeta,
		"spec":       s.Spec,
		"status":     s.Status,
	}, nil
}

func (k *K8sClient) GetConfigMapYAML(ctx context.Context, namespace, name string) (map[string]any, error) {
	cm, err := k.Clientset.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"apiVersion": "v1",
		"kind":       "ConfigMap",
		"metadata":   cm.ObjectMeta,
		"data":       cm.Data,
	}, nil
}

func (k *K8sClient) GetSecretYAML(ctx context.Context, namespace, name string) (map[string]any, error) {
	s, err := k.Clientset.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	// secret的data保持base64，避免泄露原文；用户想看可以自行decode
	return map[string]any{
		"apiVersion": "v1",
		"kind":       "Secret",
		"metadata":   s.ObjectMeta,
		"type":       s.Type,
		"data":       s.Data,
	}, nil
}

func (k *K8sClient) GetNodeYAML(ctx context.Context, name string) (map[string]any, error) {
	n, err := k.Clientset.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"apiVersion": "v1",
		"kind":       "Node",
		"metadata":   n.ObjectMeta,
		"spec":       n.Spec,
		"status":     n.Status,
	}, nil
}

// ============ 通用事件 ============
type ResourceEvent struct {
	Type      string    `json:"type"`
	Reason    string    `json:"reason"`
	Message   string    `json:"message"`
	Count     int32     `json:"count"`
	FirstAt   time.Time `json:"first_at"`
	LastAt    time.Time `json:"last_at"`
	Component string    `json:"component,omitempty"`
}

// ListResourceEvents 按对象名字/命名空间查事件
func (k *K8sClient) ListResourceEvents(ctx context.Context, namespace, name, kind string) ([]ResourceEvent, error) {
	fieldSelector := fmt.Sprintf("involvedObject.name=%s", name)
	if kind != "" {
		fieldSelector += ",involvedObject.kind=" + kind
	}
	list, err := k.Clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: fieldSelector,
	})
	if err != nil {
		return nil, err
	}
	out := make([]ResourceEvent, 0, len(list.Items))
	for _, e := range list.Items {
		out = append(out, ResourceEvent{
			Type:      e.Type,
			Reason:    e.Reason,
			Message:   e.Message,
			Count:     e.Count,
			FirstAt:   e.FirstTimestamp.Time,
			LastAt:    e.LastTimestamp.Time,
			Component: e.Source.Component,
		})
	}
	return out, nil
}

// WatchEvents 监听K8s事件流
func (k *K8sClient) WatchEvents(ctx context.Context, namespace, name, kind string) (watch.Interface, error) {
	opts := metav1.ListOptions{}
	
	// 构造FieldSelector
	var fieldSelectors []string
	if name != "" {
		fieldSelectors = append(fieldSelectors, "involvedObject.name="+name)
	}
	if kind != "" {
		fieldSelectors = append(fieldSelectors, "involvedObject.kind="+kind)
	}
	if len(fieldSelectors) > 0 {
		opts.FieldSelector = strings.Join(fieldSelectors, ",")
	}

	return k.Clientset.CoreV1().Events(namespace).Watch(ctx, opts)
}

// ListEvents 列举事件（给SSE初始推送用）
func (k *K8sClient) ListEvents(ctx context.Context, namespace, name, kind string) ([]ResourceEvent, error) {
	// 复用已有的ListResourceEvents
	return k.ListResourceEvents(ctx, namespace, name, kind)
}

// WatchResourceList 监听资源列表变化（Pods/Deployments等）
func (k *K8sClient) WatchResourceList(ctx context.Context, resourceType, namespace string) (watch.Interface, error) {
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	opts := metav1.ListOptions{}

	switch resourceType {
	case "pods":
		return k.Clientset.CoreV1().Pods(namespace).Watch(ctx, opts)
	case "deployments":
		return k.Clientset.AppsV1().Deployments(namespace).Watch(ctx, opts)
	case "services":
		return k.Clientset.CoreV1().Services(namespace).Watch(ctx, opts)
	case "configmaps":
		return k.Clientset.CoreV1().ConfigMaps(namespace).Watch(ctx, opts)
	case "secrets":
		return k.Clientset.CoreV1().Secrets(namespace).Watch(ctx, opts)
	case "statefulsets":
		return k.Clientset.AppsV1().StatefulSets(namespace).Watch(ctx, opts)
	case "daemonsets":
		return k.Clientset.AppsV1().DaemonSets(namespace).Watch(ctx, opts)
	case "ingresses":
		return k.Clientset.NetworkingV1().Ingresses(namespace).Watch(ctx, opts)
	case "nodes":
		return k.Clientset.CoreV1().Nodes().Watch(ctx, opts)
	default:
		return nil, fmt.Errorf("unsupported resource type: %s", resourceType)
	}
}
