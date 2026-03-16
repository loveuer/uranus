package model

// Module 表示系统支持的模块类型（字符串枚举）
type Module string

const (
	ModuleFile  Module = "file"
	ModuleNpm   Module = "npm"
	ModuleOci   Module = "oci"
	ModuleMaven Module = "maven"
	ModulePyPI  Module = "pypi"
	ModuleGo    Module = "go"
)

// AllModules 返回所有支持的模块列表
func AllModules() []Module {
	return []Module{
		ModuleFile,
		ModuleNpm,
		ModuleOci,
		ModuleMaven,
		ModulePyPI,
		ModuleGo,
	}
}

// ModuleNames 返回所有模块的名称列表（用于前端展示）
func ModuleNames() []string {
	modules := AllModules()
	names := make([]string, len(modules))
	for i, m := range modules {
		names[i] = string(m)
	}
	return names
}

// IsValidModule 检查模块名称是否有效
func IsValidModule(name string) bool {
	switch Module(name) {
	case ModuleFile, ModuleNpm, ModuleOci, ModuleMaven, ModulePyPI, ModuleGo:
		return true
	default:
		return false
	}
}

// String 返回模块的字符串表示
func (m Module) String() string {
	return string(m)
}
