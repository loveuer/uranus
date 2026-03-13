package pypi

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"net/mail"
	"strings"
)

// PKGInfo Python 包元数据（PKG-INFO / METADATA）
type PKGInfo struct {
	MetadataVersion    string   `json:"metadata_version"`     // Metadata-Version
	Name               string   `json:"name"`                 // Name
	Version            string   `json:"version"`              // Version
	Summary            string   `json:"summary"`              // Summary
	Description        string   `json:"description"`          // Description
	HomePage           string   `json:"home_page"`            // Home-page
	DownloadURL        string   `json:"download_url"`         // Download-URL
	Author             string   `json:"author"`               // Author
	AuthorEmail        string   `json:"author_email"`         // Author-email
	Maintainer         string   `json:"maintainer"`           // Maintainer
	MaintainerEmail    string   `json:"maintainer_email"`     // Maintainer-email
	License            string   `json:"license"`              // License
	Classifier         []string `json:"classifier"`           // Classifier
	RequiresPython     string   `json:"requires_python"`      // Requires-Python
	RequiresDist       []string `json:"requires_dist"`        // Requires-Dist
	ProvidesDist       []string `json:"provides_dist"`        // Provides-Dist
	ObsoletesDist      []string `json:"obsoletes_dist"`       // Obsoletes-Dist
	ProjectURL         []string `json:"project_url"`          // Project-URL
	Keywords           string   `json:"keywords"`             // Keywords
	Platform           []string `json:"platform"`             // Platform
	SupportedPlatform  []string `json:"supported_platform"`   // Supported-Platform
	DescriptionContentType string `json:"description_content_type"` // Description-Content-Type
}

// ParsePKGInfoFromWheel 从 wheel 文件中解析 METADATA
func ParsePKGInfoFromWheel(data []byte) (*PKGInfo, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("failed to open wheel zip: %w", err)
	}

	// 查找 METADATA 文件
	for _, f := range r.File {
		if strings.HasSuffix(f.Name, "METADATA") || strings.HasSuffix(f.Name, "PKG-INFO") {
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open METADATA: %w", err)
			}
			defer rc.Close()

			content, err := io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("failed to read METADATA: %w", err)
			}

			return ParsePKGInfoContent(string(content))
		}
	}

	return nil, fmt.Errorf("METADATA file not found in wheel")
}

// ParsePKGInfoFromSdist 从 sdist (.tar.gz) 中解析 PKG-INFO
func ParsePKGInfoFromSdist(data []byte) (*PKGInfo, error) {
	// 简单实现：尝试解压并查找 PKG-INFO
	// 注意：完整实现需要 tar 解析，这里先返回错误
	// 实际上传时可以从临时文件中解析
	return nil, fmt.Errorf("parsing PKG-INFO from sdist not yet implemented")
}

// ParsePKGInfoContent 解析 PKG-INFO 内容
func ParsePKGInfoContent(content string) (*PKGInfo, error) {
	info := &PKGInfo{}
	
	lines := strings.Split(content, "\n")
	var currentKey string
	var currentValue strings.Builder
	var multiline bool

	for _, line := range lines {
		// 处理多行值（以空格开头）
		if multiline && len(line) > 0 && (line[0] == ' ' || line[0] == '\t') {
			currentValue.WriteString("\n")
			currentValue.WriteString(strings.TrimSpace(line))
			continue
		}

		// 保存前一个字段
		if currentKey != "" {
			setFieldValue(info, currentKey, currentValue.String())
			currentKey = ""
			currentValue.Reset()
			multiline = false
		}

		// 解析键值对
		if idx := strings.Index(line, ":"); idx != -1 {
			key := strings.TrimSpace(line[:idx])
			value := strings.TrimSpace(line[idx+1:])
			
			// 检查是否是多行值（RFC 822 风格）
			if strings.Contains(value, "\n") || (len(line) > idx+1 && line[idx+1] == '\n') {
				multiline = true
			}
			
			currentKey = key
			currentValue.WriteString(value)
		}
	}

	// 处理最后一个字段
	if currentKey != "" {
		setFieldValue(info, currentKey, currentValue.String())
	}

	return info, nil
}

// setFieldValue 根据 key 设置对应的字段值
func setFieldValue(info *PKGInfo, key, value string) {
	switch strings.ToLower(key) {
	case "metadata-version":
		info.MetadataVersion = value
	case "name":
		info.Name = value
	case "version":
		info.Version = value
	case "summary":
		info.Summary = value
	case "description":
		info.Description = value
	case "home-page", "home_page":
		info.HomePage = value
	case "download-url":
		info.DownloadURL = value
	case "author":
		info.Author = value
	case "author-email":
		info.AuthorEmail = parseEmail(value)
	case "maintainer":
		info.Maintainer = value
	case "maintainer-email":
		info.MaintainerEmail = parseEmail(value)
	case "license":
		info.License = value
	case "classifier":
		info.Classifier = append(info.Classifier, value)
	case "requires-python":
		info.RequiresPython = value
	case "requires-dist":
		info.RequiresDist = append(info.RequiresDist, value)
	case "provides-dist":
		info.ProvidesDist = append(info.ProvidesDist, value)
	case "obsoletes-dist":
		info.ObsoletesDist = append(info.ObsoletesDist, value)
	case "project-url":
		info.ProjectURL = append(info.ProjectURL, value)
	case "keywords":
		info.Keywords = value
	case "platform":
		info.Platform = append(info.Platform, value)
	case "supported-platform":
		info.SupportedPlatform = append(info.SupportedPlatform, value)
	case "description-content-type":
		info.DescriptionContentType = value
	}
}

// parseEmail 解析 email 地址（可能包含名称）
func parseEmail(s string) string {
	if s == "" {
		return ""
	}
	addr, err := mail.ParseAddress(s)
	if err != nil {
		return s
	}
	return addr.Address
}
