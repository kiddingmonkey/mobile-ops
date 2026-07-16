package clients

import (
	"context"
	"fmt"
	"strings"

	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	tcerr "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/errors"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	vpc "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/vpc/v20170312"
)

// TencentVPCClient 腾讯云 VPC/安全组客户端
type TencentVPCClient struct {
	client *vpc.Client
	region string
}

func NewTencentVPCClient(secretID, secretKey, region string) (*TencentVPCClient, error) {
	credential := common.NewCredential(secretID, secretKey)
	cpf := profile.NewClientProfile()
	cpf.HttpProfile.Endpoint = "vpc.tencentcloudapi.com"
	cpf.HttpProfile.ReqTimeout = 15
	c, err := vpc.NewClient(credential, region, cpf)
	if err != nil {
		return nil, fmt.Errorf("vpc client: %w", err)
	}
	return &TencentVPCClient{client: c, region: region}, nil
}

// SecurityGroupRule 表示一条 SG 规则
type SecurityGroupRule struct {
	PolicyIndex       int64  `json:"policy_index"`
	Protocol          string `json:"protocol"`
	Port              string `json:"port"`
	CidrBlock         string `json:"cidr_block"`
	Action            string `json:"action"` // ACCEPT / DROP
	PolicyDescription string `json:"description"`
}

// ListIngressRules 拉入站规则
func (v *TencentVPCClient) ListIngressRules(ctx context.Context, sgID string) ([]SecurityGroupRule, error) {
	req := vpc.NewDescribeSecurityGroupPoliciesRequest()
	req.SecurityGroupId = common.StringPtr(sgID)
	resp, err := v.client.DescribeSecurityGroupPoliciesWithContext(ctx, req)
	if err != nil {
		if e, ok := err.(*tcerr.TencentCloudSDKError); ok {
			return nil, fmt.Errorf("vpc [%s] %s", e.Code, e.Message)
		}
		return nil, err
	}
	if resp.Response.SecurityGroupPolicySet == nil {
		return nil, nil
	}
	out := make([]SecurityGroupRule, 0, len(resp.Response.SecurityGroupPolicySet.Ingress))
	for _, p := range resp.Response.SecurityGroupPolicySet.Ingress {
		if p == nil {
			continue
		}
		out = append(out, SecurityGroupRule{
			PolicyIndex:       safeInt64Ptr(p.PolicyIndex),
			Protocol:          safeStrPtr(p.Protocol),
			Port:              safeStrPtr(p.Port),
			CidrBlock:         safeStrPtr(p.CidrBlock),
			Action:            safeStrPtr(p.Action),
			PolicyDescription: safeStrPtr(p.PolicyDescription),
		})
	}
	return out, nil
}

// DeleteRulesByDescription 按 description 删除入站规则
// 返回删除的规则数量
func (v *TencentVPCClient) DeleteRulesByDescription(ctx context.Context, sgID, description string) (int, error) {
	if description == "" {
		return 0, fmt.Errorf("description is empty")
	}
	rules, err := v.ListIngressRules(ctx, sgID)
	if err != nil {
		return 0, err
	}
	// 收集匹配的规则
	toDelete := make([]*vpc.SecurityGroupPolicy, 0)
	for _, r := range rules {
		if r.PolicyDescription == description {
			toDelete = append(toDelete, &vpc.SecurityGroupPolicy{
				PolicyIndex:       common.Int64Ptr(r.PolicyIndex),
				Protocol:          common.StringPtr(r.Protocol),
				Port:              common.StringPtr(r.Port),
				CidrBlock:         common.StringPtr(r.CidrBlock),
				Action:            common.StringPtr(r.Action),
				PolicyDescription: common.StringPtr(r.PolicyDescription),
			})
		}
	}
	if len(toDelete) == 0 {
		return 0, nil
	}
	req := vpc.NewDeleteSecurityGroupPoliciesRequest()
	req.SecurityGroupId = common.StringPtr(sgID)
	req.SecurityGroupPolicySet = &vpc.SecurityGroupPolicySet{Ingress: toDelete}
	if _, err := v.client.DeleteSecurityGroupPoliciesWithContext(ctx, req); err != nil {
		if e, ok := err.(*tcerr.TencentCloudSDKError); ok {
			return 0, fmt.Errorf("vpc delete [%s] %s", e.Code, e.Message)
		}
		return 0, err
	}
	return len(toDelete), nil
}

// UpsertRuleByDescription 按 description 匹配现有规则:
//  - 若匹配到 1 条: 用 ReplaceSecurityGroupPolicies 修改 CidrBlock (需 ModifySecurityGroupPolicy 权限)
//  - 若匹配到 0 条: 用 CreateSecurityGroupPolicies 新增 (需 CreateSecurityGroupPolicy 权限)
//  - 若匹配到多条: 只更新第一条,返回 matched 数量给上层决定
// 返回: (matched 匹配数, updated true=改了旧的/false=新建了, error)
func (v *TencentVPCClient) UpsertRuleByDescription(ctx context.Context, sgID, ip, port, protocol, description string) (int, bool, error) {
	if description == "" {
		return 0, false, fmt.Errorf("description is empty")
	}
	cidr := ip
	if !strings.Contains(cidr, "/") {
		cidr = cidr + "/32"
	}
	if protocol == "" {
		protocol = "TCP"
	}
	if port == "" {
		port = "ALL"
	}

	rules, err := v.ListIngressRules(ctx, sgID)
	if err != nil {
		return 0, false, err
	}
	matched := 0
	var firstIdx int64 = -1
	for _, r := range rules {
		if r.PolicyDescription == description {
			matched++
			if firstIdx < 0 {
				firstIdx = r.PolicyIndex
			}
		}
	}

	if matched == 0 {
		// 新增
		if err := v.AddIngressRule(ctx, sgID, ip, port, protocol, description); err != nil {
			return 0, false, err
		}
		return 0, false, nil
	}

	// Replace 第一条
	req := vpc.NewReplaceSecurityGroupPoliciesRequest()
	req.SecurityGroupId = common.StringPtr(sgID)
	req.SecurityGroupPolicySet = &vpc.SecurityGroupPolicySet{
		Ingress: []*vpc.SecurityGroupPolicy{
			{
				PolicyIndex:       common.Int64Ptr(firstIdx),
				Protocol:          common.StringPtr(protocol),
				Port:              common.StringPtr(port),
				CidrBlock:         common.StringPtr(cidr),
				Action:            common.StringPtr("ACCEPT"),
				PolicyDescription: common.StringPtr(description),
			},
		},
	}
	if _, err := v.client.ReplaceSecurityGroupPoliciesWithContext(ctx, req); err != nil {
		if e, ok := err.(*tcerr.TencentCloudSDKError); ok {
			return matched, false, fmt.Errorf("vpc replace [%s] %s", e.Code, e.Message)
		}
		return matched, false, err
	}
	return matched, true, nil
}

// AddIngressRule 添加一条入站规则 (放行 IP+端口)
// port 支持 "443" / "80,443" / "ALL", protocol 支持 TCP/UDP/ALL
func (v *TencentVPCClient) AddIngressRule(ctx context.Context, sgID, ip, port, protocol, description string) error {
	cidr := ip
	if !strings.Contains(cidr, "/") {
		cidr = cidr + "/32"
	}
	if protocol == "" {
		protocol = "TCP"
	}
	if port == "" {
		port = "ALL"
	}
	req := vpc.NewCreateSecurityGroupPoliciesRequest()
	req.SecurityGroupId = common.StringPtr(sgID)
	req.SecurityGroupPolicySet = &vpc.SecurityGroupPolicySet{
		Ingress: []*vpc.SecurityGroupPolicy{
			{
				Protocol:          common.StringPtr(protocol),
				Port:              common.StringPtr(port),
				CidrBlock:         common.StringPtr(cidr),
				Action:            common.StringPtr("ACCEPT"),
				PolicyDescription: common.StringPtr(description),
			},
		},
	}
	if _, err := v.client.CreateSecurityGroupPoliciesWithContext(ctx, req); err != nil {
		if e, ok := err.(*tcerr.TencentCloudSDKError); ok {
			return fmt.Errorf("vpc create [%s] %s", e.Code, e.Message)
		}
		return err
	}
	return nil
}

func safeStrPtr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func safeInt64Ptr(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}
