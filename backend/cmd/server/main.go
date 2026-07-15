package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"mobile-ops/internal/api"
	"mobile-ops/internal/clients"
	"mobile-ops/internal/config"
	"mobile-ops/internal/db"
	"mobile-ops/internal/services"
	"mobile-ops/internal/utils"
)

func main() {
	cfgPath := flag.String("config", "config.yaml", "config file path")
	migrateDir := flag.String("migrations", "migrations", "migration dir")
	initAdmin := flag.Bool("init-admin", false, "create default admin user then exit")
	adminUser := flag.String("admin-user", "admin", "admin username")
	adminPass := flag.String("admin-pass", "", "admin password (required with --init-admin)")
	flag.Parse()

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		logrus.Fatalf("load config: %v", err)
	}

	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})

	database, err := db.Connect(cfg.Database)
	if err != nil {
		logger.Fatalf("db: %v", err)
	}
	defer database.Close()

	if err := db.Migrate(database, *migrateDir); err != nil {
		logger.Fatalf("migrate: %v", err)
	}

	cipher, err := utils.NewCipher(cfg.Security.EncryptionKey)
	if err != nil {
		logger.Fatalf("cipher: %v", err)
	}

	// 初始化 admin
	if *initAdmin {
		if *adminPass == "" {
			logger.Fatal("--admin-pass required with --init-admin")
		}
		hash, err := services.HashPassword(*adminPass)
		if err != nil {
			logger.Fatalf("hash: %v", err)
		}
		_, err = database.Exec(
			`INSERT INTO users(username, password_hash, role) VALUES ($1, $2, 'admin')
			 ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash`,
			*adminUser, hash)
		if err != nil {
			logger.Fatalf("create admin: %v", err)
		}
		fmt.Printf("Admin user %q created/updated.\n", *adminUser)
		os.Exit(0)
	}

	// 组装 services
	authSvc := services.NewAuthService(cfg.Security)
	k8sPool := clients.NewK8sClientPool()
	configSvc := services.NewConfigService(database, cipher, k8sPool)
	scaleSvc := services.NewScaleService(database, cfg.Policy, configSvc)
	alertSvc := services.NewAlertService(database)

	// 起后台 poller（扩容后节点 Ready 轮询）
	pollCtx, pollCancel := context.WithCancel(context.Background())
	defer pollCancel()
	go scaleSvc.RunPoller(pollCtx)

	// 起 HTTP server
	gin.SetMode(cfg.Server.Mode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(RequestLogger(logger))

	h := api.NewHandler(database, cfg, authSvc, configSvc, scaleSvc, alertSvc)
	h.Register(r)

	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:      r,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Second,
	}
	logger.Infof("mobile-ops listen on %s", srv.Addr)

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("listen: %v", err)
		}
	}()

	// 优雅退出
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(shutdownCtx)
}

func RequestLogger(logger *logrus.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		logger.WithFields(logrus.Fields{
			"method":  c.Request.Method,
			"path":    c.Request.URL.Path,
			"status":  c.Writer.Status(),
			"latency": time.Since(start).Milliseconds(),
			"ip":      c.ClientIP(),
		}).Info("http")
	}
}
