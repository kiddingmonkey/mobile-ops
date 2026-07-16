package clients

import (
	"context"
	"fmt"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	metricsclient "k8s.io/metrics/pkg/client/clientset/versioned"
)

// K8sClient 单集群 K8s 客户端
type K8sClient struct {
	Clientset *kubernetes.Clientset
	Metrics   *metricsclient.Clientset
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
	return &K8sClient{Clientset: cs, Metrics: ms, Name: name}, nil
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
		out = append(out, PodInfo{
			Name:      p.Name,
			Namespace: p.Namespace,
			Status:    string(p.Status.Phase),
			Ready:     fmt.Sprintf("%d/%d", ready, total),
			Restarts:  sumRestarts(p.Status.ContainerStatuses),
			Age:       p.CreationTimestamp.Time,
			Node:      p.Spec.NodeName,
			Labels:    p.Labels,
		})
	}
	return out, nil
}

type PodInfo struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Status    string            `json:"status"`
	Ready     string            `json:"ready"`
	Restarts  int32             `json:"restarts"`
	Age       time.Time         `json:"age"`
	Node      string            `json:"node,omitempty"`
	Labels    map[string]string `json:"labels,omitempty"`
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
}

type PodCondition struct {
	Type   string `json:"type"`
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
	LastTransitionAt *time.Time `json:"last_transition_at,omitempty"`
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
	return d, nil
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
