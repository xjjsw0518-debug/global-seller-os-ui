# Worker 资源中心：真实数据与远程桌面接入约定（草案）

当前 Vite 页面是 `PREVIEW_ONLY`。全球/国家/城市统计、资源列表、就绪检查、软件版本和安装状态来自 `src/mock/workerResources.js` 与前端表单状态；刷新按钮不会向真实服务发请求。添加资源时填写的名称、国家、城市、坐标、服务商、控制台 URL、连接地址、端口、用户名和模板在本次浏览器会话中传到就绪页。`createdAt` / `readyAt` 是本次前端演示流转的本地时间，不是服务器时间；操作系统、运行开始时间、资源规格、真实就绪结果仍等待 API。页面不把创建时间当作运行时长。

## 需要后端确认的最小读取契约

以下是 UI 所需字段，不代表现有服务已提供这些路径或语义。接入前请提供 OpenAPI/Swagger、基础地址、鉴权、错误码、分页与状态枚举，再确定实际路由。

| 读取场景 | 建议响应字段 |
| --- | --- |
| 全球/国家/城市概览 | `scope`, `countryCode`, `cityId`, `counts`（total/online/offline/abnormal/ready/vps/mobile/runningRpa/idleRpa/remoteCapable）, `updatedAt`, `version` |
| 资源列表 | `items[]`（id/name/type/countryCode/city/lat/lng/provider/providerLogoUrl/agentStatus/customerAgentStatus/workerStatus/runtimeStatus/plan/remote/progress/finalStatus/lastHeartbeat）, `total`, `page`, `pageSize`, `updatedAt` |
| 单个资源详情 | 上述资源字段，加 `spec`, `os`, `createdAt`, `readyAt`, `startedAt`, `purpose`, `connection`（ip/port/username/method/deviceGatewayUrl）。不得返回明文密码。 |
| 就绪及 Package | `checks[]`（name/status/detail/checkedAt）, `packages[]`（name/version/status/progress/installedAt）, `overallStatus`, `updatedAt` |

概览与列表应使用同一版本号或同一查询快照，避免 KPI、地图和表格相互矛盾。首屏拉取一次；页面可见时建议用服务器推送，或按已确认的轮询间隔更新，隐藏时暂停；手动刷新应强制重新拉取并显示 `updatedAt`。`startedAt` 到当前时间可用于计算运行时长；断开/重启时以服务器状态重置。`createdAt`、`readyAt`、状态和软件版本必须以服务端为准。现在尚无接口契约，不能宣称已自动同步。

## Windows RDP 一键连接（已选方案，尚未实现）

用户选择 Windows 桌面助手＋系统凭据库。浏览器按钮最终只传不可猜测的资源 ID 给已安装、已签名且用户授权的本地助手；不在 URL、`.rdp` 文件、日志、浏览器本地存储或前端 API 响应中传密码。助手从受信任的资源 API 取目标 IP/用户名，凭据由 Windows 凭据库按资源绑定。助手校验调用来源、资源权限和目标地址后启动系统 RDP 客户端，并清理临时非敏感连接文件。首次安装/协议注册及凭据保存需要用户在桌面端确认；Windows 安全策略仍可能要求再次验证，网页不能保证完全无提示。

当前工程没有桌面助手、凭据配置、资源 API 或签名/安装流程。因此“打开远程桌面”仅展示连接信息与未接入说明，不会冒充已连接。要进入实现阶段，还需确认桌面助手的安装方式、后端资源接口、鉴权、凭据登记/轮换/撤销、允许的目标范围及审计要求。此前 UI 预览不接真实后端的限制未解除到无契约直接接入的程度，`UI_LOCKED` 仍未声明。
