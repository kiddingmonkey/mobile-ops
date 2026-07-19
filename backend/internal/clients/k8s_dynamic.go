package clients

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/yaml"
)

// CRDInfo 描述一个 CRD 的关键元数据
type CRDInfo struct {
	Group      string `json:"group"`
	Version    string `json:"version"`
	Kind       string `json:"kind"`
	Plural     string `json:"plural"`
	Namespaced bool   `json:"namespaced"`
}

// ListCRDs 通过 discovery 拿到集群里所有 CustomResource 定义
func (k *K8sClient) ListCRDs(ctx context.Context) ([]CRDInfo, error) {
	_, apiResourceLists, err := k.Discovery.ServerGroupsAndResources()
	if err != nil && len(apiResourceLists) == 0 {
		return nil, err
	}

	// 内置组白名单：不当作 CRD 输出
	builtin := map[string]bool{
		"":                            true, // core
		"apps":                        true,
		"batch":                       true,
		"networking.k8s.io":           true,
		"policy":                      true,
		"rbac.authorization.k8s.io":   true,
		"storage.k8s.io":              true,
		"authentication.k8s.io":       true,
		"authorization.k8s.io":        true,
		"autoscaling":                 true,
		"admissionregistration.k8s.io": true,
		"apiextensions.k8s.io":        true,
		"apiregistration.k8s.io":      true,
		"coordination.k8s.io":         true,
		"discovery.k8s.io":            true,
		"events.k8s.io":               true,
		"flowcontrol.apiserver.k8s.io": true,
		"node.k8s.io":                 true,
		"scheduling.k8s.io":           true,
		"certificates.k8s.io":         true,
		"metrics.k8s.io":              true,
	}

	seen := map[string]bool{}
	out := []CRDInfo{}
	for _, list := range apiResourceLists {
		if list == nil {
			continue
		}
		gv, err := schema.ParseGroupVersion(list.GroupVersion)
		if err != nil {
			continue
		}
		if builtin[gv.Group] {
			continue
		}
		for _, res := range list.APIResources {
			// 跳过子资源（含 "/"）
			if strings.Contains(res.Name, "/") {
				continue
			}
			// 只保留支持 list 的
			hasList := false
			for _, v := range res.Verbs {
				if v == "list" {
					hasList = true
					break
				}
			}
			if !hasList {
				continue
			}
			key := gv.Group + "/" + gv.Version + "/" + res.Name
			if seen[key] {
				continue
			}
			seen[key] = true
			out = append(out, CRDInfo{
				Group:      gv.Group,
				Version:    gv.Version,
				Kind:       res.Kind,
				Plural:     res.Name,
				Namespaced: res.Namespaced,
			})
		}
	}
	return out, nil
}

// resolveGVR 用 discovery 校验 GVR 存在，同时返回是否 namespaced
func (k *K8sClient) resolveGVR(group, version, resource string) (schema.GroupVersionResource, bool, error) {
	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
	gv := gvr.GroupVersion().String()
	list, err := k.Discovery.ServerResourcesForGroupVersion(gv)
	if err != nil {
		return gvr, false, err
	}
	for _, r := range list.APIResources {
		if r.Name == resource {
			return gvr, r.Namespaced, nil
		}
	}
	return gvr, false, fmt.Errorf("resource %s not found in %s", resource, gv)
}

// ListDynamicResources 列举任意 GVR
func (k *K8sClient) ListDynamicResources(ctx context.Context, group, version, resource, namespace string) ([]map[string]any, error) {
	gvr, namespaced, err := k.resolveGVR(group, version, resource)
	if err != nil {
		return nil, err
	}
	var (
		list *unstructured.UnstructuredList
	)
	if namespaced {
		ns := namespace
		if ns == "" {
			ns = metav1.NamespaceAll
		}
		list, err = k.Dynamic.Resource(gvr).Namespace(ns).List(ctx, metav1.ListOptions{})
	} else {
		list, err = k.Dynamic.Resource(gvr).List(ctx, metav1.ListOptions{})
	}
	if err != nil {
		return nil, err
	}
	out := make([]map[string]any, 0, len(list.Items))
	for _, item := range list.Items {
		md := item.Object["metadata"].(map[string]any)
		age, _ := md["creationTimestamp"].(string)
		out = append(out, map[string]any{
			"name":      md["name"],
			"namespace": md["namespace"],
			"age":       age,
			"kind":      item.GetKind(),
		})
	}
	return out, nil
}

// GetDynamicYAML 拿任意 GVR 单个对象
func (k *K8sClient) GetDynamicYAML(ctx context.Context, group, version, resource, namespace, name string) (map[string]any, error) {
	gvr, namespaced, err := k.resolveGVR(group, version, resource)
	if err != nil {
		return nil, err
	}
	var obj *unstructured.Unstructured
	if namespaced {
		obj, err = k.Dynamic.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	} else {
		obj, err = k.Dynamic.Resource(gvr).Get(ctx, name, metav1.GetOptions{})
	}
	if err != nil {
		return nil, err
	}
	return obj.Object, nil
}

// ApplyYAML 用 dynamic client 更新任意资源；yamlContent 可以是 YAML 或 JSON
func (k *K8sClient) ApplyYAML(ctx context.Context, yamlContent string) error {
	// YAML → JSON → Unstructured
	jsonBytes, err := yaml.YAMLToJSON([]byte(yamlContent))
	if err != nil {
		return fmt.Errorf("parse yaml: %w", err)
	}
	var obj unstructured.Unstructured
	if err := json.Unmarshal(jsonBytes, &obj.Object); err != nil {
		return fmt.Errorf("unmarshal: %w", err)
	}

	apiVersion := obj.GetAPIVersion()
	kind := obj.GetKind()
	if apiVersion == "" || kind == "" {
		return fmt.Errorf("apiVersion and kind are required")
	}
	name := obj.GetName()
	if name == "" {
		return fmt.Errorf("metadata.name is required")
	}

	gvr, namespaced, err := k.resolveGVRForKind(apiVersion, kind)
	if err != nil {
		return err
	}

	// 清理 status 和 resourceVersion 冲突字段（可选）
	unstructured.RemoveNestedField(obj.Object, "status")

	if namespaced {
		ns := obj.GetNamespace()
		if ns == "" {
			return fmt.Errorf("metadata.namespace required for %s", kind)
		}
		_, err = k.Dynamic.Resource(gvr).Namespace(ns).Update(ctx, &obj, metav1.UpdateOptions{})
	} else {
		_, err = k.Dynamic.Resource(gvr).Update(ctx, &obj, metav1.UpdateOptions{})
	}
	return err
}

// ResolveKindToResource 通过 apiVersion+Kind 找 resource plural + namespaced
func (k *K8sClient) ResolveKindToResource(apiVersion, kind string) (group, version, resource string, namespaced bool, err error) {
	gvr, ns, err := k.resolveGVRForKind(apiVersion, kind)
	if err != nil {
		return "", "", "", false, err
	}
	return gvr.Group, gvr.Version, gvr.Resource, ns, nil
}

// resolveGVRForKind 把 apiVersion+Kind 映射到 GVR
func (k *K8sClient) resolveGVRForKind(apiVersion, kind string) (schema.GroupVersionResource, bool, error) {
	gv, err := schema.ParseGroupVersion(apiVersion)
	if err != nil {
		return schema.GroupVersionResource{}, false, err
	}
	list, err := k.Discovery.ServerResourcesForGroupVersion(apiVersion)
	if err != nil {
		return schema.GroupVersionResource{}, false, err
	}
	for _, r := range list.APIResources {
		if strings.Contains(r.Name, "/") {
			continue
		}
		if r.Kind == kind {
			return schema.GroupVersionResource{Group: gv.Group, Version: gv.Version, Resource: r.Name}, r.Namespaced, nil
		}
	}
	return schema.GroupVersionResource{}, false, fmt.Errorf("kind %s not found in %s", kind, apiVersion)
}

// DeleteResource 通用删除
func (k *K8sClient) DeleteResource(ctx context.Context, apiVersion, kind, namespace, name string) error {
	gvr, namespaced, err := k.resolveGVRForKind(apiVersion, kind)
	if err != nil {
		return err
	}
	if namespaced {
		return k.Dynamic.Resource(gvr).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	}
	return k.Dynamic.Resource(gvr).Delete(ctx, name, metav1.DeleteOptions{})
}

// RolloutRestart 通过 patch spec.template.metadata.annotations.kubectl.kubernetes.io/restartedAt 实现
// 支持 deployments / statefulsets / daemonsets
func (k *K8sClient) RolloutRestart(ctx context.Context, kind, namespace, name string) error {
	nowStr := time.Now().Format(time.RFC3339)
	patch := []byte(fmt.Sprintf(
		`{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"%s"}}}}}`,
		nowStr,
	))

	switch strings.ToLower(kind) {
	case "deployment", "deployments":
		_, err := k.Clientset.AppsV1().Deployments(namespace).Patch(ctx, name, types.StrategicMergePatchType, patch, metav1.PatchOptions{})
		return err
	case "statefulset", "statefulsets":
		_, err := k.Clientset.AppsV1().StatefulSets(namespace).Patch(ctx, name, types.StrategicMergePatchType, patch, metav1.PatchOptions{})
		return err
	case "daemonset", "daemonsets":
		_, err := k.Clientset.AppsV1().DaemonSets(namespace).Patch(ctx, name, types.StrategicMergePatchType, patch, metav1.PatchOptions{})
		return err
	default:
		return fmt.Errorf("rollout restart not supported for kind: %s", kind)
	}
}

// ScaleWorkload 修改 spec.replicas，支持 deployments / statefulsets
func (k *K8sClient) ScaleWorkload(ctx context.Context, kind, namespace, name string, replicas int32) error {
	patch := []byte(fmt.Sprintf(`{"spec":{"replicas":%d}}`, replicas))
	switch strings.ToLower(kind) {
	case "deployment", "deployments":
		_, err := k.Clientset.AppsV1().Deployments(namespace).Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
		return err
	case "statefulset", "statefulsets":
		_, err := k.Clientset.AppsV1().StatefulSets(namespace).Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
		return err
	default:
		return fmt.Errorf("scale not supported for kind: %s", kind)
	}
}

// GetWorkloadDetail 获取 workload 详情（包含 Pod spec）
func (k *K8sClient) GetWorkloadDetail(ctx context.Context, kind, namespace, name string) (map[string]interface{}, error) {
	switch strings.ToLower(kind) {
	case "deployment", "deployments":
		deploy, err := k.Clientset.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		data, _ := json.Marshal(deploy)
		var result map[string]interface{}
		json.Unmarshal(data, &result)
		return result, nil
	case "statefulset", "statefulsets":
		sts, err := k.Clientset.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		data, _ := json.Marshal(sts)
		var result map[string]interface{}
		json.Unmarshal(data, &result)
		return result, nil
	default:
		return nil, fmt.Errorf("unsupported kind: %s", kind)
	}
}

// GetNodeResources 获取节点资源信息
func (k *K8sClient) GetNodeResources(ctx context.Context) ([]map[string]interface{}, error) {
	nodes, err := k.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	for _, node := range nodes.Items {
		// 获取节点上的所有 Pods 来计算已分配资源
		pods, _ := k.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{
			FieldSelector: fmt.Sprintf("spec.nodeName=%s", node.Name),
		})

		allocatedCPU := int64(0)
		allocatedMemory := int64(0)
		for _, pod := range pods.Items {
			if pod.Status.Phase != "Running" && pod.Status.Phase != "Pending" {
				continue
			}
			for _, container := range pod.Spec.Containers {
				if cpu := container.Resources.Requests.Cpu(); cpu != nil {
					allocatedCPU += cpu.MilliValue()
				}
				if mem := container.Resources.Requests.Memory(); mem != nil {
					allocatedMemory += mem.Value()
				}
			}
		}

		nodeInfo := map[string]interface{}{
			"name":   node.Name,
			"labels": node.Labels,
			"capacity": map[string]interface{}{
				"cpu":    node.Status.Capacity.Cpu().MilliValue(),
				"memory": node.Status.Capacity.Memory().Value(),
			},
			"allocatable": map[string]interface{}{
				"cpu":    node.Status.Allocatable.Cpu().MilliValue(),
				"memory": node.Status.Allocatable.Memory().Value(),
			},
			"allocated": map[string]interface{}{
				"cpu":    allocatedCPU,
				"memory": allocatedMemory,
			},
			"taints":       node.Spec.Taints,
			"unschedulable": node.Spec.Unschedulable,
		}
		result = append(result, nodeInfo)
	}

	return result, nil
}

// TogglePause 暂停/恢复 Deployment（只对 Deployment 有效）
func (k *K8sClient) TogglePause(ctx context.Context, namespace, name string, paused bool) error {
	patch := []byte(fmt.Sprintf(`{"spec":{"paused":%v}}`, paused))
	_, err := k.Clientset.AppsV1().Deployments(namespace).Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}
