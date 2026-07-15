package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"mobile-ops/internal/clients"
	"mobile-ops/internal/config"
	"mobile-ops/internal/models"
)

type ScaleService struct {
	db      *sqlx.DB
	cfg     config.PolicyConfig
	configSvc *ConfigService
}

func NewScaleService(db *sqlx.DB, cfg config.PolicyConfig, configSvc *ConfigService) *ScaleService {
	return &ScaleService{db: db, cfg: cfg, configSvc: configSvc}
}

type PrecheckResult struct {
	Passed             bool                   `json:"passed"`
	Items              []PrecheckItem         `json:"items"`
	CurrentSize        int64                  `json:"current_size"`
	TargetSize         int64                  `json:"target_size"`
	Delta              int64                  `json:"delta"`
	EstimatedMonthCost float64                `json:"estimated_month_cost_cny"`
	Warnings           []string               `json:"warnings,omitempty"`
	Meta               map[string]interface{} `json:"meta,omitempty"`
}

type PrecheckItem struct {
	Name    string `json:"name"`
	Status  string `json:"status"`  // pass/fail/skip
	Message string `json:"message"`
}

// Precheck 扩容前 5 项预检
// 1. 云厂商配额（TKE 节点池 max 限制）
// 2. 节点组当前状态（是否有 NotReady 节点）
// 3. 历史扩容记录（5 分钟内不重复）
// 4. 成本预估
// 5. 必须走节点池（不允许非节点池节点）
func (s *ScaleService) Precheck(ctx context.Context, clusterID, nodePoolID int64, delta int) (*PrecheckResult, error) {
	// 加载 cluster + node_pool
	var cluster models.Cluster
	if err := s.db.GetContext(ctx, &cluster,
		`SELECT * FROM clusters WHERE id=$1`, clusterID); err != nil {
		return nil, fmt.Errorf("cluster %d 不存在: %w", clusterID, err)
	}
	var np models.NodePool
	if err := s.db.GetContext(ctx, &np,
		`SELECT * FROM node_pools WHERE id=$1 AND cluster_id=$2`, nodePoolID, clusterID); err != nil {
		return nil, fmt.Errorf("node_pool %d 不存在: %w", nodePoolID, err)
	}

	currentSize := int64(0)
	if np.CurrentSize.Valid {
		currentSize = int64(np.CurrentSize.Int32)
	} else if np.DesiredSize.Valid {
		currentSize = int64(np.DesiredSize.Int32)
	}
	targetSize := currentSize + int64(delta)

	res := &PrecheckResult{
		CurrentSize: currentSize,
		TargetSize:  targetSize,
		Delta:       int64(delta),
		Items:       []PrecheckItem{},
	}

	// [1] 节点池必须存在 provider_pool_id（等价于"必须走节点池"）
	if np.ProviderPoolID == nil || *np.ProviderPoolID == "" {
		res.Items = append(res.Items, PrecheckItem{Name: "节点池归属", Status: "fail", Message: "此节点池未绑定云厂商节点池 ID，MVP 强制要求通过节点池扩容"})
	} else {
		res.Items = append(res.Items, PrecheckItem{Name: "节点池归属", Status: "pass", Message: fmt.Sprintf("绑定云厂商节点池 %s", *np.ProviderPoolID)})
	}

	// [2] 配额检查（不能超 max）
	if targetSize > int64(np.MaxSize) {
		res.Items = append(res.Items, PrecheckItem{Name: "云厂商配额", Status: "fail",
			Message: fmt.Sprintf("目标 %d 超过节点池 max %d", targetSize, np.MaxSize)})
	} else if targetSize < int64(np.MinSize) {
		res.Items = append(res.Items, PrecheckItem{Name: "云厂商配额", Status: "fail",
			Message: fmt.Sprintf("目标 %d 低于节点池 min %d", targetSize, np.MinSize)})
	} else {
		res.Items = append(res.Items, PrecheckItem{Name: "云厂商配额", Status: "pass",
			Message: fmt.Sprintf("目标 %d 在 [%d,%d] 区间内", targetSize, np.MinSize, np.MaxSize)})
	}

	// [3] 历史扩容记录（防抖）
	var recentCount int
	if err := s.db.GetContext(ctx, &recentCount,
		`SELECT COUNT(*) FROM operations
		 WHERE node_pool_id=$1
		 AND action IN ('scale_up','scale_down')
		 AND status IN ('success','executing','polling','pending')
		 AND started_at > NOW() - $2::interval`,
		nodePoolID,
		fmt.Sprintf("%d minutes", s.cfg.ScaleDebounceMinutes)); err == nil {
		if recentCount > 0 {
			res.Items = append(res.Items, PrecheckItem{Name: "扩容防抖", Status: "fail",
				Message: fmt.Sprintf("%d 分钟内有 %d 次扩缩容操作", s.cfg.ScaleDebounceMinutes, recentCount)})
		} else {
			res.Items = append(res.Items, PrecheckItem{Name: "扩容防抖", Status: "pass",
				Message: fmt.Sprintf("%d 分钟内无操作", s.cfg.ScaleDebounceMinutes)})
		}
	}

	// [4] 成本估算
	if np.CostPerHour != nil {
		monthCost := (*np.CostPerHour) * 24 * 30 * float64(delta)
		res.EstimatedMonthCost = monthCost
		res.Items = append(res.Items, PrecheckItem{Name: "成本预估", Status: "pass",
			Message: fmt.Sprintf("变化 ¥%.2f/月 (单价 ¥%.2f/h × %d 台)", monthCost, *np.CostPerHour, delta)})
	} else {
		res.Items = append(res.Items, PrecheckItem{Name: "成本预估", Status: "skip",
			Message: "节点池未设置单价，跳过"})
		res.Warnings = append(res.Warnings, "节点池未设置单价，建议在设置页补齐 cost_per_hour")
	}

	// [5] 节点状态检查（拉 K8s ready 节点数）
	if cluster.KubeconfigEncrypted != nil && len(cluster.KubeconfigEncrypted) > 0 {
		k8s, err := s.configSvc.GetK8sClient(ctx, cluster.ID)
		if err != nil {
			res.Items = append(res.Items, PrecheckItem{Name: "节点状态", Status: "skip",
				Message: fmt.Sprintf("K8s 连接失败: %v", err)})
		} else {
			nodes, err := k8s.ListNodes(ctx)
			if err != nil {
				res.Items = append(res.Items, PrecheckItem{Name: "节点状态", Status: "skip",
					Message: fmt.Sprintf("List nodes 失败: %v", err)})
			} else {
				notReady := 0
				for _, n := range nodes {
					if n.Ready != "True" {
						notReady++
					}
				}
				if notReady > 0 {
					res.Items = append(res.Items, PrecheckItem{Name: "节点状态", Status: "fail",
						Message: fmt.Sprintf("集群有 %d 个 NotReady 节点，先排查再扩容", notReady)})
				} else {
					res.Items = append(res.Items, PrecheckItem{Name: "节点状态", Status: "pass",
						Message: fmt.Sprintf("%d 个节点全部 Ready", len(nodes))})
				}
			}
		}
	} else {
		res.Items = append(res.Items, PrecheckItem{Name: "节点状态", Status: "skip",
			Message: "集群未配置 kubeconfig"})
	}

	// 综合
	allPass := true
	for _, i := range res.Items {
		if i.Status == "fail" {
			allPass = false
		}
	}
	res.Passed = allPass
	return res, nil
}

// SubmitScale 创建操作记录并异步执行扩缩容
func (s *ScaleService) SubmitScale(ctx context.Context, userID, clusterID, nodePoolID int64, delta int, triggerSource, alertRef string, precheck *PrecheckResult) (string, error) {
	if !precheck.Passed {
		return "", errors.New("预检未通过，禁止执行")
	}
	opID := uuid.New().String()
	pcJSON, _ := json.Marshal(precheck)
	targetSize := int(precheck.TargetSize)
	action := "scale_up"
	if delta < 0 {
		action = "scale_down"
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO operations(operation_id, user_id, cluster_id, node_pool_id, action, delta, target_size, status, precheck_result, trigger_source, alert_ref)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10)`,
		opID, userID, clusterID, nodePoolID, action, delta, targetSize, pcJSON, nullIfEmpty(triggerSource), nullIfEmpty(alertRef))
	if err != nil {
		return "", err
	}

	go s.executeAsync(context.Background(), opID)
	return opID, nil
}

func (s *ScaleService) executeAsync(ctx context.Context, opID string) {
	var op models.Operation
	if err := s.db.GetContext(ctx, &op,
		`SELECT * FROM operations WHERE operation_id=$1`, opID); err != nil {
		return
	}

	s.updateStatus(ctx, opID, "executing", nil)

	var cluster models.Cluster
	if err := s.db.GetContext(ctx, &cluster,
		`SELECT * FROM clusters WHERE id=$1`, *op.ClusterID); err != nil {
		s.finishFail(ctx, opID, err.Error())
		return
	}
	var np models.NodePool
	if err := s.db.GetContext(ctx, &np,
		`SELECT * FROM node_pools WHERE id=$1`, *op.NodePoolID); err != nil {
		s.finishFail(ctx, opID, err.Error())
		return
	}
	if cluster.CloudAccountID == nil {
		s.finishFail(ctx, opID, "cluster 未绑定 cloud_account")
		return
	}
	region := ""
	if cluster.Region != nil {
		region = *cluster.Region
	}
	tke, err := s.configSvc.GetTKEClientForRegion(ctx, *cluster.CloudAccountID, region)
	if err != nil {
		s.finishFail(ctx, opID, "获取 TKE client: "+err.Error())
		return
	}
	if np.ProviderPoolID == nil {
		s.finishFail(ctx, opID, "node_pool 无 provider_pool_id")
		return
	}
	providerClusterID := ""
	if cluster.ProviderClusterID != nil {
		providerClusterID = *cluster.ProviderClusterID
	}
	if err := tke.ScaleNodePool(ctx, providerClusterID, *np.ProviderPoolID, int64(*op.TargetSize)); err != nil {
		s.finishFail(ctx, opID, "调用 TKE ScaleNodePool: "+err.Error())
		return
	}

	// 状态轮询
	s.updateStatus(ctx, opID, "polling", nil)
	timeout := time.Duration(s.cfg.ReadyPollTimeoutMinutes) * time.Minute
	interval := time.Duration(s.cfg.ReadyPollIntervalSeconds) * time.Second
	deadline := time.Now().Add(timeout)
	targetSize := int64(*op.TargetSize)

	for time.Now().Before(deadline) {
		pools, err := tke.ListNodePools(ctx, providerClusterID)
		if err == nil {
			for _, p := range pools {
				if p.NodePoolID == *np.ProviderPoolID {
					if p.CurrentNodesNum == targetSize && p.DesiredNodesNum == targetSize {
						s.finishSuccess(ctx, opID)
						return
					}
					s.updateProgress(ctx, opID, p.CurrentNodesNum, targetSize)
				}
			}
		}
		time.Sleep(interval)
	}
	s.finishFail(ctx, opID, fmt.Sprintf("轮询超时，节点未在 %d 分钟内 Ready", s.cfg.ReadyPollTimeoutMinutes))
}

func (s *ScaleService) updateStatus(ctx context.Context, opID, status string, errMsg *string) {
	if errMsg != nil {
		s.db.ExecContext(ctx, `UPDATE operations SET status=$1, error_msg=$2 WHERE operation_id=$3`, status, *errMsg, opID)
	} else {
		s.db.ExecContext(ctx, `UPDATE operations SET status=$1 WHERE operation_id=$2`, status, opID)
	}
}

func (s *ScaleService) updateProgress(ctx context.Context, opID string, cur, target int64) {
	meta := map[string]interface{}{"current": cur, "target": target, "last_poll_at": time.Now()}
	mb, _ := json.Marshal(meta)
	s.db.ExecContext(ctx, `UPDATE operations SET metadata=$1 WHERE operation_id=$2`, mb, opID)
}

func (s *ScaleService) finishSuccess(ctx context.Context, opID string) {
	s.db.ExecContext(ctx,
		`UPDATE operations SET status='success', finished_at=NOW() WHERE operation_id=$1`, opID)
}

func (s *ScaleService) finishFail(ctx context.Context, opID, msg string) {
	s.db.ExecContext(ctx,
		`UPDATE operations SET status='failed', finished_at=NOW(), error_msg=$1 WHERE operation_id=$2`, msg, opID)
}

// GetOperation 拉操作状态
func (s *ScaleService) GetOperation(ctx context.Context, opID string) (*models.Operation, error) {
	var op models.Operation
	err := s.db.GetContext(ctx, &op,
		`SELECT * FROM operations WHERE operation_id=$1`, opID)
	if err != nil {
		return nil, err
	}
	return &op, nil
}

// ListOperations 分页拉审计日志
func (s *ScaleService) ListOperations(ctx context.Context, limit, offset int) ([]models.Operation, error) {
	var list []models.Operation
	err := s.db.SelectContext(ctx, &list,
		`SELECT * FROM operations ORDER BY started_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	return list, err
}

func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// RunPoller 服务重启后恢复：把 pending/executing/polling 状态的操作重新调度
// 生产建议：这里应该做去重锁，MVP 简化实现
func (s *ScaleService) RunPoller(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// 启动时立即扫一次
	s.resumeUnfinished(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.resumeUnfinished(ctx)
		}
	}
}

func (s *ScaleService) resumeUnfinished(ctx context.Context) {
	var ops []models.Operation
	err := s.db.SelectContext(ctx, &ops,
		`SELECT operation_id FROM operations
		 WHERE status IN ('pending','executing','polling')
		 AND started_at > NOW() - INTERVAL '1 hour'`)
	if err != nil {
		return
	}
	for _, op := range ops {
		go s.executeAsync(context.Background(), op.OperationID)
	}
}

// 未使用变量占位
var _ = clients.NodeInfo{}
