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
