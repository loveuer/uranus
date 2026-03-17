package alpine

import (
	"archive/tar"
	"bufio"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// IndexParser APKINDEX 解析器
type IndexParser struct{}

// NewIndexParser 创建解析器
func NewIndexParser() *IndexParser {
	return &IndexParser{}
}

// ParseFile 解析 APKINDEX.tar.gz 文件
func (p *IndexParser) ParseFile(path string) (map[string]*PackageInfo, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return p.Parse(f)
}

// Parse 解析 APKINDEX.tar.gz 数据
func (p *IndexParser) Parse(r io.Reader) (map[string]*PackageInfo, error) {
	// 解压 gzip
	gz, err := gzip.NewReader(r)
	if err != nil {
		return nil, fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gz.Close()

	// 读取 tar
	tr := tar.NewReader(gz)

	var indexData []byte

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read tar: %w", err)
		}

		if header.Name == "APKINDEX" {
			indexData, err = io.ReadAll(tr)
			if err != nil {
				return nil, fmt.Errorf("failed to read APKINDEX: %w", err)
			}
			break
		}
	}

	if indexData == nil {
		return nil, fmt.Errorf("APKINDEX not found in tar.gz")
	}

	return p.parseIndex(string(indexData))
}

// parseIndex 解析 APKINDEX 文本格式
func (p *IndexParser) parseIndex(data string) (map[string]*PackageInfo, error) {
	packages := make(map[string]*PackageInfo)
	var current *PackageInfo

	scanner := bufio.NewScanner(strings.NewReader(data))

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			// 空行表示包记录结束
			if current != nil && current.Name != "" {
				packages[current.Name] = current
				current = nil
			}
			continue
		}

		if current == nil {
			current = &PackageInfo{}
		}

		if len(line) < 2 {
			continue
		}

		field := line[0]
		value := line[2:]

		switch field {
		case 'P': // Package name
			current.Name = value
		case 'V': // Version
			current.Version = value
		case 'A': // Architecture
			current.Architecture = value
		case 'T': // Description
			current.Description = value
		case 'U': // URL
			current.URL = value
		case 'L': // License
			current.License = value
		case 'm': // Maintainer
			current.Maintainer = value
		case 'S': // Size
			current.Size = p.parseInt(value)
		case 'I': // Installed size
			current.InstalledSize = p.parseInt(value)
		case 'C': // Checksum (Q1+base64)
			current.Checksum = value
		case 'o': // Origin
			current.Origin = value
		case 't': // Build timestamp
			current.BuildTime = p.parseTime(value)
		case 'c': // Git commit
			current.Commit = value
		}
	}

	// 处理最后一个包
	if current != nil && current.Name != "" {
		packages[current.Name] = current
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return packages, nil
}

// parseInt 解析整数
func (p *IndexParser) parseInt(s string) int64 {
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}

// parseTime 解析时间戳
func (p *IndexParser) parseTime(s string) time.Time {
	v, _ := strconv.ParseInt(s, 10, 64)
	return time.Unix(v, 0)
}

// SaveToJSON 将解析结果保存为 JSON（加速后续读取）
func (p *IndexParser) SaveToJSON(packages map[string]*PackageInfo, path string) error {
	// 创建目录
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	// 暂不实现 JSON 序列化，直接返回
	// 实际使用时可以添加 json 序列化逻辑
	return nil
}
