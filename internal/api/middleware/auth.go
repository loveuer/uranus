package middleware

import (
	"encoding/base64"
	"strings"

	"github.com/loveuer/ursa"

	"gitea.loveuer.com/loveuer/uranus/v2/internal/model"
	"gitea.loveuer.com/loveuer/uranus/v2/internal/service"
)

const (
	LocalsUserID        = "user_id"
	LocalsUsername      = "username"
	LocalsIsAdmin       = "is_admin"
	LocalsUploadModules = "upload_modules"
)

// resolveAuth 尝试从 Authorization header 解析身份，支持 Bearer JWT 和 Basic Auth。
// 成功则填充 locals 并返回 true；header 为空返回 (false, nil)；认证失败返回 (false, err)。
func resolveAuth(c *ursa.Ctx, authService *service.AuthService) (ok bool, err error) {
	header := c.Get("Authorization")
	if header == "" {
		return false, nil
	}

	switch {
	case strings.HasPrefix(header, "Bearer "):
		token := strings.TrimPrefix(header, "Bearer ")
		claims, e := authService.ValidateToken(token)
		if e != nil {
			return false, e
		}
		c.Locals(LocalsUserID, claims.UserID)
		c.Locals(LocalsUsername, claims.Username)
		c.Locals(LocalsIsAdmin, claims.IsAdmin)
		c.Locals(LocalsUploadModules, claims.UploadModules)
		return true, nil

	case strings.HasPrefix(header, "Basic "):
		encoded := strings.TrimPrefix(header, "Basic ")
		decoded, e := base64.StdEncoding.DecodeString(encoded)
		if e != nil {
			return false, service.ErrInvalidCredentials
		}
		parts := strings.SplitN(string(decoded), ":", 2)
		if len(parts) != 2 {
			return false, service.ErrInvalidCredentials
		}
		user, e := authService.VerifyCredentials(c.Request.Context(), parts[0], parts[1])
		if e != nil {
			return false, e
		}
		c.Locals(LocalsUserID, user.ID)
		c.Locals(LocalsUsername, user.Username)
		c.Locals(LocalsIsAdmin, user.IsAdmin)
		c.Locals(LocalsUploadModules, user.UploadModules)
		return true, nil
	}

	return false, service.ErrInvalidCredentials
}

// Auth 强制认证中间件，支持 Bearer JWT 和 Basic Auth。
func Auth(authService *service.AuthService) ursa.HandlerFunc {
	return func(c *ursa.Ctx) error {
		ok, err := resolveAuth(c, authService)
		if err != nil || !ok {
			return c.Status(401).JSON(ursa.Map{
				"code":    401,
				"message": "unauthorized",
			})
		}
		return c.Next()
	}
}

// OptionalAuth 可选认证中间件，认证失败不阻断请求。
func OptionalAuth(authService *service.AuthService) ursa.HandlerFunc {
	return func(c *ursa.Ctx) error {
		resolveAuth(c, authService) //nolint:errcheck
		return c.Next()
	}
}

// AdminOnly 仅管理员中间件。
func AdminOnly() ursa.HandlerFunc {
	return func(c *ursa.Ctx) error {
		isAdmin, ok := c.Locals(LocalsIsAdmin).(bool)
		if !ok || !isAdmin {
			return c.Status(403).JSON(ursa.Map{
				"code":    403,
				"message": "forbidden: admin only",
			})
		}
		return c.Next()
	}
}

// GetUserID 从上下文获取用户 ID。
func GetUserID(c *ursa.Ctx) uint {
	if id, ok := c.Locals(LocalsUserID).(uint); ok {
		return id
	}
	return 0
}

// GetUsername 从上下文获取用户名。
func GetUsername(c *ursa.Ctx) string {
	if name, ok := c.Locals(LocalsUsername).(string); ok {
		return name
	}
	return ""
}

// IsAdmin 从上下文获取管理员状态。
func IsAdmin(c *ursa.Ctx) bool {
	if isAdmin, ok := c.Locals(LocalsIsAdmin).(bool); ok {
		return isAdmin
	}
	return false
}

// GetUploadModules 从上下文获取用户可上传模块列表。
func GetUploadModules(c *ursa.Ctx) model.UserUploadModules {
	if modules, ok := c.Locals(LocalsUploadModules).(model.UserUploadModules); ok {
		return modules
	}
	return nil
}

// CanUpload 检查当前用户是否可以上传指定模块。
// 管理员可以上传所有模块，普通用户需要检查是否在允许列表中。
func CanUpload(c *ursa.Ctx, module model.Module) bool {
	isAdmin := IsAdmin(c)
	if isAdmin {
		return true
	}
	modules := GetUploadModules(c)
	for _, m := range modules {
		if m == module {
			return true
		}
	}
	return false
}

// RequireUploadPermission 返回检查指定模块上传权限的中间件。
func RequireUploadPermission(module model.Module) ursa.HandlerFunc {
	return func(c *ursa.Ctx) error {
		if !CanUpload(c, module) {
			return c.Status(403).JSON(ursa.Map{
				"code":    403,
				"message": "forbidden: no upload permission for " + string(module),
			})
		}
		return c.Next()
	}
}
