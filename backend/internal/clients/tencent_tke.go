package clients

import (
	"context"
	"fmt"
	"time"

	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	tcerr "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/errors"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	tke "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/tke/v20180525"
)

// TencentTKEClient 腾讯云 TKE 集群客户端
type TencentTKEClient struct {
	client *tke.Client
	region string
}

func NewTencentTKEClient(secretID, secretKey, region string) (*TencentTKEClient, error) {
	credential := common.NewCredential(secretID, secretKey)
	cpf := profile.NewClientProfile()
	cpf.HttpProfile.Endpoint = "tke.tencentcloudapi.com"
	cpf.HttpProfile.ReqTimeout = 10

	c, err := tke.NewClient(credential, region, cpf)
	if err != nil {
		return nil, fmt.Errorf("tke client: %w", err)
	}
	return &TencentTKEClient{client: c, region: region}, nil
}

// ClusterListItem TKE 集群基本信息
type ClusterListItem struct {
	ClusterID   string `json:"cluster_id"`
	ClusterName string `json:"cluster_name"`
	ClusterType string `json:"cluster_type"`
	Version     string `json:"version"`
	NodeNum     uint64 `json:"node_num"`
	Region      string `json:"region"`
}

func (t *TencentTKEClient) ListClusters(ctx context.Context) ([]ClusterListItem, error) {
	req := tke.NewDescribeClustersRequest()
	limit := int64(100)
	req.Limit = &limit
	resp, err := t.client.DescribeClustersWithContext(ctx, req)
	if err != nil {
		if e, ok := err.(*tcerr.TencentCloudSDKError); ok {
			return nil, fmt.Errorf("tke [%s] %s", e.Code, e.Message)
		}
		return nil, err
	}
	out := make([]ClusterListItem, 0, len(resp.Response.Clusters))
	for _, c := range resp.Response.Clusters {
		item := ClusterListItem{Region: t.region}
		if c.ClusterId != nil {
			item.ClusterID = *c.ClusterId
		}
		if c.ClusterName != nil {
			item.ClusterName = *c.ClusterName
		}
		if c.ClusterType != nil {
			item.ClusterType = *c.ClusterType
		}
		if c.ClusterVersion != nil {
			item.Version = *c.ClusterVersion
		}
		if c.ClusterNodeNum != nil {
			item.NodeNum = *c.ClusterNodeNum
		}
		out = append(out, item)
	}
	return out, nil
}

// NodePoolInfo 节点池详情
type NodePoolInfo struct {
	NodePoolID    string    `json:"node_pool_id"`
	Name          string    `json:"name"`
	ClusterID     string    `json:"cluster_id"`
	LifeState     string    `json:"life_state"`
	MinNodesNum   int64     `json:"min_nodes_num"`
	MaxNodesNum   int64     `json:"max_nodes_num"`
	DesiredNodesNum int64   `json:"desired_nodes_num"`
	CurrentNodesNum int64   `json:"current_nodes_num"`
	AutoscalingGroupId string `json:"autoscaling_group_id"`
	InstanceType  string    `json:"instance_type"`
	CreatedAt     time.Time `json:"created_at"`
}

func (t *TencentTKEClient) ListNodePools(ctx context.Context, clusterID string) ([]NodePoolInfo, error) {
	req := tke.NewDescribeClusterNodePoolsRequest()
	req.ClusterId = common.StringPtr(clusterID)
	resp, err := t.client.DescribeClusterNodePoolsWithContext(ctx, req)
	if err != nil {
		if e, ok := err.(*tcerr.TencentCloudSDKError); ok {
			return nil, fmt.Errorf("tke [%s] %s", e.Code, e.Message)
		}
		return nil, err
	}
	out := make([]NodePoolInfo, 0, len(resp.Response.NodePoolSet))
	for _, np := range resp.Response.NodePoolSet {
		item := NodePoolInfo{ClusterID: clusterID}
		if np.NodePoolId != nil {
			item.NodePoolID = *np.NodePoolId
		}
		if np.Name != nil {
			item.Name = *np.Name
		}
		if np.LifeState != nil {
			item.LifeState = *np.LifeState
		}
		if np.MinNodesNum != nil {
			item.MinNodesNum = *np.MinNodesNum
		}
		if np.MaxNodesNum != nil {
			item.MaxNodesNum = *np.MaxNodesNum
		}
		if np.DesiredNodesNum != nil {
			item.DesiredNodesNum = *np.DesiredNodesNum
		}
		if np.NodeCountSummary != nil {
			if np.NodeCountSummary.AutoscalingAdded != nil && np.NodeCountSummary.AutoscalingAdded.Total != nil {
				item.CurrentNodesNum += *np.NodeCountSummary.AutoscalingAdded.Total
			}
			if np.NodeCountSummary.ManuallyAdded != nil && np.NodeCountSummary.ManuallyAdded.Total != nil {
				item.CurrentNodesNum += *np.NodeCountSummary.ManuallyAdded.Total
			}
		}
		if np.AutoscalingGroupId != nil {
			item.AutoscalingGroupId = *np.AutoscalingGroupId
		}
		out = append(out, item)
	}
	return out, nil
}

// ScaleNodePool 修改节点池期望节点数
// desiredNum 是目标绝对值（不是 delta），符合腾讯云 API 语义
// 使用 ModifyNodePoolDesiredCapacityAboutAsg 修改伸缩组期望容量
func (t *TencentTKEClient) ScaleNodePool(ctx context.Context, clusterID, nodePoolID string, desiredNum int64) error {
	req := tke.NewModifyNodePoolDesiredCapacityAboutAsgRequest()
	req.ClusterId = common.StringPtr(clusterID)
	req.NodePoolId = common.StringPtr(nodePoolID)
	req.DesiredCapacity = common.Int64Ptr(desiredNum)
	_, err := t.client.ModifyNodePoolDesiredCapacityAboutAsgWithContext(ctx, req)
	if err != nil {
		if e, ok := err.(*tcerr.TencentCloudSDKError); ok {
			return fmt.Errorf("tke scale [%s] %s", e.Code, e.Message)
		}
		return err
	}
	return nil
}

// GetKubeconfig 从 TKE 拉集群 kubeconfig（外网/内网入口二选一）
func (t *TencentTKEClient) GetKubeconfig(ctx context.Context, clusterID string, isExtranet bool) (string, error) {
	req := tke.NewDescribeClusterKubeconfigRequest()
	req.ClusterId = common.StringPtr(clusterID)
	req.IsExtranet = common.BoolPtr(isExtranet)
	resp, err := t.client.DescribeClusterKubeconfigWithContext(ctx, req)
	if err != nil {
		if e, ok := err.(*tcerr.TencentCloudSDKError); ok {
			return "", fmt.Errorf("tke [%s] %s", e.Code, e.Message)
		}
		return "", err
	}
	if resp.Response.Kubeconfig == nil {
		return "", fmt.Errorf("empty kubeconfig")
	}
	return *resp.Response.Kubeconfig, nil
}
