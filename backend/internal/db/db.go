package db

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/sirupsen/logrus"

	"mobile-ops/internal/config"
)

func Connect(cfg config.DatabaseConfig) (*sqlx.DB, error) {
	db, err := sqlx.Connect("postgres", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("db connect: %w", err)
	}
	db.SetMaxOpenConns(cfg.MaxOpen)
	db.SetMaxIdleConns(cfg.MaxIdle)
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("db ping: %w", err)
	}
	return db, nil
}

// Migrate 按文件名字母序执行 migrations/*.sql
// 简单实现：不做版本追踪，用 IF NOT EXISTS 保证幂等
func Migrate(db *sqlx.DB, dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read migration dir: %w", err)
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".sql" {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, fn := range files {
		path := filepath.Join(dir, fn)
		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", fn, err)
		}
		if _, err := db.Exec(string(content)); err != nil {
			return fmt.Errorf("execute %s: %w", fn, err)
		}
		logrus.WithField("file", fn).Info("migration applied")
	}
	return nil
}
