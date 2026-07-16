package services

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"

	"mobile-ops/internal/clients"
	"mobile-ops/internal/models"
	"mobile-ops/internal/utils"
)

// ConfigService 管理 Grafana / Prometheus / 云账号 / 集群 的用户配置
type ConfigService struct {
	db     *sqlx.DB
	cipher *utils.Cipher
	k8sPool *clients.K8sClientPool
}

func NewConfigService(db *sqlx.DB, cipher *utils.Cipher, pool *clients.K8sClientPool) *ConfigService {
	return &ConfigService{db: db, cipher: cipher, k8sPool: pool}
}

// ============ Grafana Sources ============

func (s *ConfigService) ListGrafanaSources(ctx context.Context) ([]models.GrafanaSource, error) {
	var list []models.GrafanaSource
	err := s.db.SelectContext(ctx, &list,
		`SELECT id, name, url, token_encrypted, is_default, created_by, created_at FROM grafana_sources ORDER BY id DESC`)
	return list, err
}

func (s *ConfigService) CreateGrafanaSource(ctx context.Context, userID int64, name, url, token string, isDefault bool) (*models.GrafanaSource, error) {
	if name == "" || url == "" || token == "" {
		return nil, errors.New("name/url/token required")
	}
	enc, err := s.cipher.Encrypt(token)
	if err != nil {
		return nil, err
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if isDefault {
		if _, err := tx.ExecContext(ctx, `UPDATE grafana_sources SET is_default=FALSE`); err != nil {
			return nil, err
		}
	}
	var out models.GrafanaSource
	err = tx.QueryRowxContext(ctx,
		`INSERT INTO grafana_sources(name, url, token_encrypted, is_default, created_by)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id, name, url, token_encrypted, is_default, created_by, created_at`,
		name, url, enc, isDefault, userID).StructScan(&out)
	if err != nil {
		return nil, err
	}
	return &out, tx.Commit()
}

func (s *ConfigService) DeleteGrafanaSource(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM grafana_sources WHERE id=$1`, id)
	return err
}

func (s *ConfigService) GetGrafanaClient(ctx context.Context, id int64) (*clients.GrafanaClient, error) {
	var g models.GrafanaSource
	err := s.db.GetContext(ctx, &g,
		`SELECT id, name, url, token_encrypted, is_default, created_by, created_at
		 FROM grafana_sources WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	tok, err := s.cipher.Decrypt(g.TokenEncrypted)
	if err != nil {
		return nil, fmt.Errorf("decrypt token: %w", err)
	}
	return clients.NewGrafanaClient(g.URL, tok), nil
}

// ============ Prometheus Sources ============

func (s *ConfigService) ListPromSources(ctx context.Context) ([]models.PrometheusSource, error) {
	var list []models.PrometheusSource
	err := s.db.SelectContext(ctx, &list,
		`SELECT id, name, url, auth_type, auth_encrypted, is_default, created_by, created_at
		 FROM prometheus_sources ORDER BY id DESC`)
	return list, err
}

func (s *ConfigService) CreatePromSource(ctx context.Context, userID int64, name, url, authType, auth string, isDefault bool) (*models.PrometheusSource, error) {
	if name == "" || url == "" {
		return nil, errors.New("name/url required")
	}
	var enc []byte
	if auth != "" {
		e, err := s.cipher.Encrypt(auth)
		if err != nil {
			return nil, err
		}
		enc = e
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if isDefault {
		if _, err := tx.ExecContext(ctx, `UPDATE prometheus_sources SET is_default=FALSE`); err != nil {
			return nil, err
		}
	}
	var out models.PrometheusSource
	err = tx.QueryRowxContext(ctx,
		`INSERT INTO prometheus_sources(name, url, auth_type, auth_encrypted, is_default, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, name, url, auth_type, auth_encrypted, is_default, created_by, created_at`,
		name, url, authType, enc, isDefault, userID).StructScan(&out)
	if err != nil {
		return nil, err
	}
	return &out, tx.Commit()
}

func (s *ConfigService) GetPromClient(ctx context.Context, id int64) (*clients.PromClient, error) {
	var p models.PrometheusSource
	err := s.db.GetContext(ctx, &p,
		`SELECT id, name, url, auth_type, auth_encrypted, is_default, created_by, created_at
		 FROM prometheus_sources WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	auth := ""
	if len(p.AuthEncrypted) > 0 {
		auth, err = s.cipher.Decrypt(p.AuthEncrypted)
		if err != nil {
			return nil, err
		}
	}
	return clients.NewPromClient(p.URL, p.AuthType, auth), nil
}

// ============ Cloud Accounts ============

func (s *ConfigService) ListCloudAccounts(ctx context.Context) ([]models.CloudAccount, error) {
	var list []models.CloudAccount
	err := s.db.SelectContext(ctx, &list,
		`SELECT id, name, provider, region, secret_id_encrypted, secret_key_encrypted, created_by, created_at
		 FROM cloud_accounts ORDER BY id DESC`)
	return list, err
}

func (s *ConfigService) CreateCloudAccount(ctx context.Context, userID int64, name, provider, region, secretID, secretKey string) (*models.CloudAccount, error) {
	if provider != "tencent" {
		return nil, errors.New("MVP 阶段仅支持 tencent")
	}
	sidEnc, err := s.cipher.Encrypt(secretID)
	if err != nil {
		return nil, err
	}
	skEnc, err := s.cipher.Encrypt(secretKey)
	if err != nil {
		return nil, err
	}
	var out models.CloudAccount
	err = s.db.QueryRowxContext(ctx,
		`INSERT INTO cloud_accounts(name, provider, region, secret_id_encrypted, secret_key_encrypted, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, name, provider, region, secret_id_encrypted, secret_key_encrypted, created_by, created_at`,
		name, provider, region, sidEnc, skEnc, userID).StructScan(&out)
	return &out, err
}

func (s *ConfigService) GetTKEClient(ctx context.Context, cloudAccountID int64) (*clients.TencentTKEClient, error) {
	return s.GetTKEClientForRegion(ctx, cloudAccountID, "")
}

// GetTKEClientForRegion 允许指定 region 覆盖云账号默认 region
// 同一个 AK/SK 可以访问不同 region 的 TKE，region 只影响 SDK 的 endpoint 路由
func (s *ConfigService) GetTKEClientForRegion(ctx context.Context, cloudAccountID int64, region string) (*clients.TencentTKEClient, error) {
	var acc models.CloudAccount
	err := s.db.GetContext(ctx, &acc,
		`SELECT id, name, provider, region, secret_id_encrypted, secret_key_encrypted, created_by, created_at
		 FROM cloud_accounts WHERE id=$1`, cloudAccountID)
	if err != nil {
		return nil, err
	}
	sid, err := s.cipher.Decrypt(acc.SecretIDEncrypted)
	if err != nil {
		return nil, err
	}
	sk, err := s.cipher.Decrypt(acc.SecretKeyEncrypted)
	if err != nil {
		return nil, err
	}
	useRegion := region
	if useRegion == "" {
		useRegion = acc.Region
	}
	return clients.NewTencentTKEClient(sid, sk, useRegion)
}

// GetVPCClientForRegion 拿腾讯云 VPC 客户端 (安全组用)
func (s *ConfigService) GetVPCClientForRegion(ctx context.Context, cloudAccountID int64, region string) (*clients.TencentVPCClient, error) {
	var acc models.CloudAccount
	err := s.db.GetContext(ctx, &acc,
		`SELECT id, name, provider, region, secret_id_encrypted, secret_key_encrypted, created_by, created_at
		 FROM cloud_accounts WHERE id=$1`, cloudAccountID)
	if err != nil {
		return nil, err
	}
	sid, err := s.cipher.Decrypt(acc.SecretIDEncrypted)
	if err != nil {
		return nil, err
	}
	sk, err := s.cipher.Decrypt(acc.SecretKeyEncrypted)
	if err != nil {
		return nil, err
	}
	useRegion := region
	if useRegion == "" {
		useRegion = acc.Region
	}
	return clients.NewTencentVPCClient(sid, sk, useRegion)
}

// ============ Clusters ============

func (s *ConfigService) ListClusters(ctx context.Context) ([]models.Cluster, error) {
	var list []models.Cluster
	err := s.db.SelectContext(ctx, &list,
		`SELECT id, name, display_name, provider, provider_cluster_id, region, cloud_account_id,
		 kubeconfig_encrypted, grafana_source_id, grafana_cluster_var, prom_source_id, status,
		 created_by, created_at, updated_at
		 FROM clusters WHERE status='active' ORDER BY id DESC`)
	return list, err
}

type CreateClusterInput struct {
	Name              string
	DisplayName       string
	Provider          string   // tencent
	ProviderClusterID string   // cls-xxx
	Region            string
	CloudAccountID    *int64
	Kubeconfig        string   // 用户可以手动填 kubeconfig，或让后端调 TKE 拉
	GrafanaSourceID   *int64
	GrafanaClusterVar string
	PromSourceID      *int64
	AutoPullKubeconfig bool    // 从 TKE 拉 kubeconfig
	IsExtranet        bool     // 拉 kubeconfig 时选内外网
	UserID            int64
}

func (s *ConfigService) CreateCluster(ctx context.Context, in CreateClusterInput) (*models.Cluster, error) {
	if in.Name == "" {
		return nil, errors.New("name required")
	}
	kubeconfig := in.Kubeconfig
	if in.AutoPullKubeconfig {
		if in.CloudAccountID == nil {
			return nil, errors.New("auto-pull kubeconfig 需要 cloud_account_id")
		}
		if in.ProviderClusterID == "" {
			return nil, errors.New("auto-pull kubeconfig 需要 provider_cluster_id")
		}
		// 优先用集群表单里填的 region，否则回落到云账号默认 region
		tke, err := s.GetTKEClientForRegion(ctx, *in.CloudAccountID, in.Region)
		if err != nil {
			return nil, err
		}
		kc, err := tke.GetKubeconfig(ctx, in.ProviderClusterID, in.IsExtranet)
		if err != nil {
			return nil, fmt.Errorf("pull kubeconfig: %w", err)
		}
		kubeconfig = kc
	}
	if kubeconfig == "" {
		return nil, errors.New("kubeconfig 未提供且未开启 auto-pull")
	}
	// 校验 kubeconfig 是否有效
	testClient, err := clients.NewK8sClient(in.Name, kubeconfig)
	if err != nil {
		return nil, fmt.Errorf("kubeconfig 无效: %w", err)
	}
	if err := testClient.Ping(ctx); err != nil {
		return nil, fmt.Errorf("集群连通失败: %w", err)
	}

	kcEnc, err := s.cipher.Encrypt(kubeconfig)
	if err != nil {
		return nil, err
	}
	var out models.Cluster
	err = s.db.QueryRowxContext(ctx,
		`INSERT INTO clusters(name, display_name, provider, provider_cluster_id, region,
			cloud_account_id, kubeconfig_encrypted, grafana_source_id, grafana_cluster_var,
			prom_source_id, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 RETURNING id, name, display_name, provider, provider_cluster_id, region, cloud_account_id,
			kubeconfig_encrypted, grafana_source_id, grafana_cluster_var, prom_source_id, status,
			created_by, created_at, updated_at`,
		in.Name, nullableString(in.DisplayName), in.Provider,
		nullableString(in.ProviderClusterID), nullableString(in.Region),
		in.CloudAccountID, kcEnc, in.GrafanaSourceID,
		nullableString(in.GrafanaClusterVar), in.PromSourceID, in.UserID).StructScan(&out)
	if err != nil {
		return nil, err
	}
	// 缓存 client
	s.k8sPool.Set(out.ID, testClient)
	return &out, nil
}

func (s *ConfigService) GetK8sClient(ctx context.Context, clusterID int64) (*clients.K8sClient, error) {
	if c, ok := s.k8sPool.Get(clusterID); ok {
		return c, nil
	}
	var cl models.Cluster
	err := s.db.GetContext(ctx, &cl,
		`SELECT id, name, display_name, provider, provider_cluster_id, region, cloud_account_id,
		 kubeconfig_encrypted, grafana_source_id, grafana_cluster_var, prom_source_id, status,
		 created_by, created_at, updated_at FROM clusters WHERE id=$1`, clusterID)
	if err != nil {
		return nil, err
	}
	if len(cl.KubeconfigEncrypted) == 0 {
		return nil, errors.New("cluster 未配置 kubeconfig")
	}
	kc, err := s.cipher.Decrypt(cl.KubeconfigEncrypted)
	if err != nil {
		return nil, err
	}
	k8s, err := clients.NewK8sClient(cl.Name, kc)
	if err != nil {
		return nil, err
	}
	s.k8sPool.Set(clusterID, k8s)
	return k8s, nil
}

func (s *ConfigService) DeleteCluster(ctx context.Context, id int64) error {
	if _, err := s.db.ExecContext(ctx,
		`UPDATE clusters SET status='deleted', updated_at=NOW() WHERE id=$1`, id); err != nil {
		return err
	}
	s.k8sPool.Remove(id)
	return nil
}

// GetCluster 拉集群完整信息（含解密后的部分字段用于 UI 展示）
type ClusterView struct {
	models.Cluster
	HasKubeconfig bool `json:"has_kubeconfig"`
}

func (s *ConfigService) GetCluster(ctx context.Context, id int64) (*ClusterView, error) {
	var cl models.Cluster
	err := s.db.GetContext(ctx, &cl,
		`SELECT id, name, display_name, provider, provider_cluster_id, region, cloud_account_id,
		 kubeconfig_encrypted, grafana_source_id, grafana_cluster_var, prom_source_id, status,
		 created_by, created_at, updated_at
		 FROM clusters WHERE id=$1 AND status='active'`, id)
	if err != nil {
		return nil, err
	}
	return &ClusterView{
		Cluster:       cl,
		HasKubeconfig: len(cl.KubeconfigEncrypted) > 0,
	}, nil
}

// UpdateClusterInput 只更新非 nil 的字段（partial update）
type UpdateClusterInput struct {
	DisplayName       *string
	Region            *string
	ProviderClusterID *string
	CloudAccountID    *int64
	Kubeconfig        *string // 非空且非零长度时更新
	GrafanaSourceID   *int64
	GrafanaClusterVar *string
	PromSourceID      *int64
}

func (s *ConfigService) UpdateCluster(ctx context.Context, id int64, in UpdateClusterInput) (*models.Cluster, error) {
	// 先取原记录
	var cur models.Cluster
	if err := s.db.GetContext(ctx, &cur,
		`SELECT id, name, kubeconfig_encrypted FROM clusters WHERE id=$1 AND status='active'`, id); err != nil {
		return nil, err
	}

	// kubeconfig 处理：如果新的传了非空值，重新加密 + 校验；否则保持原样
	kcEnc := cur.KubeconfigEncrypted
	if in.Kubeconfig != nil && *in.Kubeconfig != "" {
		// 校验 kubeconfig 有效
		testClient, err := clients.NewK8sClient(cur.Name, *in.Kubeconfig)
		if err != nil {
			return nil, fmt.Errorf("kubeconfig 无效: %w", err)
		}
		// 只校验解析，不强制 Ping（DNS 问题下 Ping 会失败但配置本身可能对）
		_ = testClient
		enc, err := s.cipher.Encrypt(*in.Kubeconfig)
		if err != nil {
			return nil, err
		}
		kcEnc = enc
		// 清掉旧 client cache，让下次连接用新的
		s.k8sPool.Remove(id)
	}

	// 用 COALESCE 只更新给定字段
	_, err := s.db.ExecContext(ctx,
		`UPDATE clusters SET
		   display_name       = COALESCE($1, display_name),
		   region             = COALESCE($2, region),
		   provider_cluster_id= COALESCE($3, provider_cluster_id),
		   cloud_account_id   = COALESCE($4, cloud_account_id),
		   kubeconfig_encrypted = $5,
		   grafana_source_id  = COALESCE($6, grafana_source_id),
		   grafana_cluster_var= COALESCE($7, grafana_cluster_var),
		   prom_source_id     = COALESCE($8, prom_source_id),
		   updated_at         = NOW()
		 WHERE id=$9`,
		in.DisplayName, in.Region, in.ProviderClusterID, in.CloudAccountID,
		kcEnc, in.GrafanaSourceID, in.GrafanaClusterVar, in.PromSourceID, id)
	if err != nil {
		return nil, err
	}

	var out models.Cluster
	err = s.db.GetContext(ctx, &out,
		`SELECT id, name, display_name, provider, provider_cluster_id, region, cloud_account_id,
		 kubeconfig_encrypted, grafana_source_id, grafana_cluster_var, prom_source_id, status,
		 created_by, created_at, updated_at
		 FROM clusters WHERE id=$1`, id)
	return &out, err
}

// DeleteClusterHard 真删（级联删 node_pools）
func (s *ConfigService) DeleteClusterHard(ctx context.Context, id int64) error {
	// node_pools 有 FK ON DELETE CASCADE，自动清理
	if _, err := s.db.ExecContext(ctx, `DELETE FROM clusters WHERE id=$1`, id); err != nil {
		return err
	}
	s.k8sPool.Remove(id)
	return nil
}

// FetchGrafanaPanel 通过集群关联的 Grafana 数据源代理拉面板 PNG
// 自动带上集群的 cluster 变量（对齐 dashboard 里的模板变量）
func (s *ConfigService) FetchGrafanaPanel(ctx context.Context, clusterID int64, dashUID string, panelID, width, height int, from, to, theme string) ([]byte, string, error) {
	var cl models.Cluster
	if err := s.db.GetContext(ctx, &cl,
		`SELECT id, name, grafana_source_id, grafana_cluster_var FROM clusters WHERE id=$1`, clusterID); err != nil {
		return nil, "", fmt.Errorf("cluster 不存在: %w", err)
	}
	if cl.GrafanaSourceID == nil {
		return nil, "", fmt.Errorf("集群未关联 Grafana 数据源")
	}
	g, err := s.GetGrafanaClient(ctx, *cl.GrafanaSourceID)
	if err != nil {
		return nil, "", err
	}
	// 集群的 cluster 变量作为 var-cluster
	vars := map[string]string{}
	if cl.GrafanaClusterVar != nil && *cl.GrafanaClusterVar != "" {
		vars["cluster"] = *cl.GrafanaClusterVar
	}
	return g.FetchPanelPNG(ctx, dashUID, panelID, width, height, from, to, theme, vars)
}

// GrafanaDashboardRef Grafana 面板/dashboard 的引用
type GrafanaDashboardRef struct {
	UID      string `json:"uid"`
	Title    string `json:"title"`
	PanelID  int    `json:"panel_id,omitempty"`
	Category string `json:"category,omitempty"` // overview / detail
}

// ListGrafanaDashboardsForCluster 列出该集群关联 Grafana 的常用 dashboard
// MVP 简化：返回一个内置面板列表 + 该 Grafana 的收藏（starred）dashboard
func (s *ConfigService) ListGrafanaDashboardsForCluster(ctx context.Context, clusterID int64) ([]GrafanaDashboardRef, error) {
	var cl models.Cluster
	if err := s.db.GetContext(ctx, &cl,
		`SELECT id, grafana_source_id FROM clusters WHERE id=$1`, clusterID); err != nil {
		return nil, err
	}
	if cl.GrafanaSourceID == nil {
		return []GrafanaDashboardRef{}, nil
	}
	// TODO V2: 拉 Grafana starred dashboards 列表
	// MVP: 返回一个空列表，前端用手工输入 dash uid + panel id 的方式
	return []GrafanaDashboardRef{}, nil
}

func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// SyncNodePools 从腾讯云 TKE 拉节点池 upsert 到 DB
func (s *ConfigService) SyncNodePools(ctx context.Context, clusterID int64) error {
	var cl models.Cluster
	if err := s.db.GetContext(ctx, &cl,
		`SELECT id, name, provider, provider_cluster_id, cloud_account_id, region
		 FROM clusters WHERE id=$1`, clusterID); err != nil {
		return err
	}
	if cl.CloudAccountID == nil || cl.ProviderClusterID == nil || *cl.ProviderClusterID == "" {
		return errors.New("集群未绑定云账号或 provider_cluster_id 为空，无法同步节点池")
	}
	region := ""
	if cl.Region != nil {
		region = *cl.Region
	}
	tke, err := s.GetTKEClientForRegion(ctx, *cl.CloudAccountID, region)
	if err != nil {
		return err
	}
	pools, err := tke.ListNodePools(ctx, *cl.ProviderClusterID)
	if err != nil {
		return err
	}
	for _, p := range pools {
		_, err := s.db.ExecContext(ctx,
			`INSERT INTO node_pools (cluster_id, name, provider_pool_id, min_size, max_size,
			 desired_size, current_size, last_synced_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
			 ON CONFLICT (cluster_id, name) DO UPDATE SET
			   provider_pool_id = EXCLUDED.provider_pool_id,
			   min_size = EXCLUDED.min_size,
			   max_size = EXCLUDED.max_size,
			   desired_size = EXCLUDED.desired_size,
			   current_size = EXCLUDED.current_size,
			   last_synced_at = NOW()`,
			clusterID, p.Name, p.NodePoolID, p.MinNodesNum, p.MaxNodesNum,
			p.DesiredNodesNum, p.CurrentNodesNum)
		if err != nil {
			return fmt.Errorf("upsert node_pool %s: %w", p.Name, err)
		}
	}
	return nil
}

// ClusterOverview 集群总览：节点数、Ready 数、Pod 数、CPU/内存汇总
type ClusterOverviewResult struct {
	ClusterID     int64                    `json:"cluster_id"`
	ClusterName   string                   `json:"cluster_name"`
	TotalNodes    int                      `json:"total_nodes"`
	ReadyNodes    int                      `json:"ready_nodes"`
	NotReadyNodes int                      `json:"not_ready_nodes"`
	NodePools     []NodePoolOverview       `json:"node_pools"`
	FetchedAt     time.Time                `json:"fetched_at"`
	Warnings      []string                 `json:"warnings,omitempty"`
	NodesSource   string                   `json:"nodes_source"`      // kubectl / prometheus / none
	CrossValidate *NodeCrossValidate       `json:"cross_validate,omitempty"`
}

type NodeCrossValidate struct {
	KubectlTotal *int `json:"kubectl_total,omitempty"`
	KubectlReady *int `json:"kubectl_ready,omitempty"`
	PromTotal    *int `json:"prom_total,omitempty"`
	PromReady    *int `json:"prom_ready,omitempty"`
	Consistent   bool `json:"consistent"`
}

type NodePoolOverview struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	CurrentSize int64  `json:"current_size"`
	DesiredSize int64  `json:"desired_size"`
	MinSize     int    `json:"min_size"`
	MaxSize     int    `json:"max_size"`
}

func (s *ConfigService) ClusterOverview(ctx context.Context, clusterID int64) (*ClusterOverviewResult, error) {
	var cl models.Cluster
	if err := s.db.GetContext(ctx, &cl,
		`SELECT id, name, grafana_cluster_var, prom_source_id FROM clusters WHERE id=$1`, clusterID); err != nil {
		return nil, err
	}
	out := &ClusterOverviewResult{
		ClusterID:   cl.ID,
		ClusterName: cl.Name,
		FetchedAt:   time.Now(),
		NodesSource: "none",
		CrossValidate: &NodeCrossValidate{Consistent: true},
	}

	// 尝试从 kubectl 拿节点
	kubectlOK := false
	k8s, err := s.GetK8sClient(ctx, clusterID)
	if err != nil {
		out.Warnings = append(out.Warnings, fmt.Sprintf("K8s 连接失败: %v", err))
	} else {
		nodes, err := k8s.ListNodes(ctx)
		if err != nil {
			out.Warnings = append(out.Warnings, fmt.Sprintf("List nodes 失败: %v", err))
		} else {
			total := len(nodes)
			ready := 0
			for _, n := range nodes {
				if n.Ready == "True" {
					ready++
				}
			}
			out.TotalNodes = total
			out.ReadyNodes = ready
			out.NotReadyNodes = total - ready
			out.NodesSource = "kubectl"
			out.CrossValidate.KubectlTotal = &total
			out.CrossValidate.KubectlReady = &ready
			kubectlOK = true
		}
	}

	// Prometheus 交叉验证 / 兜底
	if cl.PromSourceID != nil {
		promClient, err := s.GetPromClient(ctx, *cl.PromSourceID)
		if err != nil {
			out.Warnings = append(out.Warnings, fmt.Sprintf("Prom 连接失败: %v", err))
		} else {
			clusterVar := ""
			if cl.GrafanaClusterVar != nil {
				clusterVar = *cl.GrafanaClusterVar
			}
			if clusterVar == "" {
				out.Warnings = append(out.Warnings,
					"未配置 cluster 变量，无法在 Prometheus 里过滤节点数（多集群环境会误统计）。请到集群设置里填 grafana_cluster_var（如 cls-xxxxxx）")
			} else {
				promTotal, promReady := s.queryPromNodes(ctx, promClient, clusterVar)
				if promTotal > 0 {
					out.CrossValidate.PromTotal = &promTotal
					out.CrossValidate.PromReady = &promReady
					if !kubectlOK {
						out.TotalNodes = promTotal
						out.ReadyNodes = promReady
						out.NotReadyNodes = promTotal - promReady
						out.NodesSource = "prometheus"
					}
					if kubectlOK && out.CrossValidate.KubectlTotal != nil {
						diff := abs(*out.CrossValidate.KubectlTotal - promTotal)
						if float64(diff)/float64(promTotal) > 0.05 {
							out.CrossValidate.Consistent = false
							out.Warnings = append(out.Warnings,
								fmt.Sprintf("节点数不一致: kubectl=%d, prom=%d",
									*out.CrossValidate.KubectlTotal, promTotal))
						}
					}
				} else {
					out.Warnings = append(out.Warnings,
						fmt.Sprintf("Prometheus 查询未返回节点（cluster=%q 可能不存在于任何 label 中）", clusterVar))
				}
			}
		}
	}

	// 拉节点池
	var pools []models.NodePool
	err = s.db.SelectContext(ctx, &pools,
		`SELECT id, cluster_id, name, provider_pool_id, min_size, max_size,
		 desired_size, current_size, instance_type, cost_per_hour, labels, taints, last_synced_at
		 FROM node_pools WHERE cluster_id=$1 ORDER BY id`, clusterID)
	if err != nil {
		out.Warnings = append(out.Warnings, fmt.Sprintf("List node_pools 失败: %v", err))
	} else {
		for _, p := range pools {
			po := NodePoolOverview{
				ID:      p.ID,
				Name:    p.Name,
				MinSize: p.MinSize,
				MaxSize: p.MaxSize,
			}
			if p.CurrentSize.Valid {
				po.CurrentSize = int64(p.CurrentSize.Int32)
			}
			if p.DesiredSize.Valid {
				po.DesiredSize = int64(p.DesiredSize.Int32)
			}
			out.NodePools = append(out.NodePools, po)
		}
	}
	return out, nil
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// queryPromNodes 用多种可能的 cluster label 名字探测正确的过滤方式
// 返回该集群的 total/ready 节点数
func (s *ConfigService) queryPromNodes(ctx context.Context, p *clients.PromClient, clusterVar string) (total, ready int) {
	label := s.detectClusterLabel(ctx, p, clusterVar)
	if label == "" {
		return
	}
	q := fmt.Sprintf(`count(kube_node_info{%s=%q})`, label, clusterVar)
	if r, err := p.Query(ctx, q); err == nil && len(r.Data.Result) > 0 {
		total = int(firstFloat(r.Data.Result[0]))
	}
	readyQ := fmt.Sprintf(`count(kube_node_status_condition{condition="Ready",status="true",%s=%q} == 1)`,
		label, clusterVar)
	if r, err := p.Query(ctx, readyQ); err == nil && len(r.Data.Result) > 0 {
		ready = int(firstFloat(r.Data.Result[0]))
	}
	return
}

// detectClusterLabel 探测 kube_node_info 里用哪个 label 表示 cluster
// 返回可用的 label 名，找不到返回空字符串
func (s *ConfigService) detectClusterLabel(ctx context.Context, p *clients.PromClient, clusterVar string) string {
	candidates := []string{"cluster", "cluster_id", "cluster_name", "clusterName", "kubernetes_cluster", "tke_cluster_id"}
	for _, label := range candidates {
		q := fmt.Sprintf(`count(kube_node_info{%s=%q})`, label, clusterVar)
		if r, err := p.Query(ctx, q); err == nil && len(r.Data.Result) > 0 {
			if firstFloat(r.Data.Result[0]) > 0 {
				return label
			}
		}
	}
	return ""
}

// detectMetricClusterLabel 探测某个 metric 上哪个 label 表示 cluster
// 不同 exporter 可能用不同 label（例如 node_cpu 用 cluster，cadvisor 用 cluster_id）
func (s *ConfigService) detectMetricClusterLabel(ctx context.Context, p *clients.PromClient, metricName, clusterVar string) string {
	candidates := []string{"cluster", "cluster_id", "cluster_name", "clusterName", "kubernetes_cluster", "tke_cluster_id"}
	for _, label := range candidates {
		q := fmt.Sprintf(`count(%s{%s=%q})`, metricName, label, clusterVar)
		if r, err := p.Query(ctx, q); err == nil && len(r.Data.Result) > 0 {
			if firstFloat(r.Data.Result[0]) > 0 {
				return label
			}
		}
	}
	return ""
}

// queryClusterCPUUsage 集群 CPU 平均使用率
// 依次尝试 node_exporter / cAdvisor / 简单 kube-state-metrics 方案
func (s *ConfigService) queryClusterCPUUsage(ctx context.Context, p *clients.PromClient, clusterVar string) float64 {
	// 方案 1: node_exporter node_cpu_seconds_total (通常有 cluster label)
	if label := s.detectMetricClusterLabel(ctx, p, "node_cpu_seconds_total", clusterVar); label != "" {
		q := fmt.Sprintf(`avg(100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle",%s=%q}[2m])) * 100))`,
			label, clusterVar)
		if r, err := p.Query(ctx, q); err == nil && len(r.Data.Result) > 0 {
			v := firstFloat(r.Data.Result[0])
			if v > 0 {
				return v
			}
		}
	}
	// 方案 2: cAdvisor container_cpu_usage_seconds_total（K8s 集群通常有）
	if label := s.detectMetricClusterLabel(ctx, p, "container_cpu_usage_seconds_total", clusterVar); label != "" {
		q := fmt.Sprintf(`sum(rate(container_cpu_usage_seconds_total{%s=%q,container!="",container!="POD"}[2m])) / sum(kube_node_status_allocatable{resource="cpu",%s=%q}) * 100`,
			label, clusterVar, label, clusterVar)
		if r, err := p.Query(ctx, q); err == nil && len(r.Data.Result) > 0 {
			v := firstFloat(r.Data.Result[0])
			if v > 0 {
				return v
			}
		}
	}
	// 方案 3: kube-state-metrics allocatable + cAdvisor（简化版）
	if label := s.detectMetricClusterLabel(ctx, p, "kube_node_status_capacity", clusterVar); label != "" {
		q := fmt.Sprintf(`(sum(rate(container_cpu_usage_seconds_total{%s=%q}[2m])) / sum(kube_node_status_capacity{resource="cpu",%s=%q})) * 100`,
			label, clusterVar, label, clusterVar)
		if r, err := p.Query(ctx, q); err == nil && len(r.Data.Result) > 0 {
			v := firstFloat(r.Data.Result[0])
			if v > 0 {
				return v
			}
		}
	}
	return 0
}

// queryClusterMemUsage 集群内存平均使用率
func (s *ConfigService) queryClusterMemUsage(ctx context.Context, p *clients.PromClient, clusterVar string) float64 {
	// 方案 1: node_memory 系列 (通常有 cluster label)
	if label := s.detectMetricClusterLabel(ctx, p, "node_memory_MemTotal_bytes", clusterVar); label != "" {
		q := fmt.Sprintf(`avg((1 - (node_memory_MemAvailable_bytes{%s=%q} / node_memory_MemTotal_bytes{%s=%q})) * 100)`,
			label, clusterVar, label, clusterVar)
		if r, err := p.Query(ctx, q); err == nil && len(r.Data.Result) > 0 {
			v := firstFloat(r.Data.Result[0])
			if v > 0 {
				return v
			}
		}
	}
	// 方案 2: cAdvisor container_memory_working_set_bytes
	if label := s.detectMetricClusterLabel(ctx, p, "container_memory_working_set_bytes", clusterVar); label != "" {
		q := fmt.Sprintf(`sum(container_memory_working_set_bytes{%s=%q,container!="",container!="POD"}) / sum(kube_node_status_allocatable{resource="memory",%s=%q}) * 100`,
			label, clusterVar, label, clusterVar)
		if r, err := p.Query(ctx, q); err == nil && len(r.Data.Result) > 0 {
			v := firstFloat(r.Data.Result[0])
			if v > 0 {
				return v
			}
		}
	}
	// 方案 3: kube-state-metrics
	if label := s.detectMetricClusterLabel(ctx, p, "kube_node_status_capacity", clusterVar); label != "" {
		q := fmt.Sprintf(`(sum(container_memory_working_set_bytes{%s=%q}) / sum(kube_node_status_capacity{resource="memory",%s=%q})) * 100`,
			label, clusterVar, label, clusterVar)
		if r, err := p.Query(ctx, q); err == nil && len(r.Data.Result) > 0 {
			v := firstFloat(r.Data.Result[0])
			if v > 0 {
				return v
			}
		}
	}
	return 0
}

// ClusterMetrics 三源聚合监控数据
// 前端展示时并列显示 Grafana / Prometheus / kubectl 三份，标注时间戳
type ClusterMetricsResult struct {
	ClusterID int64                  `json:"cluster_id"`
	FetchedAt time.Time              `json:"fetched_at"`
	Grafana   *GrafanaMetricSet      `json:"grafana,omitempty"`
	Prom      *PromMetricSet         `json:"prometheus,omitempty"`
	K8s       *K8sMetricSet          `json:"kubectl,omitempty"`
	Errors    map[string]string      `json:"errors,omitempty"`
}

type GrafanaMetricSet struct {
	DashboardURL string    `json:"dashboard_url,omitempty"`
	PanelURLs    []string  `json:"panel_urls,omitempty"`
	Source       string    `json:"source"`
	Timestamp    time.Time `json:"timestamp"`
}

type PromMetricSet struct {
	NodeCount   float64   `json:"node_count"`
	ReadyNodes  float64   `json:"ready_nodes"`
	PodCount    float64   `json:"pod_count"`
	AvgCPUUsage float64   `json:"avg_cpu_usage_percent"`
	AvgMemUsage float64   `json:"avg_mem_usage_percent"`
	Timestamp   time.Time `json:"timestamp"`
}

type K8sMetricSet struct {
	NodeCount   int       `json:"node_count"`
	ReadyNodes  int       `json:"ready_nodes"`
	Timestamp   time.Time `json:"timestamp"`
}

func (s *ConfigService) ClusterMetrics(ctx context.Context, clusterID int64) (*ClusterMetricsResult, error) {
	var cl models.Cluster
	if err := s.db.GetContext(ctx, &cl,
		`SELECT id, name, grafana_source_id, grafana_cluster_var, prom_source_id
		 FROM clusters WHERE id=$1`, clusterID); err != nil {
		return nil, err
	}
	res := &ClusterMetricsResult{
		ClusterID: clusterID,
		FetchedAt: time.Now(),
		Errors:    map[string]string{},
	}

	// Grafana：仅返回 URL，让前端 iframe 嵌入
	if cl.GrafanaSourceID != nil {
		g, err := s.GetGrafanaClient(ctx, *cl.GrafanaSourceID)
		if err != nil {
			res.Errors["grafana"] = err.Error()
		} else {
			_ = g // MVP 先给源站 URL
			res.Grafana = &GrafanaMetricSet{
				Source:    "grafana",
				Timestamp: time.Now(),
			}
		}
	}

	// Prometheus：查节点/Pod 数、CPU/内存平均使用率
	if cl.PromSourceID != nil {
		p, err := s.GetPromClient(ctx, *cl.PromSourceID)
		if err != nil {
			res.Errors["prometheus"] = err.Error()
		} else {
			clusterVar := ""
			if cl.GrafanaClusterVar != nil {
				clusterVar = *cl.GrafanaClusterVar
			}
			// 必须有 cluster 变量才做 Prom 查询（否则跨集群误统计）
			if clusterVar == "" {
				res.Errors["prometheus"] = "缺少 grafana_cluster_var（多集群环境无法过滤），请在集群设置补齐"
			} else {
				ms := &PromMetricSet{Timestamp: time.Now()}
				total, ready := s.queryPromNodes(ctx, p, clusterVar)
				ms.NodeCount = float64(total)
				ms.ReadyNodes = float64(ready)

				// 探出 kube_node_info 用的 label，用它拼 kube_pod_info 查询
				kubeLabel := s.detectClusterLabel(ctx, p, clusterVar)
				if kubeLabel != "" {
					filter := fmt.Sprintf(`{%s=%q}`, kubeLabel, clusterVar)
					if r, err := p.Query(ctx, "count(kube_pod_info"+filter+")"); err == nil && len(r.Data.Result) > 0 {
						ms.PodCount = firstFloat(r.Data.Result[0])
					}
				}

				// CPU/内存用 cAdvisor 或 node_exporter 指标
				// 优先尝试 kube_node 相关的指标（一般由 kube-state-metrics 和 node_exporter 提供），会有 cluster label
				ms.AvgCPUUsage = s.queryClusterCPUUsage(ctx, p, clusterVar)
				ms.AvgMemUsage = s.queryClusterMemUsage(ctx, p, clusterVar)

				res.Prom = ms
			}
		}
	}

	// K8s：数节点
	if k8s, err := s.GetK8sClient(ctx, clusterID); err != nil {
		res.Errors["kubectl"] = err.Error()
	} else {
		nodes, err := k8s.ListNodes(ctx)
		if err != nil {
			res.Errors["kubectl"] = err.Error()
		} else {
			ready := 0
			for _, n := range nodes {
				if n.Ready == "True" {
					ready++
				}
			}
			res.K8s = &K8sMetricSet{
				NodeCount:  len(nodes),
				ReadyNodes: ready,
				Timestamp:  time.Now(),
			}
		}
	}
	return res, nil
}

func firstFloat(s clients.PromSeries) float64 {
	if len(s.Value) < 2 {
		return 0
	}
	str, ok := s.Value[1].(string)
	if !ok {
		return 0
	}
	f, _ := strconv.ParseFloat(str, 64)
	return f
}
