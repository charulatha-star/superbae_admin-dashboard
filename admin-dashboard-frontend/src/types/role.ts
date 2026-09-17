export interface Role {
  id: string;
  name: string;
  description: string;
  system?: boolean;
  permissions: string[];
}

export interface Permission {
  id: string;
  module: string;
  resource: string;
  action: string;
}
