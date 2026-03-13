package pypi

import (
	"testing"
)

func TestNormalizePackageName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"lowercase", "requests", "requests"},
		{"uppercase", "REQUESTS", "requests"},
		{"with underscore", "my_package", "my-package"},
		{"with dot", "my.package", "my-package"},
		{"mixed", "My_Package.Name", "my-package-name"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizePackageName(tt.input)
			if result != tt.expected {
				t.Errorf("normalizePackageName(%q) = %q; want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestParseFilename(t *testing.T) {
	tests := []struct {
		name         string
		filename     string
		wantDist     string
		wantVersion  string
		wantType     string
		wantErr      bool
	}{
		{
			name:        "wheel file",
			filename:    "requests-2.28.0-py3-none-any.whl",
			wantDist:    "requests",
			wantVersion: "2.28.0",
			wantType:    "bdist_wheel",
			wantErr:     false,
		},
		{
			name:        "tar.gz file",
			filename:    "requests-2.28.0.tar.gz",
			wantDist:    "requests",
			wantVersion: "2.28.0",
			wantType:    "sdist",
			wantErr:     false,
		},
		{
			name:        "zip file",
			filename:    "requests-2.28.0.zip",
			wantDist:    "requests",
			wantVersion: "2.28.0",
			wantType:    "sdist",
			wantErr:     false,
		},
		{
			name:        "invalid filename",
			filename:    "invalid.txt",
			wantDist:    "",
			wantVersion: "",
			wantType:    "",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dist, version, packagetype, err := parseFilename(tt.filename)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseFilename(%q) error = %v, wantErr %v", tt.filename, err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if dist != tt.wantDist {
					t.Errorf("dist = %q, want %q", dist, tt.wantDist)
				}
				if version != tt.wantVersion {
					t.Errorf("version = %q, want %q", version, tt.wantVersion)
				}
				if packagetype != tt.wantType {
					t.Errorf("packagetype = %q, want %q", packagetype, tt.wantType)
				}
			}
		})
	}
}
