package clients

import (
	"context"
	"fmt"
	"time"

	cls "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/cls/v20201016"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
)

// TencentCLSClient 腾讯云日志服务客户端
type TencentCLSClient struct {
	SecretID  string
	SecretKey string
	Region    string
}

// NewTencentCLSClient 创建 CLS 客户端
func NewTencentCLSClient(secretID, secretKey, region string) *TencentCLSClient {
	return &TencentCLSClient{
		SecretID:  secretID,
		SecretKey: secretKey,
		Region:    region,
	}
}

func (c *TencentCLSClient) getClient() (*cls.Client, error) {
	credential := common.NewCredential(c.SecretID, c.SecretKey)
	cpf := profile.NewClientProfile()
	cpf.HttpProfile.Endpoint = "cls.tencentcloudapi.com"
	client, err := cls.NewClient(credential, c.Region, cpf)
	if err != nil {
		return nil, fmt.Errorf("create cls client: %w", err)
	}
	return client, nil
}

// LogsetInfo 日志集信息
type LogsetInfo struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Region     string    `json:"region"`
	CreateTime time.Time `json:"create_time"`
	TopicCount int64     `json:"topic_count"`
}

// ListLogsets 获取日志集列表
func (c *TencentCLSClient) ListLogsets(ctx context.Context) ([]LogsetInfo, error) {
	client, err := c.getClient()
	if err != nil {
		return nil, err
	}

	request := cls.NewDescribeLogsetsRequest()
	response, err := client.DescribeLogsets(request)
	if err != nil {
		return nil, fmt.Errorf("describe logsets: %w", err)
	}

	result := make([]LogsetInfo, 0)
	if response.Response.Logsets != nil {
		for _, ls := range response.Response.Logsets {
			if ls.LogsetId == nil || ls.LogsetName == nil {
				continue
			}
			info := LogsetInfo{
				ID:     *ls.LogsetId,
				Name:   *ls.LogsetName,
				Region: c.Region,
			}
			if ls.CreateTime != nil {
				// CreateTime 格式: "YYYY-MM-DD HH:MM:SS"
				t, err := time.Parse("2006-01-02 15:04:05", *ls.CreateTime)
				if err == nil {
					info.CreateTime = t
				}
			}
			if ls.TopicCount != nil {
				info.TopicCount = *ls.TopicCount
			}
			result = append(result, info)
		}
	}

	return result, nil
}

// TopicInfo 日志主题信息
type TopicInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	LogsetID string `json:"logset_id"`
}

// ListTopics 获取日志主题列表
func (c *TencentCLSClient) ListTopics(ctx context.Context, logsetID string) ([]TopicInfo, error) {
	client, err := c.getClient()
	if err != nil {
		return nil, err
	}

	request := cls.NewDescribeTopicsRequest()
	if logsetID != "" {
		request.Filters = []*cls.Filter{
			{
				Key:    common.StringPtr("logsetId"),
				Values: common.StringPtrs([]string{logsetID}),
			},
		}
	}

	response, err := client.DescribeTopics(request)
	if err != nil {
		return nil, fmt.Errorf("describe topics: %w", err)
	}

	result := make([]TopicInfo, 0)
	if response.Response.Topics != nil {
		for _, topic := range response.Response.Topics {
			if topic.TopicId == nil || topic.TopicName == nil {
				continue
			}
			info := TopicInfo{
				ID:   *topic.TopicId,
				Name: *topic.TopicName,
			}
			if topic.LogsetId != nil {
				info.LogsetID = *topic.LogsetId
			}
			result = append(result, info)
		}
	}

	return result, nil
}

// LogRecord 日志记录
type LogRecord struct {
	Timestamp time.Time         `json:"timestamp"`
	Content   string            `json:"content"`
	TopicName string            `json:"topic_name,omitempty"`
	Source    string            `json:"source,omitempty"`
	Fields    map[string]string `json:"fields,omitempty"`
}

// SearchLogs 搜索日志
func (c *TencentCLSClient) SearchLogs(ctx context.Context, topicID string, query string, startTime, endTime time.Time, limit int) ([]LogRecord, error) {
	client, err := c.getClient()
	if err != nil {
		return nil, err
	}

	request := cls.NewSearchLogRequest()
	request.TopicId = common.StringPtr(topicID)
	request.Query = common.StringPtr(query)
	// CLS API 要求毫秒级时间戳
	request.From = common.Int64Ptr(startTime.UnixMilli())
	request.To = common.Int64Ptr(endTime.UnixMilli())
	if limit > 0 {
		request.Limit = common.Int64Ptr(int64(limit))
	} else {
		request.Limit = common.Int64Ptr(100) // 默认 100 条
	}

	response, err := client.SearchLog(request)
	if err != nil {
		return nil, fmt.Errorf("search log: %w", err)
	}

	result := make([]LogRecord, 0)
	if response.Response.Results != nil {
		for _, log := range response.Response.Results {
			if log.Time == nil {
				continue
			}
			record := LogRecord{
				Timestamp: time.Unix(*log.Time/1000, 0),
				Fields:    make(map[string]string),
			}

			// LogJson 是日志内容的 JSON 序列化字符串
			if log.LogJson != nil {
				record.Content = *log.LogJson
			} else if log.RawLog != nil {
				record.Content = *log.RawLog
			}

			if log.TopicName != nil {
				record.TopicName = *log.TopicName
			}
			if log.Source != nil {
				record.Source = *log.Source
			}

			result = append(result, record)
		}
	}

	return result, nil
}
