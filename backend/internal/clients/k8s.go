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
