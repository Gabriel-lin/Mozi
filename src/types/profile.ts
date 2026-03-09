// 个人资料类型定义
export interface UserProfile {
  username: string;
  avatar: string;
  email: string;
  phone: string;
  github: string;
}

// 权限类型定义
export interface Permission {
  id: string;
  name: string;
  description: string;
}

// 角色类型定义
export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

// 工作区类型定义
export interface Workspace {
  id: string;
  name: string;
  type: "local" | "remote";
  path: string;
  isActive: boolean;
}

// 个人资料与工作区设置
export interface ProfileSettings {
  user: UserProfile;
  workspaces: Workspace[];
}

// Mock 数据
export const mockProfileSettings: ProfileSettings = {
  user: {
    username: "Mozi 用户",
    avatar: "user",
    email: "user@mozi.app",
    phone: "+86 138-0000-8888",
    github: "mozi-user",
  },
  workspaces: [
    {
      id: "1",
      name: "本地工作区",
      type: "local",
      path: "/home/gab/projects",
      isActive: true,
    },
    {
      id: "2",
      name: "远程工作区 1",
      type: "remote",
      path: "user@remote-server:/home/user/projects",
      isActive: false,
    },
    {
      id: "3",
      name: "远程工作区 2",
      type: "remote",
      path: "admin@192.168.1.100:/workspace",
      isActive: false,
    },
  ],
};

// Mock 权限数据
export const mockPermissions: Permission[] = [
  { id: "1", name: "read", description: "读取权限" },
  { id: "2", name: "write", description: "写入权限" },
  { id: "3", name: "delete", description: "删除权限" },
  { id: "4", name: "admin", description: "管理员权限" },
  { id: "5", name: "execute", description: "执行权限" },
];

// Mock 角色数据
export const mockRoles: Role[] = [
  { id: "1", name: "admin", permissions: ["1", "2", "3", "4", "5"] },
  { id: "2", name: "developer", permissions: ["1", "2", "5"] },
  { id: "3", name: "viewer", permissions: ["1"] },
];
