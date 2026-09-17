export interface Admin {
  id: string;
  name: string;
  email: string;
  password?: string;
  roleId: string;
  status: "active" | "suspended" | "inactive";
  avatar?: string;
  twoFactorEnabled: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  token?: string;
}
