# 活动报名系统后端API

这是一个简单的Node.js后端项目，为赛事报名小程序提供API服务。使用MySQL作为数据库。

## 技术栈

- Node.js
- Express.js
- MySQL

## 项目结构

```
activityRegistrationBackend/
  ├── index.js         # 主入口文件
  ├── env.js           # 环境变量配置
  ├── package.json     # 项目配置
  └── README.md        # 项目说明
```

## 安装与运行

1. 克隆项目
```
git clone <项目地址>
cd activityRegistrationBackend
```

2. 安装依赖
```
npm install
```

3. 配置数据库
   - 编辑`env.js`文件，修改数据库连接配置

4. 启动服务
```
npm start  # 生产环境
npm run dev  # 开发环境（使用nodemon自动重启）
```

5. 服务将在 http://localhost:8788 运行

## 基础路由

- `GET /` - 检查服务器运行状态