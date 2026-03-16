package config

import (
	"testing"
)

func TestParseDB(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		dataDir   string
		wantDriver string
		wantDSNContains string
		wantErr   bool
	}{
		// SQLite tests
		{
			name:      "sqlite absolute path",
			input:     "/data/uranus.db",
			dataDir:   "/app",
			wantDriver: "sqlite",
			wantDSNContains: "/data/uranus.db",
		},
		{
			name:      "sqlite relative path",
			input:     "./data.db",
			dataDir:   "/app",
			wantDriver: "sqlite",
			wantDSNContains: "data.db",
		},
		{
			name:      "sqlite filename only",
			input:     "mydb.sqlite",
			dataDir:   "/home/user",
			wantDriver: "sqlite",
			wantDSNContains: "/home/user/mydb.sqlite",
		},
		{
			name:      "empty defaults to sqlite",
			input:     "",
			dataDir:   "/data",
			wantDriver: "sqlite",
			wantDSNContains: "/data/ufshare.db",
		},

		// MySQL tests
		{
			name:      "mysql url format",
			input:     "mysql://root:password@localhost:3306/uranus",
			dataDir:   "/data",
			wantDriver: "mysql",
			wantDSNContains: "root:password@tcp(localhost:3306)/uranus",
		},
		{
			name:      "mysql url with special chars",
			input:     "mysql://user:p@ssw0rd@192.168.1.100:3306/mydb",
			dataDir:   "/data",
			wantDriver: "mysql",
			wantDSNContains: "user:p@ssw0rd@tcp(192.168.1.100:3306)/mydb",
		},
		{
			name:      "mysql dsn format",
			input:     "root:password@tcp(localhost:3306)/uranus",
			dataDir:   "/data",
			wantDriver: "mysql",
			wantDSNContains: "root:password@tcp(localhost:3306)/uranus",
		},
		{
			name:      "mysql dsn with params",
			input:     "user:pass@tcp(127.0.0.1:3306)/db?charset=utf8",
			dataDir:   "/data",
			wantDriver: "mysql",
			wantDSNContains: "parseTime=true",
		},

		// PostgreSQL tests
		{
			name:      "postgres url format",
			input:     "postgres://user:password@localhost:5432/uranus",
			dataDir:   "/data",
			wantDriver: "postgres",
			wantDSNContains: "postgres://user:password@localhost:5432/uranus",
		},
		{
			name:      "postgresql url format",
			input:     "postgresql://admin:secret@db.example.com:5432/mydb?sslmode=require",
			dataDir:   "/data",
			wantDriver: "postgres",
			wantDSNContains: "postgresql://admin:secret@db.example.com:5432/mydb",
		},
		{
			name:      "postgres key=value format",
			input:     "host=localhost user=postgres password=secret dbname=uranus",
			dataDir:   "/data",
			wantDriver: "postgres",
			wantDSNContains: "host=localhost",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			driver, dsn, err := ParseDB(tt.input, tt.dataDir)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseDB() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if driver != tt.wantDriver {
				t.Errorf("ParseDB() driver = %v, want %v", driver, tt.wantDriver)
			}
			if tt.wantDSNContains != "" && !contains(dsn, tt.wantDSNContains) {
				t.Errorf("ParseDB() dsn = %v, want to contain %v", dsn, tt.wantDSNContains)
			}
		})
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
